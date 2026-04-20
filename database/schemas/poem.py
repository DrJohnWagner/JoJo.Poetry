"""Pydantic models for the poem data model.

Mirrors database/schemas/poem.schema.json. Runtime validation:
  - requires `id` as a UUID v4 and treats it as unique at the collection level
    (uniqueness is enforced by the repository layer, not the model)
  - applies defaults for optional fields (`pinned`, `notes`)
    when absent from input
  - accepts the existing dataset unchanged
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class Author(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pen_name: str = Field(min_length=1)
    full_name: str = Field(min_length=1)


class Contest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl
    award: str = Field(min_length=1)
    title: Optional[str] = None


class Poem(BaseModel):
    """Persisted poem record.

    Strictness: `extra="forbid"` on the top-level model rejects unknown fields
    so that schema drift is surfaced rather than silently stored. Optional
    fields with defaults keep the model tolerant of older records that
    predate `pinned` / `notes`.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    # Required / immutable
    id: UUID

    # Required / editable
    title: str = Field(min_length=1)
    url: HttpUrl
    body: str = Field(min_length=1)
    contests: List[Contest]
    date: datetime
    themes: List[str]
    emotional_register: List[str]
    form_and_craft: List[str]
    key_images: List[str]
    project: str
    contest_fit: List[str]
    rating: int = Field(ge=0, le=100)

    # Required / derived (recomputable from body)
    lines: int = Field(ge=0)
    words: int = Field(ge=0)

    # Optional with defaults
    pinned: bool = False
    notes: List[str] = Field(default_factory=list)
    socials: List[str] = Field(default_factory=list)
    author: Optional[Author] = None

    @field_validator("id")
    @classmethod
    def _require_uuid_v4(cls, v: UUID) -> UUID:
        if v.version != 4:
            raise ValueError("id must be a UUID v4")
        return v
