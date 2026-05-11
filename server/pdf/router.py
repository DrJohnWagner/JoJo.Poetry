"""PDF generation endpoint: Jinja2 → Typst source → compiled PDF or PNG, with multi-platform post."""
from __future__ import annotations

import base64
import binascii
import re
import tempfile
from pathlib import Path
from typing import Optional
from uuid import UUID

import httpx
import jinja2
import typst
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from server.config import AUTHOR
from server.fonts.router import FONTS_DIR, list_fonts
from server.pdf.pipeline import pdf_caption, png_from_source
from server.pdf.types import PDFAnalyticsImage, PDFPostResponse, PDFRequest
from server.api import require_write_access
from server.repository import PoemNotFoundError, PoemRepository, get_repository
from server.social.bsky import post_to_bsky
from server.social.cloud import upload as cloudinary_upload
from server.social.posting import post_to_instagram, post_to_threads

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

TEMPLATE = jinja2.Template((Path(__file__).parent / "poem.typ").read_text())


def resolve_family(filename: str) -> str:
    fonts = {f["filename"]: f["family"] for f in list_fonts()}
    return fonts.get(filename, filename.split("/")[0].replace("_", " "))


_WEIGHT_MAP = {
    "Thin": "thin",
    "ExtraLight": "extralight",
    "Light": "light",
    "Regular": "regular",
    "Medium": "medium",
    "SemiBold": "semibold",
    "Bold": "bold",
    "ExtraBold": "extrabold",
    "Black": "black",
    "": "regular",
}


def parse_weight_style(filename: str) -> tuple[str, str]:
    _, _, suffix = filename.split("/")[-1].partition("-")
    italic = "Italic" in suffix
    weight_key = suffix.replace("Italic", "").replace("Oblique", "")
    return _WEIGHT_MAP.get(weight_key, "regular"), "italic" if italic else "normal"


_TYPST_ESCAPE = str.maketrans(
    {
        "\\": "\\\\",
        "#": "\\#",
        "*": "\\*",
        "_": "\\_",
        "`": "\\`",
        "$": "\\$",
        "@": "\\@",
        "<": "\\<",
        "[": "\\[",
        "]": "\\]",
    }
)


_INLINE_RE = re.compile(
    r"\[([^\]]*)\]\(([^)]*)\)"  # [text](url)
    r"|\*\*([^*]+)\*\*"  # **bold**
    r"|\*([^*]+)\*"  # *italic*
)


def escape_line(text: str) -> str:
    """Escape Typst special characters while preserving inline Markdown links and bold/italic."""
    result = []
    last = 0
    for m in _INLINE_RE.finditer(text):
        result.append(text[last : m.start()].translate(_TYPST_ESCAPE))
        if m.group(1) is not None:
            display = m.group(1).translate(_TYPST_ESCAPE)
            result.append(f'#link("{m.group(2)}")[{display}]')
        elif m.group(3) is not None:
            result.append(f"*{m.group(3).translate(_TYPST_ESCAPE)}*")
        else:
            result.append(f"_{m.group(4).translate(_TYPST_ESCAPE)}_")
        last = m.end()
    result.append(text[last:].translate(_TYPST_ESCAPE))
    return "".join(result)


_BR_RE = re.compile(r"<br\s*/?>\n?", re.IGNORECASE)


def poem_to_typst(body: str) -> str:
    """Convert poem body to Typst markup; leading spaces become #h() em-based indents."""
    lines = []
    for line in body.split("\n"):
        expanded = line.expandtabs(4)
        stripped = expanded.lstrip(" ")
        n = len(expanded) - len(stripped)
        indent = f"#h({n * 0.3:.2g}em)" if n else ""
        escaped = escape_line(stripped)
        lines.append(f"{indent}{escaped} \\" if escaped.strip() else "")
    return "\n".join(lines)


def body_to_stanzas(body: str) -> list[str]:
    """Split body into stanzas; a gap of 3+ newlines inserts an empty-string stanza."""
    # Capturing group returns separators as odd-indexed parts; len >= 3 triggers the empty stanza.
    plain = _BR_RE.sub("\n", body)
    parts = re.split(r"(\n{2,})", plain)
    result = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            if part.strip():
                result.append(poem_to_typst(part.strip("\n")))
        else:
            if len(part) >= 3:
                result.append("")
    return result


