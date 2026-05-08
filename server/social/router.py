"""Social post API: generate, update, regenerate, and publish poem images to Instagram, Threads, and Bluesky."""
from __future__ import annotations

import base64
import io
from functools import cache
from pathlib import Path
from typing import Optional
from uuid import UUID

import httpx

from fastapi import APIRouter, Depends, HTTPException, Response, status
from openai import BadRequestError as OpenAIBadRequestError
from PIL import Image

from server.api import require_write_access
from server.repository import PoemNotFoundError, PoemRepository, get_repository
from server.social.filters import FILTER_NAMES, apply_filter
from server.social.pipeline import (
    generate,
    regenerate,
    overlay_text,
    instagram_caption,
    threads_caption,
    bsky_caption,
)
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


def _filter_first(text: Optional[TextSpecification]) -> bool:
    return bool(text and text.filter_first)


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
    """Resize to 1080×1080, apply filter and text overlay (order controlled by filter_first), cache result."""
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
    try:
        result = generate(poem.title, poem.body)
        raw = _store_raw(data.poem_id, result["image"])
        image_url = _compose_and_store(
            data.poem_id,
            raw,
            result["excerpt"],
            data.text,
            data.filter,
            _filter_first(data.text),
        )
    except OpenAIBadRequestError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from None

    return GenerateResponse(
        excerpt=result["excerpt"],
        prompt=result["prompt"],
        alt_text=result["alt_text"],
        is_adult=result["is_adult"],
        image_url=image_url,
        cost=result.get("cost"),
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
    image_url = _compose_and_store(
        data.poem_id,
        raw,
        data.excerpt,
        data.text,
        data.filter,
        _filter_first(data.text),
    )

    return ImageResponse(image_url=image_url)




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
    try:
        result = regenerate(data.prompt, existing_b64)
    except OpenAIBadRequestError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from None

    raw = _store_raw(data.poem_id, result["image"])
    image_url = _compose_and_store(
        data.poem_id,
        raw,
        data.excerpt,
        data.text,
        data.filter,
        _filter_first(data.text),
    )

    return ImageResponse(image_url=image_url, cost=result.get("cost"))


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
    _compose_and_store(
        data.poem_id,
        raw,
        data.excerpt,
        data.text,
        data.filter,
        _filter_first(data.text),
    )
    composed = _image_store[f"{data.poem_id}-{data.filter}"]

    excerpt = data.excerpt or ""
    alt_text = data.alt_text or ""
    is_adult = data.is_adult or False
    image_url = cloudinary_upload(composed)

    posted_urls: list[str] = []
    post_errors: list[str] = []
    instagram_url: Optional[str] = None

    def attempt(label: str, fn):
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
        lambda: post_to_instagram(
            image_url,
            instagram_caption(excerpt, poem.url, is_adult),
            alt_text,
        ),
    )
    attempt(
        "Threads",
        lambda: post_to_threads(
            image_url, threads_caption(excerpt, poem.url, is_adult)
        ),
    )
    attempt(
        "Bluesky",
        lambda: post_to_bsky(composed, bsky_caption(excerpt, poem.url, is_adult)),
    )

    if instagram_url:
        repo.update(data.poem_id, {"socials": list(poem.socials) + [instagram_url]})

    return PostResponse(socials=posted_urls, errors=post_errors)
