"""Pydantic types for the analytics API."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class ScoredMetric(BaseModel):
    metric: str
    family: str
    value: float
    percentile_rank: float
    rarity: float
    score: float


class MetricScoring(BaseModel):
    scores: list[ScoredMetric]
    top_metrics: list[str]


class OverlayAttachment(BaseModel):
    overlay_type: str       # key from VISUALISATION_META
    host_visualisation: str # key of the chart it attaches to
    score: float
    driven_by: list[str]    # metric names that drove activation


class VisualisationCandidate(BaseModel):
    type: str                       # key from VISUALISATION_META
    score: float
    driven_by: list[str]            # top driving metric names
    contributing_metrics: list[str] # all metrics that contributed
    role: str                       # "primary" | "secondary" | "supporting"
    overlays: list[OverlayAttachment]
    display_mode: str               # "expanded" | "compact"
    families: list[str]
    ui_priority: float
    density: str                    # "high" | "medium" | "low"
    supports_overlay: bool
    suppresses: list[str]           # vis keys this candidate suppresses
    suppressed_by: str | None       # vis key that suppressed this candidate
    explanation: str


class FinalRenderPlan(BaseModel):
    primary: VisualisationCandidate | None
    secondary: list[VisualisationCandidate]
    supporting: list[VisualisationCandidate]
    overlays: list[OverlayAttachment]
    ordered_visualisations: list[VisualisationCandidate]


class AnalyticsSummary(BaseModel):
    max_indentation_depth: int
    fraction_indented_lines: float
    avg_indentation_depth: float
    indentation_volatility: float
    median_line_length: float
    shortest_line: int
    longest_line: int
    line_length_range: int
    punctuation_per_line: float
    dash_count: int
    comma_density: float
    terminal_stop_density: float
    enjambment_ratio: float
    interruption_density_mean: float
    stanza_volatility: float
    repetition_pressure: float
    negation_density: float
    pressure_peak_line: int
    left_margin_returns: int
    breath_interruption_severity: float
    momentum_persistence_score: float
    syntax_fracture_density: float


class IndentationLine(BaseModel):
    line: int
    leading_spaces: int
    indent_level: int
    text: str


class LineLengthLine(BaseModel):
    line: int
    with_spaces: int
    without_spaces: int


class InterruptionEvent(BaseModel):
    type: str  # dash | comma | colon | midline_terminal | indent_shift | short_line
    x: float   # normalised position within line [0, 1]
    value: float


class InterruptionLine(BaseModel):
    line: int
    score: float
    dash_score: float
    comma_score: float
    semicolon_score: float = 0.0
    colon_score: float
    midline_terminal_score: float
    indent_shift_score: float
    short_line_score: float
    text: str
    events: list[InterruptionEvent] = []


class PunctuationLine(BaseModel):
    line: int
    period_count: int
    comma_count: int
    dash_count: int
    semicolon_count: int
    other_count: int
    text: str


class StanzaData(BaseModel):
    stanza_lengths: list[int]
    total_stanzas: int
    total_lines: int
    average_lines_per_stanza: float


class PerLineData(BaseModel):
    indentation: list[IndentationLine]
    line_lengths: list[LineLengthLine]
    interruption: list[InterruptionLine]
    punctuation: list[PunctuationLine]
    stanzas: StanzaData


class AnalyticsResponse(BaseModel):
    poem_id: UUID
    summary: AnalyticsSummary
    scoring: MetricScoring | None = None
    render_plan: FinalRenderPlan | None = None
    per_line: PerLineData | None = None
