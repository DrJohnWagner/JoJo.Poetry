"""Pydantic/dataclass types for the social post pipeline: pricing, cost tracking, and API contracts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

PlacementLiteral = Literal[
    "top-left", "top", "top-right",
    "left", "centre", "right",
    "bottom-left", "bottom", "bottom-right",
]


@dataclass(frozen=True)
class Pricing:
    """
    All rates in USD per 1M tokens.

    Text models: set input/output/cached_input.
    Image models: set text_input, image_input (reference images passed in),
    and image_output (generated image tokens). cached_input covers prompt
    caching where supported.
    """

    # Text model rates
    input_per_million_tokens: float = 0.0
    output_per_million_tokens: float = 0.0
    cached_input_per_million_tokens: Optional[float] = None

    # Image model rates (None means not applicable)
    text_input_per_million_tokens: Optional[float] = None  # text prompt tokens
    image_input_per_million_tokens: Optional[float] = None  # reference image tokens
    image_output_per_million_tokens: Optional[float] = None  # generated image tokens


@dataclass(frozen=True)
class CostEstimate:
    # Token counts
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    image_input_tokens: int = 0  # reference image tokens (image model calls)
    image_output_tokens: int = 0  # generated image tokens (image model calls)

    # Costs
    input_cost_usd: float = 0.0
    output_cost_usd: float = 0.0
    cached_input_cost_usd: float = 0.0
    cache_creation_input_cost_usd: float = 0.0
    image_input_cost_usd: float = 0.0
    image_output_cost_usd: float = 0.0

    total_cost_usd: float = 0.0


class TextSpecification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    colour: str
    font: str
    size: int
    location: PlacementLiteral
    margin: int = 30
    filter_first: bool = False


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str = "none"
    text: Optional[TextSpecification] = None


class GenerateResponse(BaseModel):
    excerpt: str
    prompt: str
    alt_text: str
    is_adult: bool
    image_url: str
    cost: Optional[CostEstimate] = None


class UpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str
    excerpt: Optional[str] = None
    text: Optional[TextSpecification] = None


class ImageResponse(BaseModel):
    image_url: str
    cost: Optional[CostEstimate] = None


class RegenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    prompt: str
    excerpt: Optional[str] = None
    filter: str = "none"
    text: Optional[TextSpecification] = None


class PostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poem_id: UUID
    filter: str
    excerpt: Optional[str] = None
    text: Optional[TextSpecification] = None
    alt_text: str
    is_adult: bool


class PostResponse(BaseModel):
    socials: list[str]
    errors: list[str] = []
