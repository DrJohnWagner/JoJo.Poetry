from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api import check_for_external_changes
from server.similarity.service import get_similarity_service
from server.similarity.types import NeighbourListResult, SimilarityBundle

router = APIRouter(tags=["similarity"])


@router.get("/api/poems/{poem_id}/similar", response_model=SimilarityBundle)
def get_similar_bundle(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k_overall: int = Query(5, ge=1, le=50),
    k_theme: int = Query(3, ge=1, le=50),
    k_form: int = Query(3, ge=1, le=50),
    k_emotion: int = Query(3, ge=1, le=50),
    k_imagery: int = Query(3, ge=1, le=50),
) -> SimilarityBundle:
    """All similarity dimensions in one call, with per-category k values."""
    svc = get_similarity_service()
    results = {
        "overall": svc.get_overall_similar(poem_id, k_overall),
        "theme":   svc.get_theme_similar(poem_id, k_theme),
        "form":    svc.get_form_similar(poem_id, k_form),
        "emotion": svc.get_emotion_similar(poem_id, k_emotion),
        "imagery": svc.get_imagery_similar(poem_id, k_imagery),
    }
    if any(v is None for v in results.values()):
        raise HTTPException(status_code=404, detail="Poem not found")
    return SimilarityBundle(**results)


@router.get("/api/poems/{poem_id}/similar/overall", response_model=NeighbourListResult)
def get_similar_overall(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Overall similarity across all dimensions."""
    res = get_similarity_service().get_overall_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/theme", response_model=NeighbourListResult)
def get_similar_theme(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by theme tags."""
    res = get_similarity_service().get_theme_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/form", response_model=NeighbourListResult)
def get_similar_form(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by form and craft."""
    res = get_similarity_service().get_form_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/emotion", response_model=NeighbourListResult)
def get_similar_emotion(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by emotional register."""
    res = get_similarity_service().get_emotion_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res


@router.get("/api/poems/{poem_id}/similar/imagery", response_model=NeighbourListResult)
def get_similar_imagery(
    poem_id: UUID,
    _: None = Depends(check_for_external_changes),
    k: int = Query(5, ge=1, le=50),
) -> NeighbourListResult:
    """Similarity by key imagery."""
    res = get_similarity_service().get_imagery_similar(poem_id, k)
    if res is None:
        raise HTTPException(status_code=404, detail="Poem not found")
    return res
