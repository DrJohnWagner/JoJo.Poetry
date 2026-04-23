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
    ClusterTotals,
    ExcludedPoem,
    PoemSummary,
)

_EPS = 1e-9
DEFAULT_MIN_CLUSTER_SIZE = 2
DEFAULT_TOP_FEATURES = 3


def _normalise_tags(values: List[str]) -> List[str]:
    cleaned: List[str] = []
    for value in values:
        tag = value.strip().lower()
        if tag:
            cleaned.append(tag)
    return sorted(set(cleaned))


def _poem_tags_for_categories(
    poem: Poem, categories: List[str]
) -> Dict[str, List[str]]:
    tags_by_category: Dict[str, List[str]] = {}
    for category in categories:
        field = CATEGORY_FIELD_MAP[category]
        raw_values = list(getattr(poem, field))
        tags_by_category[category] = _normalise_tags(raw_values)
    return tags_by_category


def _has_signal(poem: Poem, categories: List[str]) -> bool:
    tags_by_category = _poem_tags_for_categories(poem, categories)
    return any(tags_by_category[category] for category in categories)


def _build_matrix(
    poems: List[Poem], categories: List[str]
) -> Tuple[np.ndarray, List[str]]:
    """Build a binary feature matrix with per-category-block L2 normalisation.

    Returns:
        matrix:
            Shape (n_poems, n_features)
        feature_names:
            Names in the form "{category}:{tag}"
    """
    cat_vocabs: Dict[str, List[str]] = {}

    for category in categories:
        field = CATEGORY_FIELD_MAP[category]
        tags: set[str] = set()
        for poem in poems:
            for tag in getattr(poem, field):
                normalised = tag.strip().lower()
                if normalised:
                    tags.add(normalised)
        cat_vocabs[category] = sorted(tags)

    feature_names: List[str] = []
    for category in categories:
        for tag in cat_vocabs[category]:
            feature_names.append(f"{category}:{tag}")

    n_poems = len(poems)
    n_features = len(feature_names)

    if n_features == 0:
        return np.zeros((n_poems, 0), dtype=float), feature_names

    matrix = np.zeros((n_poems, n_features), dtype=float)

    col = 0
    for category in categories:
        field = CATEGORY_FIELD_MAP[category]
        vocab = cat_vocabs[category]
        n_category_features = len(vocab)

        if n_category_features == 0:
            continue

        tag_to_idx = {tag: i for i, tag in enumerate(vocab)}

        for row, poem in enumerate(poems):
            for tag in getattr(poem, field):
                normalised = tag.strip().lower()
                if normalised and normalised in tag_to_idx:
                    matrix[row, col + tag_to_idx[normalised]] = 1.0

        block = matrix[:, col : col + n_category_features]
        norms = np.linalg.norm(block, axis=1, keepdims=True)
        norms[norms < _EPS] = 1.0
        matrix[:, col : col + n_category_features] = block / norms

        col += n_category_features

    return matrix, feature_names


