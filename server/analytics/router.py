"""Analytics API: summary metrics and scoring for a single poem."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from server.repository import PoemNotFoundError, PoemRepository, get_repository
from server.analytics.pipeline import (
    interruption_density,
    indentation_data,
    line_length_distribution,
    punctuation_pressure_data,
    stanza_length_data,
    summary,
)
from server.analytics.render import select_visualisations
from server.analytics.scoring import build_scoring
from server.analytics.types import AnalyticsResponse, PerLineData

router = APIRouter(tags=["analytics"])

_distributions: dict | None = None


def set_distributions(dist: dict) -> None:
    global _distributions
    _distributions = dist


@router.get(
    "/api/analytics/{poem_id}",
    response_model=AnalyticsResponse,
    status_code=status.HTTP_200_OK,
)
def get_analytics(
    poem_id: UUID,
    repo: PoemRepository = Depends(get_repository),
) -> AnalyticsResponse:
    try:
        poem = repo.get(poem_id)
    except PoemNotFoundError:
        raise HTTPException(status_code=404, detail="Poem not found") from None

    body = poem.body
    summary_data = summary(body)
    indent_data  = indentation_data(body)
    line_data    = line_length_distribution(body)
    inter_data   = interruption_density(body)
    punct_data   = punctuation_pressure_data(body)
    stanza_data  = stanza_length_data(body)

    scoring = (
        build_scoring(
            summary_data=summary_data,
            per_line={
                "indentation":          indent_data,
                "line_lengths":         line_data,
                "interruption":         inter_data,
                "punctuation_pressure": punct_data,
                "stanza_lengths":       stanza_data,
            },
            distributions=_distributions,
        )
        if _distributions
        else None
    )

    from server.analytics.types import (
        IndentationLine, LineLengthLine, InterruptionLine,
        PunctuationLine, StanzaData,
    )

    per_line = PerLineData(
        indentation=[IndentationLine(**row) for row in indent_data],
        line_lengths=[
            LineLengthLine(**row) for row in line_data["per_line"]
        ],
        interruption=[InterruptionLine(**row) for row in inter_data],
        punctuation=[PunctuationLine(**row) for row in punct_data],
        stanzas=StanzaData(
            stanza_lengths=stanza_data["stanza_lengths"],
            total_stanzas=stanza_data["total_stanzas"],
            total_lines=stanza_data["total_lines"],
            average_lines_per_stanza=stanza_data["average_lines_per_stanza"],
        ),
    )

    return AnalyticsResponse(
        poem_id=poem_id,
        summary=summary_data,
        scoring=scoring,
        render_plan=select_visualisations(scoring.scores) if scoring else None,
        per_line=per_line,
    )