def _image_suffix_from_mime(mime_type: str) -> str:
    mime = mime_type.lower().strip()
    if mime == "image/png":
        return "png"
    if mime in {"image/jpeg", "image/jpg"}:
        return "jpg"
    if mime == "image/webp":
        return "webp"
    if mime == "image/svg+xml":
        return "svg"
    return "bin"


def _materialize_analytics_images(
    images: list[PDFAnalyticsImage],
    output_dir: Path,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    primary: list[dict[str, str]] = []
    secondary: list[dict[str, str]] = []

    for idx, image in enumerate(images):
        payload = image.data_base64.strip()
        if payload.startswith("data:"):
            _, _, payload = payload.partition(",")

        try:
            binary = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid base64 image payload at analytics_images[{idx}]",
            )

        suffix = _image_suffix_from_mime(image.mime_type)
        image_path = output_dir / f"analytics-{idx}.{suffix}"
        image_path.write_bytes(binary)

        item = {
            "title": escape_line(image.title),
            "summary": escape_line(image.summary),
            "image_path": image_path.name,
        }
        if image.tier == "primary":
            primary.append(item)
        else:
            secondary.append(item)

    return primary, secondary


def build_source(
    poem,
    options: PDFRequest,
    analytics_primary: list[dict[str, str]] | None = None,
    analytics_secondary: list[dict[str, str]] | None = None,
) -> str:
    weight, style = parse_weight_style(options.font)
    primary = analytics_primary or []
    secondary = analytics_secondary or []
    return TEMPLATE.render(
        paper=options.paper,
        margin=f"{options.margin}cm",
        font=resolve_family(options.font),
        weight=weight,
        style=style,
        font_size=f"{options.font_size}pt",
        title_font_size=f"{options.font_size + 6}pt",
        colour=options.colour,
        leading=options.leading,
        spacing=options.spacing,
        columns=options.columns,
        gutter=f"{options.gutter}cm",
        title=poem.title,
        author=AUTHOR.pen_name,
        body=poem_to_typst(poem.body),
        stanzas=body_to_stanzas(poem.body),
        analytics_primary=primary,
        analytics_secondary=secondary,
    )


@router.post("/{poem_id}")
def create_pdf(
    poem_id: UUID,
    options: PDFRequest,
    repo: PoemRepository = Depends(get_repository),
) -> Response:
    try:
        poem = repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poem not found")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        analytics_primary, analytics_secondary = _materialize_analytics_images(
            options.analytics_images,
            tmp_path,
        )
        source = build_source(poem, options, analytics_primary, analytics_secondary)
        typ_file = Path(tmp) / "poem.typ"
        typ_file.write_text(source)
        try:
            pdf_bytes = typst.compile(str(typ_file), font_paths=[str(FONTS_DIR)])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{poem.title}.pdf"'},
    )


@router.post("/{poem_id}/post", response_model=PDFPostResponse, dependencies=[Depends(require_write_access)])
def post_pdf(
    poem_id: UUID,
    options: PDFRequest,
    repo: PoemRepository = Depends(get_repository),
) -> PDFPostResponse:
    try:
        poem = repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Poem not found"
        )

    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            analytics_primary, analytics_secondary = _materialize_analytics_images(
                options.analytics_images,
                tmp_path,
            )
            source = build_source(poem, options, analytics_primary, analytics_secondary)
            png_bytes = png_from_source(source, working_dir=tmp_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    image_url = cloudinary_upload(png_bytes)
    caption = pdf_caption(poem.title, poem.url, is_adult=False)

    posted_urls: list[str] = []
    post_errors: list[str] = []
    instagram_url: Optional[str] = None

    def attempt(label: str, fn):
        nonlocal instagram_url
        try:
            url = fn()
            if url:
                posted_urls.append(url)
            return url
        except httpx.HTTPStatusError as exc:
            try:
                body = exc.response.json()
                msg = body.get("error", {}).get("message") or str(body)
            except Exception:
                msg = exc.response.text or str(exc)
            post_errors.append(f"{label}: {msg}")
            return None

    instagram_url = attempt(
        "Instagram",
        lambda: post_to_instagram(image_url, caption),
    )
    attempt(
        "Threads",
        lambda: post_to_threads(image_url, caption),
    )
    attempt(
        "Bluesky",
        lambda: post_to_bsky(png_bytes, caption),
    )

    if instagram_url:
        repo.update(poem_id, {"socials": list(poem.socials) + [instagram_url]})

    return PDFPostResponse(socials=posted_urls, errors=post_errors)
