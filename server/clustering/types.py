from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

VALID_CATEGORIES = frozenset(
    {"themes", "emotional_register", "form_and_craft", "images", "contest_fit"}
)

# Maps API category name → Poem field name
CATEGORY_FIELD_MAP = {
    "themes": "themes",
    "emotional_register": "emotional_register",
    "form_and_craft": "form_and_craft",
    "images": "key_images",
    "contest_fit": "contest_fit",
}


class ClusterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categories: List[str] = Field(min_length=1)
    k: Optional[int] = Field(default=None, ge=2)
    min_cluster_size: int = Field(default=2, ge=1)
    top_features: int = Field(default=3, ge=1, le=20)


class PoemSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    rating: int
    date: datetime


class Cluster(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    size: int
    features: List[str]
    awards_summary: List[str]
    poems: List[PoemSummary]


class ExcludedPoem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    reason: str


class ClusterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clusters: List[Cluster]
    excluded: List[ExcludedPoem]
    k_used: int
    categories_used: List[str]
