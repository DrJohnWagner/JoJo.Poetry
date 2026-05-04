from __future__ import annotations

import base64
import io
import re
from functools import cache
from pathlib import Path
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from PIL import Image
from pydantic import BaseModel, ConfigDict

from server.api import require_write_access
from server.repository import PoemNotFoundError, PoemRepository, get_repository
from server.instagram.filters import FILTER_NAMES, apply_filter
from server.instagram.instagram import generate as instagram_generate, overlay_text

router = APIRouter(tags=["instagram"])

# In-memory image store keyed by poem_id string or "{poem_id}-{filter_name}".
_image_store: dict[str, bytes] = {}


PlacementLiteral = Literal[
    "top-left", "top", "top-right",
    "left", "centre", "right",
    "bottom-left", "bottom", "bottom-right",
]


class TextSpecification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    colour: str         # resolved hex, e.g. "#ffffff"
    font: str           # filename stem relative to fonts/, e.g. EB_Garamond/EBGaramond-Regular
    size: int
    location: PlacementLiteral


class InstagramData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    excerpt: Optional[str] = None
    prompt: Optional[str] = None
    image: Optional[str] = None
    filter: Optional[str] = None
    text: Optional[TextSpecification] = None


@router.post(
    "/api/instagram/generate",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def generate(
    data: InstagramData,
    repo: PoemRepository = Depends(get_repository),
) -> InstagramData:
    try:
        poem = repo.get(data.poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None
    result = instagram_generate(poem.title, poem.body)

    raw_b64 = result["image"].removeprefix("data:image/png;base64,")
    _image_store[str(data.poem_id)] = base64.b64decode(raw_b64)

    image = Image.open(io.BytesIO(_image_store[str(data.poem_id)]))

    if data.text:
        image = overlay_text(
            image,
            result["excerpt"],
            data.text.font,
            data.text.size,
            data.text.colour,
            data.text.location,
        )

    filter_name = data.filter or "none"
    filtered = apply_filter(image, filter_name)

    buf = io.BytesIO()
    filtered.save(buf, format="PNG")
    key = f"{data.poem_id}-{filter_name}"
    _image_store[key] = buf.getvalue()

    return InstagramData(
        poem_id=data.poem_id,
        excerpt=result["excerpt"],
        prompt=result["prompt"],
        filter=filter_name,
        image=f"/api/instagram/image/{data.poem_id}/{filter_name}",
    )


@router.get("/api/instagram/filters", status_code=status.HTTP_200_OK)
def filters() -> list[str]:
    return FILTER_NAMES


@router.post(
    "/api/instagram/update",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def update(data: InstagramData) -> InstagramData:
    if not data.filter:
        raise HTTPException(status_code=422, detail="filter is required") from None
    if data.filter not in FILTER_NAMES:
        raise HTTPException(status_code=422, detail=f"Unknown filter: {data.filter!r}") from None

    original = _image_store.get(str(data.poem_id))
    if original is None:
        raise HTTPException(status_code=404, detail="Image not found — generate first") from None

    image = Image.open(io.BytesIO(original))

    if data.text and data.excerpt:
        image = overlay_text(
            image,
            data.excerpt,
            data.text.font,
            data.text.size,
            data.text.colour,
            data.text.location,
        )

    filtered = apply_filter(image, data.filter)

    buf = io.BytesIO()
    filtered.save(buf, format="PNG")
    key = f"{data.poem_id}-{data.filter}"
    _image_store[key] = buf.getvalue()

    return InstagramData(
        poem_id=data.poem_id,
        excerpt=data.excerpt,
        prompt=data.prompt,
        filter=data.filter,
        text=data.text,
        image=f"/api/instagram/image/{data.poem_id}/{data.filter}",
    )


@router.get("/api/instagram/fonts", status_code=status.HTTP_200_OK)
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


@router.get("/api/instagram/image/{poem_id}", status_code=status.HTTP_200_OK)
def get_image(poem_id: UUID) -> Response:
    png = _image_store.get(str(poem_id))
    if png is None:
        raise HTTPException(status_code=404, detail="Image not found") from None
    return Response(content=png, media_type="image/png")


@router.get("/api/instagram/image/{poem_id}/{filter_name}", status_code=status.HTTP_200_OK)
def get_filtered_image(poem_id: UUID, filter_name: str) -> Response:
    png = _image_store.get(f"{poem_id}-{filter_name}")
    if png is None:
        raise HTTPException(status_code=404, detail="Filtered image not found") from None
    return Response(content=png, media_type="image/png")


@router.post(
    "/api/instagram/regenerate",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def regenerate(data: InstagramData) -> InstagramData:
    return data


@router.post(
    "/api/instagram/render",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def render(data: InstagramData) -> InstagramData:
    return data


@router.post(
    "/api/instagram/post",
    response_model=InstagramData,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
def post(data: InstagramData) -> InstagramData:
    return data
