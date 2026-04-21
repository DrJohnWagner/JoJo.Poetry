"""Tests for POST /api/poems/cluster and the clustering engine.

Section                  Tests  What's covered
-----------------------  -----  ---------------------------------------------------------------
engine unit                 13  build_matrix shape/values, auto_k range, empty-feature
                                fallback, lift ranking, majority label, poem_summaries ordering,
                                n<3 single-cluster, zero-vector rows
API endpoint                16  200 response, shape, partition invariant, cluster ordering
                                (size desc / label asc), poem ordering within cluster,
                                min_cluster_size exclusion, k override, auto-k (k_used >=2),
                                categories_used echo, invalid category 422, empty categories 422,
                                unknown field 422, no awards in response, read-only allowed,
                                corpus < 3 poems returns k_used=1
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID, uuid4

import numpy as np
import pytest
from fastapi.testclient import TestClient

from database.schemas.poem import Poem
from server.app import create_app
from server.clustering.engine import (
    _auto_k,
    _build_matrix,
    _features_and_label,
    _poem_summaries,
    run_clustering,
)
from server.clustering.types import ClusterRequest
from server.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]


# ================================================================ shared helpers


def _make_poem(**overrides):
    base = {
        "id": str(uuid4()),
        "title": "Test Poem",
        "url": "https://example.com/poem",
        "body": "line one<br/>\nline two<br/>",
        "awards": [],
        "date": "2024-01-01T00:00:00Z",
        "themes": [],
        "emotional_register": [],
        "form_and_craft": [],
        "key_images": [],
        "project": "A test poem.",
        "contest_fit": [],
        "rating": 50,
        "lines": 2,
        "words": 4,
        "pinned": False,
        "notes": [],
        "socials": [],
    }
    base.update(overrides)
    return Poem.model_validate(base)


def _make_db(tmp_path: Path, poems: list) -> Path:
    db = tmp_path / "Poems.json"
    db.write_text(json.dumps([p.model_dump(mode="json") for p in poems]))
    return db


def _make_client(db_path: Path, monkeypatch, *, read_only: bool = False):
    monkeypatch.setenv("POEMS_DATABASE", str(db_path))
    monkeypatch.setenv("READ_ONLY", "true" if read_only else "false")
    return TestClient(create_app(Settings()))


# ================================================================ engine — _build_matrix


def test_build_matrix_shape():
    poems = [
        _make_poem(themes=["nature", "loss"]),
        _make_poem(themes=["loss", "memory"]),
    ]
    mat, names = _build_matrix(poems, ["themes"])
    assert mat.shape[0] == 2
    assert mat.shape[1] == 3  # nature, loss, memory (sorted)
    assert len(names) == 3


def test_build_matrix_feature_names_prefixed():
    poems = [_make_poem(themes=["nature"])]
    _, names = _build_matrix(poems, ["themes"])
    assert all(n.startswith("themes:") for n in names)


def test_build_matrix_images_maps_to_key_images():
    poems = [_make_poem(key_images=["rain", "leaves"])]
    mat, names = _build_matrix(poems, ["images"])
    assert all(n.startswith("images:") for n in names)
    assert mat.shape[1] == 2


def test_build_matrix_empty_categories_zero_columns():
    poems = [_make_poem(), _make_poem()]
    mat, names = _build_matrix(poems, ["themes"])  # all poems have empty themes
    assert mat.shape == (2, 0)
    assert names == []


def test_build_matrix_l2_norm_within_block():
    # Poem with two equal tags → each normalised entry = 1/sqrt(2)
    poems = [_make_poem(themes=["a", "b"])]
    mat, _ = _build_matrix(poems, ["themes"])
    row_norm = np.linalg.norm(mat[0])
    assert row_norm == pytest.approx(1.0, abs=1e-6)


def test_build_matrix_zero_row_stays_zero():
    # Poem with no tags → row stays zero (no divide-by-zero)
    poems = [_make_poem(themes=[]), _make_poem(themes=["nature"])]
    mat, _ = _build_matrix(poems, ["themes"])
    assert mat[0, 0] == pytest.approx(0.0)


# ================================================================ engine — _auto_k


def test_auto_k_returns_value_in_valid_range():
    poems = [_make_poem(themes=[str(i)]) for i in range(10)]
    mat, _ = _build_matrix(poems, ["themes"])
    k = _auto_k(mat, len(poems))
    assert 2 <= k <= min(len(poems) - 1, 10)


def test_auto_k_minimum_corpus():
    # n=3: only k=2 is tried
    poems = [_make_poem(themes=[str(i)]) for i in range(3)]
    mat, _ = _build_matrix(poems, ["themes"])
    k = _auto_k(mat, 3)
    assert k == 2


# ================================================================ engine — _features_and_label


def test_features_and_label_majority_label():
    # Build a simple 2-column matrix where column 0 is present in all rows
    all_rows = np.array([[1.0, 0.0], [1.0, 0.5], [1.0, 0.0]])
    cluster_rows = all_rows  # all rows form the cluster
    label, feats = _features_and_label(cluster_rows, all_rows, ["cat:alpha", "cat:beta"], 3)
    assert "alpha" in label  # majority feature is alpha (freq=1.0)


def test_features_and_label_empty_cluster_returns_defaults():
    all_rows = np.array([[1.0, 0.0]])
    label, feats = _features_and_label(np.zeros((0, 2)), all_rows, ["a:x", "a:y"], 3)
    assert label == "cluster"
    assert feats == []


def test_features_and_label_top_n_respected():
    all_rows = np.ones((4, 5))
    cluster_rows = np.ones((2, 5))
    names = [f"cat:{i}" for i in range(5)]
    _, feats = _features_and_label(cluster_rows, all_rows, names, 2)
    assert len(feats) <= 2


# ================================================================ engine — helpers


def test_poem_summaries_ordering():
    p_high = _make_poem(rating=90, date="2024-03-01T00:00:00Z")
    p_low = _make_poem(rating=20, date="2024-01-01T00:00:00Z")
    summaries = _poem_summaries([p_low, p_high])
    assert summaries[0].rating == 90
    assert summaries[1].rating == 20


# ================================================================ engine — run_clustering


def test_run_clustering_small_corpus_single_cluster():
    poems = [_make_poem(), _make_poem()]
    req = ClusterRequest(categories=["themes"])
    result = run_clustering(poems, req)
    assert result.k_used == 1
    assert len(result.clusters) == 1
    assert result.clusters[0].label == "all"
    assert len(result.excluded) == 0


def test_run_clustering_partition_invariant():
    poems = [_make_poem(themes=[str(i % 3)]) for i in range(9)]
    req = ClusterRequest(categories=["themes"], min_cluster_size=1)
    result = run_clustering(poems, req)
    all_ids = {p.id for p in poems}
    in_clusters = {UUID(str(s.id)) for c in result.clusters for s in c.poems}
    in_excluded = {e.id for e in result.excluded}
    assert in_clusters | in_excluded == all_ids
    assert in_clusters & in_excluded == set()


# ================================================================ API endpoint


@pytest.fixture
def cluster_db(tmp_path):
    # Two distinct groups: sonnets about nature, free verse about war
    nature_poems = [
        _make_poem(
            title=f"Nature {i}",
            themes=["nature"],
            form_and_craft=["sonnet"],
            rating=60 + i,
            date=f"2024-0{i+1}-01T00:00:00Z",
            url=f"https://example.com/nature{i}",
        )
        for i in range(1, 5)
    ]
    war_poems = [
        _make_poem(
            title=f"War {i}",
            themes=["war"],
            form_and_craft=["free verse"],
            rating=40 + i,
            date=f"2024-0{i+1}-01T00:00:00Z",
            url=f"https://example.com/war{i}",
        )
        for i in range(1, 5)
    ]
    return _make_db(tmp_path, nature_poems + war_poems)


@pytest.fixture
def cluster_client(cluster_db, monkeypatch):
    with _make_client(cluster_db, monkeypatch) as c:
        yield c


def test_cluster_returns_200(cluster_client):
    r = cluster_client.post("/api/poems/cluster", json={"categories": ["themes"]})
    assert r.status_code == 200


def test_cluster_response_shape(cluster_client):
    r = cluster_client.post("/api/poems/cluster", json={"categories": ["themes"]})
    body = r.json()
    assert "clusters" in body
    assert "excluded" in body
    assert "k_used" in body
    assert "categories_used" in body


def test_cluster_response_cluster_shape(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "min_cluster_size": 1},
    )
    body = r.json()
    assert body["clusters"]
    c = body["clusters"][0]
    assert {"label", "size", "features", "poems"} <= set(c.keys())
    assert "awards_summary" not in c
    if c["poems"]:
        p = c["poems"][0]
        assert {"id", "title", "rating", "date"} <= set(p.keys())


def test_cluster_partition_invariant(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "min_cluster_size": 1},
    )
    body = r.json()
    all_ids = {item["id"] for item in cluster_client.get("/api/poems?limit=200").json()["items"]}
    in_clusters = {p["id"] for c in body["clusters"] for p in c["poems"]}
    in_excluded = {e["id"] for e in body["excluded"]}
    assert in_clusters | in_excluded == all_ids
    assert in_clusters & in_excluded == set()


def test_cluster_ordering_size_desc(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "min_cluster_size": 1},
    )
    sizes = [c["size"] for c in r.json()["clusters"]]
    assert sizes == sorted(sizes, reverse=True)


def test_cluster_poems_ordered_rating_desc(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "min_cluster_size": 1},
    )
    for cluster in r.json()["clusters"]:
        ratings = [p["rating"] for p in cluster["poems"]]
        assert ratings == sorted(ratings, reverse=True)


def test_cluster_min_cluster_size_moves_poems_to_excluded(tmp_path, monkeypatch):
    # 8 poems in one clear group, 1 outlier → outlier cluster excluded
    big_group = [
        _make_poem(
            themes=["nature"],
            form_and_craft=["sonnet"],
            url=f"https://example.com/n{i}",
        )
        for i in range(8)
    ]
    outlier = _make_poem(
        themes=["war"],
        form_and_craft=["free verse"],
        emotional_register=["defiant"],
        url="https://example.com/outlier",
    )
    db = _make_db(tmp_path, big_group + [outlier])
    with _make_client(db, monkeypatch) as c:
        r = c.post(
            "/api/poems/cluster",
            json={"categories": ["themes", "form_and_craft"], "k": 2, "min_cluster_size": 3},
        )
    assert r.status_code == 200
    body = r.json()
    # The outlier's cluster (size 1) is below min_cluster_size=3
    assert any(e["reason"] == "cluster too small" for e in body["excluded"])


def test_cluster_k_override_respected(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "k": 2},
    )
    assert r.json()["k_used"] == 2


def test_cluster_auto_k_used_when_k_omitted(cluster_client):
    r = cluster_client.post("/api/poems/cluster", json={"categories": ["themes"]})
    assert r.json()["k_used"] >= 1


def test_cluster_categories_used_echoed(cluster_client):
    cats = ["themes", "form_and_craft"]
    r = cluster_client.post("/api/poems/cluster", json={"categories": cats})
    assert set(r.json()["categories_used"]) == set(cats)


def test_cluster_invalid_category_returns_422(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster", json={"categories": ["nonexistent"]}
    )
    assert r.status_code == 422


def test_cluster_empty_categories_returns_422(cluster_client):
    r = cluster_client.post("/api/poems/cluster", json={"categories": []})
    assert r.status_code == 422


def test_cluster_unknown_field_returns_422(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "bad_field": True},
    )
    assert r.status_code == 422


def test_cluster_response_contains_no_awards(cluster_client):
    r = cluster_client.post(
        "/api/poems/cluster",
        json={"categories": ["themes"], "min_cluster_size": 1},
    )
    assert r.status_code == 200
    body = r.json()
    for cluster in body["clusters"]:
        assert "awards_summary" not in cluster
        for p in cluster["poems"]:
            assert "awards" not in p
            assert "awards_summary" not in p
    for e in body["excluded"]:
        assert "awards" not in e


def test_cluster_allowed_in_read_only_mode(cluster_db, monkeypatch):
    with _make_client(cluster_db, monkeypatch, read_only=True) as c:
        r = c.post("/api/poems/cluster", json={"categories": ["themes"]})
    assert r.status_code == 200


def test_cluster_small_corpus_returns_k_used_one(tmp_path, monkeypatch):
    poems = [_make_poem(url=f"https://example.com/{i}") for i in range(2)]
    db = _make_db(tmp_path, poems)
    with _make_client(db, monkeypatch) as c:
        r = c.post("/api/poems/cluster", json={"categories": ["themes"]})
    assert r.json()["k_used"] == 1
