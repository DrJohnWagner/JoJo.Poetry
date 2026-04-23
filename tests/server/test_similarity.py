"""Tests for the poem similarity system.

68 tests across 8 sections:

Section                 Tests  What's covered
----------------------  -----  ---------------------------------------------------------------
normalise.py               13  case-fold, strip, dedup, empty removal, sorted text fields,
                               id/title preservation, synonym expansion (1:1 and 1:many)
structured.py              11  Jaccard edge cases (both empty, one empty, identical, partial,
                               disjoint), overlap sorting, all five axes
semantic.py                10  unfitted zeros, unknown-id zeros, single-poem no-crash,
                               identical text → 1.0, different → <1.0, rebuild replaces state,
                               all-empty corpus, form/image char n-grams
fusion.py                   9  all-zeros, weight sum = 1.0, theme/register pure-structured
                               (no semantic bleed), form/imagery blend arithmetic, full overall
                               arithmetic, non-negative scores
service.py (unit)          16  empty rebuild, single poem → no neighbours, unknown id → None,
                               self-exclusion, k limits, k > pool, score-desc ordering,
                               id-asc tie-break, query_id set, score=breakdown per all 5 axes,
                               rebuild replaces state, mutual neighbours, module globals
                               (uninitialized raise, noop rebuild, init+get)
API endpoints              16  200 on all 6 routes, bare≡overall, 404 unknown, 422 malformed,
                               422 k=0/k=51, k=1 cap, query_id in response, response shape,
                               excluded Poem fields, self not in neighbours, read-only mode
                               works, ranking (Beta > Gamma for Alpha), breakdown fields,
                               structured overlap fields
Mutation → rebuild          6  POST → new poem appears as neighbour, PATCH → updated tags
                               reflected, DELETE → victim absent from results, DELETE →
                               querying victim returns 404, POST → new poem queryable

Modules under test:
  - server/similarity/normalise.py    — normalisation helpers
  - server/similarity/structured.py  — Jaccard / StructuredScoreBreakdown
  - server/similarity/semantic.py    — SemanticSimilarityIndex (TF-IDF)
  - server/similarity/fusion.py      — compute_fused_similarity / weights
  - server/similarity/service.py     — PoemSimilarityService + module globals
  - API endpoints                    — GET /api/poems/{id}/similar[/axis]
  - Mutation → rebuild integration
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import Settings
from server.similarity.fusion import OVERALL_AXES_WEIGHTS, compute_fused_similarity
from server.similarity.normalise import normalise_poem
from server.similarity.semantic import SemanticSimilarityIndex
from server.similarity.service import PoemSimilarityService
from server.similarity.structured import compute_structured_similarity, jaccard_similarity
from server.similarity.types import (
    FusedScoreBreakdown,
    NeighbourListResult,
    NeighbourResult,
    SemanticScoreBreakdown,
    StructuredScoreBreakdown,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


# ================================================================ shared helpers


def _make_poem(**overrides):
    from database.schemas.poem import Poem

    base = {
        "id": str(uuid4()),
        "title": "Test Poem",
        "url": "https://example.com/poem",
        "body": "first line<br/>\nsecond line<br/>",
        "awards": [],
        "date": "2024-01-01T00:00:00Z",
        "themes": [],
        "emotional_registers": [],
        "formal_modes": [],
        "craft_features": [],
        "stylistic_postures": [],
        "key_images": [],
        "project": "A poem for testing purposes.",
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


def _make_db(tmp_path: Path, poems) -> Path:
    db = tmp_path / "Poems.json"
    records = [p.model_dump(mode="json") for p in poems]
    db.write_text(json.dumps(records))
    return db


def _make_structured(**overrides) -> StructuredScoreBreakdown:
    defaults = dict(
        theme_sim=0.0,
        emotion_sim=0.0,
        form_sim=0.0,
        imagery_sim=0.0,
        fit_sim=0.0,
        theme_overlap=[],
        emotion_overlap=[],
        form_overlap=[],
        imagery_overlap=[],
        fit_overlap=[],
    )
    defaults.update(overrides)
    return StructuredScoreBreakdown(**defaults)


def _make_semantic(**overrides) -> SemanticScoreBreakdown:
    defaults = dict(project_tfidf_sim=0.0, form_tfidf_sim=0.0, image_tfidf_sim=0.0)
    defaults.update(overrides)
    return SemanticScoreBreakdown(**defaults)


def _norm(poem):
    return normalise_poem(poem)


def _listing_ids(client) -> list[str]:
    return [p["id"] for p in client.get("/api/poems?limit=200").json()["items"]]


# ================================================================ normalise.py


def test_normalise_lowercases_terms():
    poem = _make_poem(themes=["Nature", "LOSS"])
    feat = _norm(poem)
    assert feat.themes == {"nature", "loss"}


def test_normalise_strips_whitespace_from_terms():
    poem = _make_poem(themes=["  grief  ", "\tlonging\n"])
    feat = _norm(poem)
    assert "grief" in feat.themes
    assert "longing" in feat.themes


def test_normalise_removes_empty_string_terms():
    poem = _make_poem(themes=["", "  ", "nature"])
    feat = _norm(poem)
    assert "" not in feat.themes
    assert feat.themes == {"nature"}


def test_normalise_deduplicates_after_case_fold():
    poem = _make_poem(themes=["Nature", "nature", "NATURE"])
    feat = _norm(poem)
    assert feat.themes == {"nature"}


def test_normalise_preserves_multi_word_phrases():
    poem = _make_poem(craft_features=["extended metaphor", "interior monologue"])
    feat = _norm(poem)
    assert "extended metaphor" in feat.form
    assert "interior monologue" in feat.form


def test_normalise_all_empty_tag_arrays_give_empty_sets():
    poem = _make_poem(
        themes=[],
        emotional_registers=[],
        formal_modes=[],
        craft_features=[],
        stylistic_postures=[],
        key_images=[],
        contest_fit=[],
    )
    feat = _norm(poem)
    assert feat.themes == set()
    assert feat.emotion == set()
    assert feat.form == set()
    assert feat.images == set()
    assert feat.fit == set()


def test_normalise_project_text_is_lowercased_and_stripped():
    poem = _make_poem(project="  A Poem About LOSS.  ")
    feat = _norm(poem)
    assert feat.project_text == "a poem about loss."


def test_normalise_form_text_is_sorted_and_joined():
    poem = _make_poem(formal_modes=["Sonnet", "Enjambment"])
    feat = _norm(poem)
    assert feat.form_text == "enjambment sonnet"


def test_normalise_image_text_is_sorted_and_joined():
    poem = _make_poem(key_images=["Rain", "Leaves", "Mud"])
    feat = _norm(poem)
    assert feat.image_text == "leaves mud rain"


def test_normalise_id_and_title_are_preserved():
    uid = uuid4()
    poem = _make_poem(id=str(uid), title="My Title")
    feat = _norm(poem)
    assert feat.id == uid
    assert feat.title == "My Title"


def test_normalise_maps_all_five_tag_fields():
    poem = _make_poem(
        themes=["a"],
        emotional_registers=["b"],
        formal_modes=["c"],
        key_images=["d"],
        contest_fit=["e"],
    )
    feat = _norm(poem)
    assert feat.themes == {"a"}
    assert feat.emotion == {"b"}
    assert feat.form == {"c"}
    assert feat.images == {"d"}
    assert feat.fit == {"e"}


def test_normalise_synonym_one_to_one_expansion(monkeypatch):
    import server.similarity.normalise as norm_module

    monkeypatch.setattr(norm_module, "SYNONYMS", {"grief": "loss"})
    poem = _make_poem(themes=["grief"])
    feat = _norm(poem)
    assert "loss" in feat.themes
    assert "grief" not in feat.themes


def test_normalise_synonym_one_to_many_expansion(monkeypatch):
    import server.similarity.normalise as norm_module

    monkeypatch.setattr(
        norm_module, "SYNONYMS", {"nature": ["nature", "outdoors", "landscape"]}
    )
    poem = _make_poem(themes=["nature"])
    feat = _norm(poem)
    assert feat.themes == {"nature", "outdoors", "landscape"}


# ================================================================ structured.py


def test_jaccard_both_empty_returns_zero():
    score, overlap = jaccard_similarity(set(), set())
    assert score == 0.0
    assert overlap == []


def test_jaccard_one_empty_one_non_empty_returns_zero():
    score, overlap = jaccard_similarity({"a"}, set())
    assert score == 0.0
    assert overlap == []
    score2, _ = jaccard_similarity(set(), {"b"})
    assert score2 == 0.0


def test_jaccard_identical_sets_returns_one():
    score, overlap = jaccard_similarity({"a", "b", "c"}, {"a", "b", "c"})
    assert score == pytest.approx(1.0)
    assert set(overlap) == {"a", "b", "c"}


def test_jaccard_partial_overlap_correct_fraction():
    # {a, b} ∩ {b, c} = {b};  union = {a, b, c} → 1/3
    score, overlap = jaccard_similarity({"a", "b"}, {"b", "c"})
    assert score == pytest.approx(1 / 3)
    assert overlap == ["b"]


def test_jaccard_no_overlap_returns_zero():
    score, overlap = jaccard_similarity({"x", "y"}, {"z"})
    assert score == 0.0
    assert overlap == []


def test_jaccard_overlap_list_is_sorted():
    _, overlap = jaccard_similarity({"c", "a", "b"}, {"a", "b", "c"})
    assert overlap == sorted(overlap)


def test_jaccard_single_element_exact_match():
    score, overlap = jaccard_similarity({"nature"}, {"nature"})
    assert score == pytest.approx(1.0)
    assert overlap == ["nature"]


def test_structured_identical_poems_max_scores_on_all_axes():
    p1 = _norm(
        _make_poem(
            themes=["a"],
            emotional_registers=["b"],
            formal_modes=["c"],
            key_images=["d"],
            contest_fit=["e"],
        )
    )
    p2 = _norm(
        _make_poem(
            themes=["a"],
            emotional_registers=["b"],
            formal_modes=["c"],
            key_images=["d"],
            contest_fit=["e"],
        )
    )
    result = compute_structured_similarity(p1, p2)
    assert result.theme_sim == pytest.approx(1.0)
    assert result.emotion_sim == pytest.approx(1.0)
    assert result.form_sim == pytest.approx(1.0)
    assert result.imagery_sim == pytest.approx(1.0)
    assert result.fit_sim == pytest.approx(1.0)


def test_structured_disjoint_poems_zero_on_all_axes():
    p1 = _norm(_make_poem(themes=["alpha"], formal_modes=["sonnet"]))
    p2 = _norm(_make_poem(themes=["beta"], formal_modes=["haiku"]))
    result = compute_structured_similarity(p1, p2)
    assert result.theme_sim == 0.0
    assert result.form_sim == 0.0


def test_structured_overlaps_populated_correctly():
    p1 = _norm(_make_poem(themes=["nature", "loss"]))
    p2 = _norm(_make_poem(themes=["nature", "memory"]))
    result = compute_structured_similarity(p1, p2)
    assert "nature" in result.theme_overlap
    assert "loss" not in result.theme_overlap
    assert "memory" not in result.theme_overlap


def test_structured_empty_vs_non_empty_is_zero():
    p1 = _norm(_make_poem(themes=[]))
    p2 = _norm(_make_poem(themes=["something"]))
    result = compute_structured_similarity(p1, p2)
    assert result.theme_sim == 0.0
    assert result.theme_overlap == []


def test_structured_partial_overlap_reflected_in_score():
    # themes overlap 1 of 3 → Jaccard = 1/3
    p1 = _norm(_make_poem(themes=["a", "b"]))
    p2 = _norm(_make_poem(themes=["b", "c"]))
    result = compute_structured_similarity(p1, p2)
    assert result.theme_sim == pytest.approx(1 / 3)


# ================================================================ semantic.py


def test_semantic_fit_empty_list_not_fitted():
    index = SemanticSimilarityIndex()
    index.fit([])
    assert not index.is_fitted


def test_semantic_get_similarity_when_not_fitted_returns_zeros():
    index = SemanticSimilarityIndex()
    result = index.get_similarity(uuid4(), uuid4())
    assert result.project_tfidf_sim == 0.0
    assert result.form_tfidf_sim == 0.0
    assert result.image_tfidf_sim == 0.0


def test_semantic_get_similarity_unknown_ids_return_zeros():
    p1 = _norm(_make_poem(project="a poem about the sea"))
    p2 = _norm(_make_poem(project="a poem about mountains"))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(uuid4(), uuid4())
    assert result.project_tfidf_sim == 0.0


def test_semantic_fit_single_poem_does_not_raise():
    p = _norm(
        _make_poem(
            project="a poem about the sea",
            formal_modes=["sonnet"],
            key_images=["waves"],
        )
    )
    index = SemanticSimilarityIndex()
    index.fit([p])
    assert index.is_fitted


def test_semantic_identical_project_texts_give_high_similarity():
    text = "a meditation on grief and memory through water imagery"
    p1 = _norm(_make_poem(project=text))
    p2 = _norm(_make_poem(project=text))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(p1.id, p2.id)
    assert result.project_tfidf_sim == pytest.approx(1.0, abs=0.01)


def test_semantic_different_project_texts_give_lower_similarity():
    p1 = _norm(_make_poem(project="grief and loss in winter landscapes"))
    p2 = _norm(_make_poem(project="celebrating summer and joy in tropical warmth"))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(p1.id, p2.id)
    assert result.project_tfidf_sim < 1.0


def test_semantic_rebuild_replaces_previous_state():
    p1 = _norm(_make_poem(project="grief and memory"))
    p2 = _norm(_make_poem(project="joy and laughter"))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    p3 = _norm(_make_poem(project="mountains and rivers"))
    p4 = _norm(_make_poem(project="deserts and dunes"))
    index.fit([p3, p4])
    # Old IDs are now unknown; should return zeros
    result = index.get_similarity(p1.id, p2.id)
    assert result.project_tfidf_sim == 0.0


def test_semantic_all_empty_texts_return_zeros():
    p1 = _norm(_make_poem(project="", formal_modes=[], key_images=[]))
    p2 = _norm(_make_poem(project="", formal_modes=[], key_images=[]))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(p1.id, p2.id)
    assert result.project_tfidf_sim == 0.0
    assert result.form_tfidf_sim == 0.0
    assert result.image_tfidf_sim == 0.0


def test_semantic_form_similarity_uses_char_ngrams():
    # Two poems with identical formal_modes tags should have form_tfidf_sim ≈ 1.0
    p1 = _norm(_make_poem(formal_modes=["villanelle", "refrain"]))
    p2 = _norm(_make_poem(formal_modes=["villanelle", "refrain"]))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(p1.id, p2.id)
    assert result.form_tfidf_sim == pytest.approx(1.0, abs=0.01)


def test_semantic_image_similarity_uses_char_ngrams():
    p1 = _norm(_make_poem(key_images=["rain", "leaves"]))
    p2 = _norm(_make_poem(key_images=["rain", "leaves"]))
    index = SemanticSimilarityIndex()
    index.fit([p1, p2])
    result = index.get_similarity(p1.id, p2.id)
    assert result.image_tfidf_sim == pytest.approx(1.0, abs=0.01)


# ================================================================ fusion.py


def test_fusion_all_zeros_gives_zero_overall():
    result = compute_fused_similarity(_make_structured(), _make_semantic())
    assert result.overall_score == pytest.approx(0.0)


def test_fusion_overall_axes_weights_sum_to_one():
    assert sum(OVERALL_AXES_WEIGHTS.values()) == pytest.approx(1.0)


def test_fusion_theme_score_is_pure_structured_no_semantic_bleed():
    # Theme semantic weight is 0.0 — semantic scores must not affect theme_score
    struct = _make_structured(theme_sim=0.5)
    sem = _make_semantic(project_tfidf_sim=1.0, form_tfidf_sim=1.0, image_tfidf_sim=1.0)
    result = compute_fused_similarity(struct, sem)
    assert result.theme_score == pytest.approx(0.5)


def test_fusion_emotion_score_is_pure_structured():
    struct = _make_structured(emotion_sim=0.7)
    sem = _make_semantic(project_tfidf_sim=1.0, form_tfidf_sim=1.0, image_tfidf_sim=1.0)
    result = compute_fused_similarity(struct, sem)
    assert result.emotion_score == pytest.approx(0.7)


def test_fusion_form_score_blends_structured_and_semantic():
    # form_score = 0.8 * form_sim + 0.2 * form_tfidf_sim
    struct = _make_structured(form_sim=1.0)
    sem = _make_semantic(form_tfidf_sim=0.5)
    result = compute_fused_similarity(struct, sem)
    assert result.form_score == pytest.approx(0.8 * 1.0 + 0.2 * 0.5)


def test_fusion_imagery_score_blends_structured_and_semantic():
    # imagery_score = 0.8 * imagery_sim + 0.2 * image_tfidf_sim
    struct = _make_structured(imagery_sim=0.6)
    sem = _make_semantic(image_tfidf_sim=1.0)
    result = compute_fused_similarity(struct, sem)
    assert result.imagery_score == pytest.approx(0.8 * 0.6 + 0.2 * 1.0)


def test_fusion_overall_arithmetic():
    struct = _make_structured(
        theme_sim=1.0,
        emotion_sim=0.5,
        form_sim=0.8,
        imagery_sim=0.6,
        fit_sim=0.4,
        theme_overlap=["a"],
        emotion_overlap=["b"],
        form_overlap=["c"],
        imagery_overlap=["d"],
        fit_overlap=["e"],
    )
    sem = _make_semantic(project_tfidf_sim=0.3, form_tfidf_sim=0.4, image_tfidf_sim=0.5)
    result = compute_fused_similarity(struct, sem)

    theme_score = 1.0
    form_score = 0.8 * 0.8 + 0.2 * 0.4
    emotion_score = 0.5
    imagery_score = 0.8 * 0.6 + 0.2 * 0.5
    fit_score = 0.4
    project_score = 0.3
    expected = (
        theme_score * 0.30
        + form_score * 0.20
        + emotion_score * 0.15
        + imagery_score * 0.15
        + fit_score * 0.10
        + project_score * 0.10
    )
    assert result.overall_score == pytest.approx(expected)


def test_fusion_structured_and_semantic_preserved_in_breakdown():
    struct = _make_structured(theme_sim=0.9, theme_overlap=["a"])
    sem = _make_semantic(project_tfidf_sim=0.7)
    result = compute_fused_similarity(struct, sem)
    assert result.structured.theme_sim == pytest.approx(0.9)
    assert result.semantic.project_tfidf_sim == pytest.approx(0.7)


def test_fusion_scores_are_non_negative():
    struct = _make_structured(theme_sim=0.5, form_sim=0.3, imagery_sim=0.8)
    sem = _make_semantic(project_tfidf_sim=0.2, form_tfidf_sim=0.6, image_tfidf_sim=0.4)
    result = compute_fused_similarity(struct, sem)
    assert result.overall_score >= 0.0
    assert result.theme_score >= 0.0
    assert result.form_score >= 0.0
    assert result.emotion_score >= 0.0
    assert result.imagery_score >= 0.0


# ================================================================ service.py — unit


def test_service_rebuild_empty_collection():
    svc = PoemSimilarityService()
    svc.rebuild([])
    assert svc.poems == []


def test_service_single_poem_has_no_neighbours():
    poem = _make_poem(themes=["solitude"])
    svc = PoemSimilarityService()
    svc.rebuild([poem])
    result = svc.get_overall_similar(poem.id, k=5)
    assert result is not None
    assert result.neighbours == []


def test_service_unknown_id_returns_none():
    svc = PoemSimilarityService()
    svc.rebuild([_make_poem()])
    assert svc.get_overall_similar(uuid4(), k=5) is None


def test_service_self_excluded_from_results():
    poems = [_make_poem(themes=["nature"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    query_id = poems[0].id
    result = svc.get_overall_similar(query_id, k=10)
    assert result is not None
    assert query_id not in {n.id for n in result.neighbours}


def test_service_k_limits_results():
    poems = [_make_poem() for _ in range(5)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_overall_similar(poems[0].id, k=2)
    assert result is not None
    assert len(result.neighbours) <= 2


def test_service_k_larger_than_pool_returns_all_available():
    poems = [_make_poem() for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_overall_similar(poems[0].id, k=100)
    assert result is not None
    assert len(result.neighbours) == 2  # pool minus self


def test_service_results_ordered_score_desc():
    query = _make_poem(themes=["nature", "loss"], formal_modes=["sonnet"])
    poem_a = _make_poem(themes=["nature", "loss"], formal_modes=["sonnet"])
    poem_b = _make_poem(themes=["war", "history"], formal_modes=["free verse"])
    svc = PoemSimilarityService()
    svc.rebuild([query, poem_a, poem_b])
    result = svc.get_overall_similar(query.id, k=10)
    assert result is not None
    scores = [n.score for n in result.neighbours]
    assert scores == sorted(scores, reverse=True)


def test_service_tie_break_by_id_asc():
    # Both disjoint from query → both score 0.0 → must be ordered by id asc
    small_id = "11111111-1111-4111-8111-111111111111"
    large_id = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    query = _make_poem(themes=["unique_alpha_xyz"])
    poem_small = _make_poem(id=small_id, themes=["z_beta"])
    poem_large = _make_poem(id=large_id, themes=["z_gamma"])
    svc = PoemSimilarityService()
    svc.rebuild([query, poem_small, poem_large])
    result = svc.get_overall_similar(query.id, k=10)
    assert result is not None
    ids = [str(n.id) for n in result.neighbours]
    assert ids == [small_id, large_id]


def test_service_result_query_id_is_set():
    poems = [_make_poem() for _ in range(2)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_overall_similar(poems[0].id, k=5)
    assert result is not None
    assert result.query_id == poems[0].id


def test_service_overall_score_field_matches_breakdown():
    poems = [_make_poem(themes=["a"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_overall_similar(poems[0].id, k=10)
    for n in result.neighbours:
        assert n.score == pytest.approx(n.breakdown.overall_score)


def test_service_theme_axis_score_field_matches_breakdown():
    poems = [_make_poem(themes=["grief"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_theme_similar(poems[0].id, k=10)
    for n in result.neighbours:
        assert n.score == pytest.approx(n.breakdown.theme_score)


def test_service_form_axis_score_field_matches_breakdown():
    poems = [_make_poem(formal_modes=["sonnet"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_form_similar(poems[0].id, k=10)
    for n in result.neighbours:
        assert n.score == pytest.approx(n.breakdown.form_score)


def test_service_register_axis_score_field_matches_breakdown():
    poems = [_make_poem(emotional_registers=["melancholic"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_emotion_similar(poems[0].id, k=10)
    for n in result.neighbours:
        assert n.score == pytest.approx(n.breakdown.emotion_score)


def test_service_imagery_axis_score_field_matches_breakdown():
    poems = [_make_poem(key_images=["rain", "leaves"]) for _ in range(3)]
    svc = PoemSimilarityService()
    svc.rebuild(poems)
    result = svc.get_imagery_similar(poems[0].id, k=10)
    for n in result.neighbours:
        assert n.score == pytest.approx(n.breakdown.imagery_score)


def test_service_rebuild_replaces_all_state():
    poem_a = _make_poem(themes=["original"])
    svc = PoemSimilarityService()
    svc.rebuild([poem_a])
    poem_b = _make_poem(themes=["replacement"])
    poem_c = _make_poem(themes=["replacement"])
    svc.rebuild([poem_b, poem_c])
    assert svc.get_overall_similar(poem_a.id, k=5) is None
    assert svc.get_overall_similar(poem_b.id, k=5) is not None


def test_service_two_poems_are_mutual_neighbours():
    p1 = _make_poem(themes=["love"])
    p2 = _make_poem(themes=["love"])
    svc = PoemSimilarityService()
    svc.rebuild([p1, p2])
    r1 = svc.get_overall_similar(p1.id, k=5)
    r2 = svc.get_overall_similar(p2.id, k=5)
    assert len(r1.neighbours) == 1
    assert r1.neighbours[0].id == p2.id
    assert len(r2.neighbours) == 1
    assert r2.neighbours[0].id == p1.id


# ---- module-level globals


def test_get_service_raises_when_uninitialized(monkeypatch):
    import server.similarity.service as svc_module

    monkeypatch.setattr(svc_module, "_similarity_service", None)
    with pytest.raises(RuntimeError, match="not initialized"):
        svc_module.get_similarity_service()


def test_rebuild_service_noop_when_uninitialized_does_not_raise(monkeypatch):
    import server.similarity.service as svc_module

    monkeypatch.setattr(svc_module, "_similarity_service", None)
    svc_module.rebuild_similarity_service([_make_poem()])  # must not raise


def test_init_service_then_get_service_returns_instance(monkeypatch):
    import server.similarity.service as svc_module

    monkeypatch.setattr(svc_module, "_similarity_service", None)
    svc_module.init_similarity_service([_make_poem()])
    svc = svc_module.get_similarity_service()
    assert isinstance(svc, PoemSimilarityService)


# ================================================================ API — similarity endpoints

# Three poems: Alpha and Beta share sonnet form + nature theme (similar to each other);
# Gamma is unrelated (war / free verse). Dates are distinct for deterministic ordering.


@pytest.fixture
def similarity_db(tmp_path):
    poem_alpha = _make_poem(
        title="Poem Alpha",
        date="2024-03-01T00:00:00Z",
        themes=["nature", "loss"],
        formal_modes=["sonnet"],
        emotional_registers=["melancholic"],
        key_images=["rain", "leaves"],
        contest_fit=["lyric prizes"],
        project="A meditation on nature and loss.",
        url="https://example.com/alpha",
    )
    poem_beta = _make_poem(
        title="Poem Beta",
        date="2024-02-01T00:00:00Z",
        themes=["nature", "memory"],
        formal_modes=["sonnet"],
        emotional_registers=["nostalgic"],
        key_images=["rain", "rivers"],
        contest_fit=["lyric prizes"],
        project="A meditation on nature and memory.",
        url="https://example.com/beta",
    )
    poem_gamma = _make_poem(
        title="Poem Gamma",
        date="2024-01-01T00:00:00Z",
        themes=["war", "history"],
        formal_modes=["free verse"],
        emotional_registers=["defiant"],
        key_images=["fire", "smoke"],
        contest_fit=["political prizes"],
        project="A defiant poem about war and history.",
        url="https://example.com/gamma",
    )
    return _make_db(tmp_path, [poem_alpha, poem_beta, poem_gamma])


@pytest.fixture
def api_client(similarity_db, monkeypatch):
    monkeypatch.setenv("POEMS_DATABASE", str(similarity_db))
    with TestClient(create_app(Settings())) as c:
        yield c


def test_similar_overall_returns_200(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar").status_code == 200


def test_similar_bundle_shape(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar").json()
    assert set(body.keys()) == {"overall", "theme", "form", "emotion", "imagery"}
    for key in ("overall", "theme", "form", "emotion", "imagery"):
        assert "query_id" in body[key]
        assert "neighbours" in body[key]


def test_similar_bundle_overall_matches_overall_endpoint(api_client):
    pid = _listing_ids(api_client)[0]
    bundle = api_client.get(f"/api/poems/{pid}/similar").json()
    overall = api_client.get(f"/api/poems/{pid}/similar/overall").json()
    assert bundle["overall"] == overall


def test_similar_theme_returns_200(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar/theme").status_code == 200


def test_similar_form_returns_200(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar/form").status_code == 200


def test_similar_register_returns_200(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar/emotion").status_code == 200


def test_similar_imagery_returns_200(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar/imagery").status_code == 200


def test_similar_unknown_id_returns_404(api_client):
    assert api_client.get(f"/api/poems/{uuid4()}/similar").status_code == 404


def test_similar_malformed_id_returns_422(api_client):
    assert api_client.get("/api/poems/not-a-uuid/similar").status_code == 422


def test_similar_k_zero_returns_422(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar?k_overall=0").status_code == 422


def test_similar_k_51_returns_422(api_client):
    pid = _listing_ids(api_client)[0]
    assert api_client.get(f"/api/poems/{pid}/similar?k_overall=51").status_code == 422


def test_similar_k_1_returns_at_most_one_result(api_client):
    pid = _listing_ids(api_client)[0]
    r = api_client.get(f"/api/poems/{pid}/similar/overall?k=1")
    assert r.status_code == 200
    assert len(r.json()["neighbours"]) <= 1


def test_similar_response_has_query_id(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall").json()
    assert body["query_id"] == pid


def test_similar_response_shape(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall").json()
    assert "query_id" in body
    assert "neighbours" in body
    if body["neighbours"]:
        n = body["neighbours"][0]
        assert {"id", "title", "project", "score", "breakdown"} <= set(n.keys())


def test_similar_response_excludes_full_poem_fields(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall?k=50").json()
    for n in body["neighbours"]:
        assert "body" not in n
        assert "url" not in n
        assert "rating" not in n
        assert "lines" not in n
        assert "words" not in n
        assert "awards" not in n


def test_similar_self_not_in_neighbours(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall?k=50").json()
    assert pid not in {n["id"] for n in body["neighbours"]}


def test_similar_works_in_read_only_mode(similarity_db, monkeypatch):
    monkeypatch.setenv("POEMS_DATABASE", str(similarity_db))
    monkeypatch.setenv("READ_ONLY", "true")
    with TestClient(create_app(Settings())) as c:
        pid = _listing_ids(c)[0]
        assert c.get(f"/api/poems/{pid}/similar").status_code == 200


def test_similar_more_similar_poem_ranks_higher(api_client):
    """Alpha/Beta share sonnet+nature; Gamma is war/free-verse. Beta should rank above Gamma for Alpha."""
    by_title = {
        item["title"]: item["id"]
        for item in api_client.get("/api/poems?limit=200").json()["items"]
    }
    alpha_id = by_title.get("Poem Alpha")
    beta_id = by_title.get("Poem Beta")
    gamma_id = by_title.get("Poem Gamma")
    if not (alpha_id and beta_id and gamma_id):
        pytest.skip("Expected test poems not found in db")

    neighbours = api_client.get(f"/api/poems/{alpha_id}/similar/overall?k=10").json()["neighbours"]
    ids = [n["id"] for n in neighbours]
    assert beta_id in ids
    assert gamma_id in ids
    assert ids.index(beta_id) < ids.index(gamma_id)


def test_similar_breakdown_fields_present(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall?k=10").json()
    if not body["neighbours"]:
        pytest.skip("No neighbours to inspect")
    breakdown = body["neighbours"][0]["breakdown"]
    assert "overall_score" in breakdown
    assert "theme_score" in breakdown
    assert "form_score" in breakdown
    assert "emotion_score" in breakdown
    assert "imagery_score" in breakdown
    assert "structured" in breakdown
    assert "semantic" in breakdown


def test_similar_structured_overlap_fields_present(api_client):
    pid = _listing_ids(api_client)[0]
    body = api_client.get(f"/api/poems/{pid}/similar/overall?k=10").json()
    if not body["neighbours"]:
        pytest.skip("No neighbours to inspect")
    structured = body["neighbours"][0]["breakdown"]["structured"]
    assert "theme_overlap" in structured
    assert "form_overlap" in structured
    assert "emotion_overlap" in structured
    assert "imagery_overlap" in structured
    assert "fit_overlap" in structured


# ================================================================ mutation → rebuild integration

# Poem A (date 2024-02-01 → listing index 0): nature / sonnet
# Poem B (date 2024-01-01 → listing index 1): history / free verse
# Deterministic ordering via distinct dates prevents UUID-tiebreak ambiguity.


@pytest.fixture
def mutation_db(tmp_path):
    poem_a = _make_poem(
        title="Poem A",
        date="2024-02-01T00:00:00Z",
        themes=["nature"],
        formal_modes=["sonnet"],
        url="https://example.com/a",
    )
    poem_b = _make_poem(
        title="Poem B",
        date="2024-01-01T00:00:00Z",
        themes=["history"],
        formal_modes=["free verse"],
        url="https://example.com/b",
    )
    return _make_db(tmp_path, [poem_a, poem_b])


@pytest.fixture
def rw_client(mutation_db, monkeypatch):
    monkeypatch.setenv("POEMS_DATABASE", str(mutation_db))
    monkeypatch.setenv("READ_ONLY", "false")
    with TestClient(create_app(Settings())) as c:
        yield c


def test_new_poem_appears_as_neighbour_after_post(rw_client):
    existing_id = _listing_ids(rw_client)[0]  # Poem A (nature/sonnet)
    r = rw_client.post(
        "/api/poems",
        json={
            "title": "Poem C",
            "url": "https://example.com/c",
            "body": "a new poem<br/>",
            "project": "A new poem about nature.",
            "rating": 50,
            "themes": ["nature"],
            "formal_modes": ["sonnet"],
        },
    )
    assert r.status_code == 201
    new_id = r.json()["id"]
    neighbours = rw_client.get(f"/api/poems/{existing_id}/similar/overall?k=10").json()["neighbours"]
    assert new_id in {n["id"] for n in neighbours}


def test_patch_updates_similarity_index(rw_client):
    ids = _listing_ids(rw_client)
    poem_a_id, poem_b_id = ids[0], ids[1]
    # Give Poem B the same tags as Poem A so they become similar on theme axis
    rw_client.patch(
        f"/api/poems/{poem_b_id}",
        json={"themes": ["nature"], "formal_modes": ["sonnet"]},
    )
    neighbours = rw_client.get(f"/api/poems/{poem_a_id}/similar/theme?k=10").json()["neighbours"]
    assert poem_b_id in {n["id"] for n in neighbours}


def test_deleted_poem_does_not_appear_in_similarity(rw_client):
    ids = _listing_ids(rw_client)
    query_id, victim_id = ids[0], ids[1]
    assert rw_client.delete(f"/api/poems/{victim_id}").status_code == 204
    neighbours = rw_client.get(f"/api/poems/{query_id}/similar/overall?k=10").json()["neighbours"]
    assert victim_id not in {n["id"] for n in neighbours}


def test_querying_deleted_poem_returns_404(rw_client):
    victim_id = _listing_ids(rw_client)[0]
    assert rw_client.delete(f"/api/poems/{victim_id}").status_code == 204
    assert rw_client.get(f"/api/poems/{victim_id}/similar").status_code == 404


def test_service_rebuilt_after_post_contains_new_poem(rw_client):
    r = rw_client.post(
        "/api/poems",
        json={
            "title": "Fresh Poem",
            "url": "https://example.com/fresh",
            "body": "fresh content<br/>",
            "project": "Fresh.",
            "rating": 60,
        },
    )
    assert r.status_code == 201
    new_id = r.json()["id"]
    # The new poem must itself return a valid (possibly empty) neighbour list
    r2 = rw_client.get(f"/api/poems/{new_id}/similar/overall")
    assert r2.status_code == 200
    assert "neighbours" in r2.json()
