from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import silhouette_score

from database.schemas.poem import Poem
from server.clustering.types import (
    CATEGORY_FIELD_MAP,
    Cluster,
    ClusterRequest,
    ClusterResponse,
    ExcludedPoem,
    PoemSummary,
)

_EPS = 1e-9


def _build_matrix(
    poems: List[Poem], categories: List[str]
) -> Tuple[np.ndarray, List[str]]:
    """Binary feature matrix with per-category-block L2 normalisation.

    Returns (matrix shape (n, m), feature_names list of "{category}:{tag}").
    """
    cat_vocabs: Dict[str, List[str]] = {}
    for cat in categories:
        field = CATEGORY_FIELD_MAP[cat]
        tags: set[str] = set()
        for p in poems:
            tags.update(t.strip().lower() for t in getattr(p, field))
        cat_vocabs[cat] = sorted(tags)

    feature_names: List[str] = []
    for cat in categories:
        for tag in cat_vocabs[cat]:
            feature_names.append(f"{cat}:{tag}")

    n = len(poems)
    m = len(feature_names)
    if m == 0:
        return np.zeros((n, 0), dtype=float), feature_names

    matrix = np.zeros((n, m), dtype=float)
    col = 0
    for cat in categories:
        field = CATEGORY_FIELD_MAP[cat]
        vocab = cat_vocabs[cat]
        nc = len(vocab)
        if nc == 0:
            continue
        tag_to_idx = {tag: i for i, tag in enumerate(vocab)}
        for row, p in enumerate(poems):
            for t in getattr(p, field):
                tag = t.strip().lower()
                if tag in tag_to_idx:
                    matrix[row, col + tag_to_idx[tag]] = 1.0
        block = matrix[:, col : col + nc]
        norms = np.linalg.norm(block, axis=1, keepdims=True)
        norms[norms < _EPS] = 1.0
        matrix[:, col : col + nc] = block / norms
        col += nc

    return matrix, feature_names


def _auto_k(matrix: np.ndarray, n: int) -> int:
    max_k = min(n - 1, max(3, n // 3), 10)
    if max_k < 2:
        return 2
    best_k, best_score = 2, -2.0
    for k in range(2, max_k + 1):
        labels = AgglomerativeClustering(n_clusters=k, linkage="ward").fit_predict(matrix)
        if len(set(labels)) < 2:
            continue
        try:
            score = silhouette_score(matrix, labels)
        except Exception:
            continue
        if score > best_score:
            best_score, best_k = score, k
    return best_k


def _features_and_label(
    cluster_rows: np.ndarray,
    all_rows: np.ndarray,
    feature_names: List[str],
    top_n: int,
) -> Tuple[str, List[str]]:
    if len(cluster_rows) == 0 or not feature_names:
        return "cluster", []

    # Presence = nonzero after normalisation
    cluster_freq = (cluster_rows > _EPS).mean(axis=0)
    global_freq = (all_rows > _EPS).mean(axis=0)
    lift = cluster_freq / (global_freq + _EPS)

    ranked_idx = np.argsort(-lift)
    top_feats = [
        feature_names[i] for i in ranked_idx[:top_n] if cluster_freq[i] > _EPS
    ]

    # Label: up to 3 features with freq >= 0.5 in the cluster, ranked by lift
    majority = [i for i in ranked_idx if cluster_freq[i] >= 0.5][:3]
    if majority:
        label = " / ".join(feature_names[i].split(":", 1)[-1] for i in majority)
    elif len(ranked_idx) > 0 and cluster_freq[ranked_idx[0]] > _EPS:
        label = feature_names[ranked_idx[0]].split(":", 1)[-1]
    else:
        label = "cluster"

    return label, top_feats


def _poem_summaries(poems: List[Poem]) -> List[PoemSummary]:
    ordered = sorted(
        poems,
        key=lambda p: (-p.rating, -p.date.timestamp(), str(p.id)),
    )
    return [PoemSummary(id=p.id, title=p.title, rating=p.rating, date=p.date) for p in ordered]


def _awards_summary(poems: List[Poem]) -> List[str]:
    return sorted(a.medal for p in poems for a in p.awards)


def run_clustering(poems: List[Poem], req: ClusterRequest) -> ClusterResponse:
    n = len(poems)
    matrix, feature_names = _build_matrix(poems, req.categories)

    if n < 3 or matrix.shape[1] == 0:
        return ClusterResponse(
            clusters=[
                Cluster(
                    label="all",
                    size=n,
                    features=[],
                    awards_summary=_awards_summary(poems),
                    poems=_poem_summaries(poems),
                )
            ],
            excluded=[],
            k_used=1,
            categories_used=req.categories,
        )

    k = min(req.k, n - 1) if req.k is not None else _auto_k(matrix, n)
    labels = AgglomerativeClustering(n_clusters=k, linkage="ward").fit_predict(matrix)

    groups: Dict[int, List[int]] = {}
    for i, lbl in enumerate(labels):
        groups.setdefault(int(lbl), []).append(i)

    clusters: List[Cluster] = []
    excluded: List[ExcludedPoem] = []

    for indices in groups.values():
        group_poems = [poems[i] for i in indices]
        if len(group_poems) < req.min_cluster_size:
            for p in sorted(group_poems, key=lambda p: str(p.id)):
                excluded.append(ExcludedPoem(id=p.id, title=p.title, reason="cluster too small"))
            continue

        label, top_feats = _features_and_label(
            matrix[indices], matrix, feature_names, req.top_features
        )
        clusters.append(
            Cluster(
                label=label,
                size=len(group_poems),
                features=top_feats,
                awards_summary=_awards_summary(group_poems),
                poems=_poem_summaries(group_poems),
            )
        )

    clusters.sort(key=lambda c: (-c.size, c.label))
    excluded.sort(key=lambda e: str(e.id))

    return ClusterResponse(
        clusters=clusters,
        excluded=excluded,
        k_used=k,
        categories_used=req.categories,
    )
