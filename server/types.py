"""Core poem schema and poem-endpoint API types, shared across all domains."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


# ── Poem schema ─────────────────────────────────────────────────────────────────

class Author(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pen_name: str = Field(min_length=1)
    full_name: str = Field(min_length=1)


class Award(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl
    medal: str = Field(min_length=1)
    title: str = Field(min_length=1)
    closed: str = Field(min_length=1, description="ISO format datetime string")


class PoemSummaryData(BaseModel):
    """All fields needed to display a poem summary, statistics, and awards."""

    id: UUID
    title: str
    project: str
    rating: int = Field(ge=0, le=100)
    lines: int = Field(ge=0)
    words: int = Field(ge=0)
    date: datetime
    awards: List[Award]
    themes: List[str] = Field(default_factory=list)


class Poem(PoemSummaryData):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    title: str = Field(min_length=1)
    url: HttpUrl
    body: str = Field(min_length=1)
    moods: List[str]
    poetic_forms: List[str]
    techniques: List[str]
    tones_voices: List[str]
    key_images: List[str]
    contest_fit: List[str]
    notes: List[str] = Field(default_factory=list)
    socials: List[str] = Field(default_factory=list)
    author: Optional[Author] = None

    @field_validator("id")
    @classmethod
    def _require_uuid_v4(cls, v: UUID) -> UUID:
        if v.version != 4:
            raise ValueError("id must be a UUID v4")
        return v


# ── API: poem endpoints ─────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "degraded"]
    poems_loaded: int
    source: str


class PoemSummaryDataList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[PoemSummaryData]


class PoemCreate(BaseModel):
    """Create-payload for POST /api/poems."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    url: str
    body: str = Field(min_length=1)
    project: str
    rating: int = Field(ge=0, le=100)
    date: Optional[datetime] = None
    awards: List[Award] = Field(default_factory=list)
    themes: List[str] = Field(default_factory=list)
    moods: List[str] = Field(default_factory=list)
    poetic_forms: List[str] = Field(default_factory=list)
    techniques: List[str] = Field(default_factory=list)
    tones_voices: List[str] = Field(default_factory=list)
    key_images: List[str] = Field(default_factory=list)
    contest_fit: List[str] = Field(default_factory=list)
    socials: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)
    author: Optional[Author] = None


class PoemPatch(BaseModel):
    """Partial-update payload for PATCH /api/poems/{id}."""
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1)
    url: Optional[str] = None
    body: Optional[str] = Field(None, min_length=1)
    awards: Optional[List[Award]] = None
    date: Optional[datetime] = None
    themes: Optional[List[str]] = None
    moods: Optional[List[str]] = None
    poetic_forms: Optional[List[str]] = None
    techniques: Optional[List[str]] = None
    tones_voices: Optional[List[str]] = None
    key_images: Optional[List[str]] = None
    project: Optional[str] = None
    contest_fit: Optional[List[str]] = None
    rating: Optional[int] = Field(None, ge=0, le=100)
    socials: Optional[List[str]] = None
    notes: Optional[List[str]] = None
    author: Optional[Author] = None