def _auto_k(matrix: np.ndarray, n_poems: int) -> int:
    max_k = min(n_poems - 1, max(3, n_poems // 3), 10)
    if max_k < 2:
        return 0

    best_k = 2
    best_score = -2.0

    for k in range(2, max_k + 1):
        labels = AgglomerativeClustering(
            n_clusters=k,
            linkage="ward",
        ).fit_predict(matrix)

        if len(set(labels)) < 2:
            continue

        try:
            score = silhouette_score(matrix, labels)
        except Exception:
            continue

        if score > best_score:
            best_score = score
            best_k = k

    return best_k


def _features_and_label(
    cluster_rows: np.ndarray,
    all_rows: np.ndarray,
    feature_names: List[str],
    top_n: int,
) -> Tuple[str, List[str]]:
    if len(cluster_rows) == 0 or not feature_names:
        return "cluster", []

    cluster_freq = (cluster_rows > _EPS).mean(axis=0)
    global_freq = (all_rows > _EPS).mean(axis=0)
    lift = cluster_freq / (global_freq + _EPS)

    ranked_idx = sorted(
        range(len(feature_names)),
        key=lambda i: (-float(lift[i]), feature_names[i]),
    )

    top_feats = [feature_names[i] for i in ranked_idx if cluster_freq[i] > _EPS][:top_n]

    majority = [i for i in ranked_idx if cluster_freq[i] >= 0.5][:3]

    if majority:
        label = " / ".join(feature_names[i].split(":", 1)[-1] for i in majority)
    elif ranked_idx and cluster_freq[ranked_idx[0]] > _EPS:
        label = feature_names[ranked_idx[0]].split(":", 1)[-1]
    else:
        label = "cluster"

    return label, top_feats


def _poem_summaries(poems: List[Poem]) -> List[PoemSummary]:
    ordered = sorted(
        poems,
        key=lambda poem: (-poem.rating, -poem.date.timestamp(), str(poem.id)),
    )
    return [
        PoemSummary(
            id=poem.id,
            title=poem.title,
            pinned=poem.pinned,
            project=poem.project,
            themes=poem.themes,
            emotional_registers=poem.emotional_registers,
            formal_modes=poem.formal_modes,
            craft_features=poem.craft_features,
            stylistic_postures=poem.stylistic_postures,
        )
        for poem in ordered
    ]


def _empty_response(
    *,
    total_poems: int,
    eligible_poems: int,
    excluded: List[ExcludedPoem],
    k_used: int,
    categories_used: List[str],
) -> ClusterResponse:
    excluded_zero_signal_poems = sum(
        1 for poem in excluded if poem.reason == "zero signal"
    )
    excluded_small_cluster_poems = sum(
        1 for poem in excluded if poem.reason == "cluster too small"
    )

    return ClusterResponse(
        totals=ClusterTotals(
            total_poems=total_poems,
            eligible_poems=eligible_poems,
            excluded_zero_signal_poems=excluded_zero_signal_poems,
            excluded_small_cluster_poems=excluded_small_cluster_poems,
            clustered_poems=0,
            cluster_count=0,
        ),
        clusters=[],
        excluded=sorted(excluded, key=lambda poem: str(poem.id)),
        k_used=k_used,
        categories_used=categories_used,
    )


def run_clustering(poems: List[Poem], req: ClusterRequest) -> ClusterResponse:
    categories = sorted(dict.fromkeys(req.categories))

    total_poems = len(poems)
    eligible_poems: List[Poem] = []
    excluded: List[ExcludedPoem] = []

    for poem in poems:
        if _has_signal(poem, categories):
            eligible_poems.append(poem)
        else:
            excluded.append(
                ExcludedPoem(
                    id=poem.id,
                    title=poem.title,
                    reason="zero signal",
                )
            )

    eligible_poems.sort(key=lambda poem: str(poem.id))
    eligible_count = len(eligible_poems)

    if eligible_count == 0:
        return _empty_response(
            total_poems=total_poems,
            eligible_poems=0,
            excluded=excluded,
            k_used=0,
            categories_used=categories,
        )

    matrix, feature_names = _build_matrix(eligible_poems, categories)

    if matrix.shape[1] == 0:
        return _empty_response(
            total_poems=total_poems,
            eligible_poems=eligible_count,
            excluded=excluded,
            k_used=0,
            categories_used=categories,
        )

    if eligible_count < 3:
        for poem in eligible_poems:
            excluded.append(
                ExcludedPoem(
                    id=poem.id,
                    title=poem.title,
                    reason="cluster too small",
                )
            )

        return _empty_response(
            total_poems=total_poems,
            eligible_poems=eligible_count,
            excluded=excluded,
            k_used=0,
            categories_used=categories,
        )

    if req.k is not None:
        k = min(req.k, eligible_count - 1)
    else:
        k = _auto_k(matrix, eligible_count)

    if k < 2:
        for poem in eligible_poems:
            excluded.append(
                ExcludedPoem(
                    id=poem.id,
                    title=poem.title,
                    reason="cluster too small",
                )
            )

        return _empty_response(
            total_poems=total_poems,
            eligible_poems=eligible_count,
            excluded=excluded,
            k_used=0,
            categories_used=categories,
        )

    labels = AgglomerativeClustering(
        n_clusters=k,
        linkage="ward",
    ).fit_predict(matrix)

    groups: Dict[int, List[int]] = {}
    for row_idx, label in enumerate(labels):
        groups.setdefault(int(label), []).append(row_idx)

    clusters: List[Cluster] = []

    for indices in groups.values():
        group_poems = [eligible_poems[i] for i in indices]

        if len(group_poems) < req.min_cluster_size:
            for poem in sorted(group_poems, key=lambda p: str(p.id)):
                excluded.append(
                    ExcludedPoem(
                        id=poem.id,
                        title=poem.title,
                        reason="cluster too small",
                    )
                )
            continue

        label, top_feats = _features_and_label(
            matrix[indices],
            matrix,
            feature_names,
            DEFAULT_TOP_FEATURES,
        )

        clusters.append(
            Cluster(
                cluster_id="",
                label=label,
                size=len(group_poems),
                features=top_feats,
                poems=_poem_summaries(group_poems),
            )
        )

    clusters.sort(
        key=lambda cluster: (
            -cluster.size,
            cluster.label,
            ",".join(str(poem.id) for poem in cluster.poems),
        )
    )

    for idx, cluster in enumerate(clusters, start=1):
        cluster.cluster_id = f"cluster_{idx}"

    excluded.sort(key=lambda poem: (poem.reason, str(poem.id)))

    excluded_zero_signal_poems = sum(
        1 for poem in excluded if poem.reason == "zero signal"
    )
    excluded_small_cluster_poems = sum(
        1 for poem in excluded if poem.reason == "cluster too small"
    )
    clustered_poems = sum(cluster.size for cluster in clusters)

    return ClusterResponse(
        totals=ClusterTotals(
            total_poems=total_poems,
            eligible_poems=eligible_count,
            excluded_zero_signal_poems=excluded_zero_signal_poems,
            excluded_small_cluster_poems=excluded_small_cluster_poems,
            clustered_poems=clustered_poems,
            cluster_count=len(clusters),
        ),
        clusters=clusters,
        excluded=excluded,
        k_used=k,
        categories_used=categories,
    )
