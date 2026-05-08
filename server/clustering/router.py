from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from server.api import check_for_external_changes
from server.repository import PoemRepository, get_repository
from server.clustering.engine import run_clustering
from server.clustering.types import VALID_CATEGORIES, ClusterRequest, ClusterResponse

router = APIRouter(tags=["clustering"])


@router.post("/api/poems/cluster", response_model=ClusterResponse)
def cluster_poems(
    payload: ClusterRequest,
    repo: PoemRepository = Depends(get_repository),
    _: None = Depends(check_for_external_changes),
) -> ClusterResponse:
    """Cluster the corpus by one or more metadata categories.

    Categories must be drawn from: ``themes``, ``moods``,
    ``poetic_forms``, ``techniques``, ``tones_voices``,
    ``images`` (maps to ``key_images``), ``contest_fit``.

    If ``k`` is omitted the number of clusters is chosen automatically via
    silhouette-score sweep. Poems in clusters smaller than
    ``min_cluster_size`` are returned in ``excluded`` with reason
    ``"cluster too small"``.
    """
    bad = [c for c in payload.categories if c not in VALID_CATEGORIES]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown categories: {bad}. Allowed: {sorted(VALID_CATEGORIES)}",
        )
    return run_clustering(repo.list(), payload)
