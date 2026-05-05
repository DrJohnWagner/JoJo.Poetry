from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

PlacementLiteral = Literal[
    "top-left", "top", "top-right",
    "left", "centre", "right",
    "bottom-left", "bottom", "bottom-right",
]


class TextSpecification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    colour: str
    font: str
    size: int
    location: PlacementLiteral
    margin: int = 30


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str = "none"
    text: Optional[TextSpecification] = None
    filter_first: bool = False


class GenerateResponse(BaseModel):
    excerpt: str
    prompt: str
    image_url: str


class UpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str
    excerpt: Optional[str] = None
    text: Optional[TextSpecification] = None
    filter_first: bool = False


class ImageResponse(BaseModel):
    image_url: str


class RegenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    prompt: str
    excerpt: Optional[str] = None
    filter: str = "none"
    text: Optional[TextSpecification] = None
    filter_first: bool = False


class PostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str
    excerpt: Optional[str] = None
    text: Optional[TextSpecification] = None
    filter_first: bool = False


class PostResponse(BaseModel):
    socials: list[str]
