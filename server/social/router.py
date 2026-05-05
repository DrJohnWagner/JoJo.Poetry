from __future__ import annotations

import base64
import io
import re
from functools import cache
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from PIL import Image

from server.api import require_write_access
from server.repository import PoemNotFoundError, PoemRepository, get_repository
from server.social.filters import FILTER_NAMES, apply_filter
from server.social.pipeline import generate, regenerate, overlay_text, analyse_image, generate_caption
from server.social.cloud import upload as cloudinary_upload
from server.social.posting import post_to_instagram, post_to_threads
from server.social.bsky import post_to_bsky
from server.social.types import (
    GenerateRequest, GenerateResponse,
    ImageResponse,
    PostRequest, PostResponse,
    RegenerateRequest,
    TextSpecification,
    UpdateRequest,
)

router = APIRouter(tags=["social"])

# In-memory image store keyed by poem_id string or "{poem_id}-{filter_name}".
_image_store: dict[str, bytes] = {}


def _store_raw(poem_id: UUID, image_b64: str) -> bytes:
    raw = base64.b64decode(image_b64.removeprefix("data:image/png;base64,"))
    _image_store[str(poem_id)] = raw
    return raw


def _get_raw_or_404(poem_id: UUID) -> bytes:
    raw = _image_store.get(str(poem_id))
    if raw is None:
        raise HTTPException(status_code=404, detail="Image not found — generate first")
    return raw


def _compose_and_store(
    poem_id: UUID,
    raw: bytes,
    excerpt: Optional[str],
    text: Optional[TextSpecification],
    filter_name: str,
    filter_first: bool = False,
) -> str:
    image = Image.open(io.BytesIO(raw)).resize((1080, 1080), Image.LANCZOS)
    if filter_first:
        image = apply_filter(image, filter_name)
        if text and excerpt:
            image = overlay_text(image, excerpt, text.font, text.size, text.colour, text.location, text.margin)
    else:
        if text and excerpt:
            image = overlay_text(image, excerpt, text.font, text.size, text.colour, text.location, text.margin)
        image = apply_filter(image, filter_name)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    _image_store[f"{poem_id}-{filter_name}"] = buf.getvalue()
    return f"/api/socials/image/{poem_id}/{filter_name}"


@router.post(
    "/api/socials/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def generate_post(
    data: GenerateRequest,
    repo: PoemRepository = Depends(get_repository),
) -> GenerateResponse:
    try:
        poem = repo.get(data.poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None
    result = generate(poem.title, poem.body)

    raw = _store_raw(data.poem_id, result["image"])
    image_url = _compose_and_store(data.poem_id, raw, result["excerpt"], data.text, data.filter, data.filter_first)

    return GenerateResponse(
        excerpt=result["excerpt"],
        prompt=result["prompt"],
        image_url=image_url,
    )


@router.get("/api/socials/filters", status_code=status.HTTP_200_OK)
def filters() -> list[dict]:
    return _filter_options()


@cache
def _filter_options() -> list[dict]:
    images_dir = Path(__file__).parent / "images"
    result = []
    for name in FILTER_NAMES:
        img_path = images_dir / f"Balloons-{name}.png"
        image_b64 = f"data:image/png;base64,{base64.b64encode(img_path.read_bytes()).decode()}" if img_path.exists() else ""
        result.append({"name": name, "image": image_b64})
    return result


@router.post(
    "/api/socials/update",
    response_model=ImageResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def update(data: UpdateRequest) -> ImageResponse:
    if data.filter not in FILTER_NAMES:
        raise HTTPException(status_code=422, detail=f"Unknown filter: {data.filter!r}") from None

    raw = _get_raw_or_404(data.poem_id)
    image_url = _compose_and_store(data.poem_id, raw, data.excerpt, data.text, data.filter, data.filter_first)

    return ImageResponse(image_url=image_url)


@router.get("/api/socials/fonts", status_code=status.HTTP_200_OK)
def fonts() -> list[dict]:
    return _local_fonts()


@cache
def _local_fonts() -> list[dict]:
    fonts_dir = Path(__file__).parent / "fonts"
    entries = []
    for ttf in sorted(fonts_dir.rglob("*.ttf")):
        stem = ttf.stem
        rel = ttf.relative_to(fonts_dir).with_suffix("").as_posix()
        entries.append({"filename": rel, "label": _label(stem)})
    return entries


_SPLIT_RE = re.compile(
    r"(?<=[a-z])(?=[A-Z])"
    r"|(?<=[A-Z])(?=[A-Z][a-z])"
    r"|(?<=[a-zA-Z])(?=[0-9])"
)


def _label(stem: str) -> str:
    family_raw, _, style_raw = stem.partition("-")
    family = " ".join(
        word
        for segment in family_raw.replace("_", " ").split()
        for word in _SPLIT_RE.split(segment)
    )
    style = " ".join(_SPLIT_RE.split(style_raw)) if style_raw else ""
    return f"{family} {style}".strip()


@router.get("/api/socials/image/{poem_id}", status_code=status.HTTP_200_OK)
def get_image(poem_id: UUID) -> Response:
    png = _image_store.get(str(poem_id))
    if png is None:
        raise HTTPException(status_code=404, detail="Image not found") from None
    return Response(content=png, media_type="image/png")


@router.get("/api/socials/image/{poem_id}/{filter_name}", status_code=status.HTTP_200_OK)
def get_filtered_image(poem_id: UUID, filter_name: str) -> Response:
    png = _image_store.get(f"{poem_id}-{filter_name}")
    if png is None:
        raise HTTPException(status_code=404, detail="Filtered image not found") from None
    return Response(content=png, media_type="image/png")


@router.post(
    "/api/socials/regenerate",
    response_model=ImageResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def regenerate_post(data: RegenerateRequest) -> ImageResponse:
    original = _get_raw_or_404(data.poem_id)
    existing_b64 = f"data:image/png;base64,{base64.b64encode(original).decode()}"
    result = regenerate(data.prompt, existing_b64)

    raw = _store_raw(data.poem_id, result["image"])
    image_url = _compose_and_store(data.poem_id, raw, data.excerpt, data.text, data.filter, data.filter_first)

    return ImageResponse(image_url=image_url)


@router.post(
    "/api/socials/post",
    response_model=PostResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def post(
    data: PostRequest,
    repo: PoemRepository = Depends(get_repository),
) -> PostResponse:
    if data.filter not in FILTER_NAMES:
        raise HTTPException(status_code=422, detail=f"Unknown filter: {data.filter!r}") from None
    try:
        poem = repo.get(data.poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None

    raw = _get_raw_or_404(data.poem_id)
    _compose_and_store(data.poem_id, raw, data.excerpt, data.text, data.filter, data.filter_first)
    composed = _image_store[f"{data.poem_id}-{data.filter}"]

    analysis = analyse_image(composed)
    caption = generate_caption(data.excerpt or "", poem.url, analysis["is_adult"])
    image_url = cloudinary_upload(composed)
    instagram_url = post_to_instagram(image_url, caption, analysis["alt_text"])
    threads_url = post_to_threads(image_url, caption)
    bsky_url = post_to_bsky(composed, caption)

    new_socials = [u for u in [instagram_url, threads_url, bsky_url] if u]
    repo.update(data.poem_id, {"socials": list(poem.socials) + new_socials})

    return PostResponse(socials=new_socials)
