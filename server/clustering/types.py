from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

VALID_CATEGORIES = frozenset(
    {
        "themes",
        "emotional_registers",
        "formal_modes",
        "craft_features",
        "stylistic_postures",
    }
)

# Maps API category name -> Poem field name
CATEGORY_FIELD_MAP = {
    "themes": "themes",
    "emotional_registers": "emotional_registers",
    "formal_modes": "formal_modes",
    "craft_features": "craft_features",
    "stylistic_postures": "stylistic_postures",
}


class ClusterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categories: List[str] = Field(min_length=1)
    k: Optional[int] = Field(default=None, ge=2)
    min_cluster_size: int = Field(default=2, ge=1)


class PoemSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    pinned: bool
    project: str
    themes: List[str]
    emotional_registers: List[str]
    formal_modes: List[str]
    craft_features: List[str]
    stylistic_postures: List[str]


class Cluster(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cluster_id: str
    label: str
    size: int
    features: List[str]
    poems: List[PoemSummary]


class ExcludedPoem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    reason: Literal["zero signal", "cluster too small"]


class ClusterTotals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_poems: int
    eligible_poems: int
    excluded_zero_signal_poems: int
    excluded_small_cluster_poems: int
    clustered_poems: int
    cluster_count: int


class ClusterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    totals: ClusterTotals
    clusters: List[Cluster]
    excluded: List[ExcludedPoem]
    k_used: int
    categories_used: List[str]
