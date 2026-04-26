from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from database.schemas.poem import PoemSummaryData

VALID_CATEGORIES = frozenset(
    {
        "themes",
        "moods",
        "poetic_forms",
        "techniques",
        "tones_voices",
    }
)

# Maps API category name -> Poem field name
CATEGORY_FIELD_MAP = {
    "themes": "themes",
    "moods": "moods",
    "poetic_forms": "poetic_forms",
    "techniques": "techniques",
    "tones_voices": "tones_voices",
}


class ClusterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categories: List[str] = Field(min_length=1)
    k: Optional[int] = Field(default=None, ge=2)
    min_cluster_size: int = Field(default=2, ge=1)


class PoemSummary(PoemSummaryData):
    model_config = ConfigDict(extra="forbid")

    pinned: bool
    themes: List[str]
    moods: List[str]
    poetic_forms: List[str]
    techniques: List[str]
    tones_voices: List[str]


class Cluster(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cluster_id: str
    label: str
    size: int
    features: List[str]
    poems: List[PoemSummary]


class ExcludedPoem(PoemSummaryData):
    model_config = ConfigDict(extra="forbid")

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
