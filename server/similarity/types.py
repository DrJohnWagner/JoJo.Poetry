from typing import List, Set
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from database.schemas.poem import PoemSummaryData

class NormalisedPoemFeatures(BaseModel):
    id: UUID
    title: str
    project: str
    themes: Set[str] = Field(default_factory=set)
    emotion: Set[str] = Field(default_factory=set)
    form: Set[str] = Field(default_factory=set)
    images: Set[str] = Field(default_factory=set)
    fit: Set[str] = Field(default_factory=set)
    project_text: str = ""
    form_text: str = ""
    image_text: str = ""

class StructuredScoreBreakdown(BaseModel):
    theme_sim: float
    emotion_sim: float
    form_sim: float
    imagery_sim: float
    fit_sim: float
    theme_overlap: List[str]
    emotion_overlap: List[str]
    form_overlap: List[str]
    imagery_overlap: List[str]
    fit_overlap: List[str]

class SemanticScoreBreakdown(BaseModel):
    project_tfidf_sim: float
    form_tfidf_sim: float
    image_tfidf_sim: float

class FusedScoreBreakdown(BaseModel):
    overall_score: float
    theme_score: float
    form_score: float
    emotion_score: float
    imagery_score: float
    structured: StructuredScoreBreakdown
    semantic: SemanticScoreBreakdown


class NeighbourResult(PoemSummaryData):
    score: float
    breakdown: FusedScoreBreakdown


class NeighbourListResult(BaseModel):
    query_id: UUID
    neighbours: List[NeighbourResult]
