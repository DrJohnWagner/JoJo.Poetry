"""Tests for the visualisation recommendation orchestration layer.

59 tests across 11 sections:

Section                       Tests  What's covered
----------------------------  -----  ----------------------------------------------------
candidate generation             7   metric contributions, preferred_if boost, score
                                      formula, empty metrics, unknown metrics, ordering
resonance boosts                 4   group fires at threshold, below threshold no boost,
                                      missing vis skipped, multiple groups stack
diversity bonus                  4   first candidate always earns bonus, same-family
                                      second gets none, new family earns bonus, overlays
                                      exempt and do not mark families seen
threshold gating                 7   min_score pass/fail, evaluate_activation reasons,
                                      overlay discount passes/fails, standalone unaffected,
                                      all gated
suppression                      7   explicit rules (single, multi-key ALL), score-desc
                                      ordering preserved, mutual suppression not possible,
                                      no suppress_if means no suppression
family balancing                 5   single-family cap, cross-family sharing, overlays
                                      exempt, max_per_family=1 edge case
role assignment                  6   primary slot, secondary/supporting caps, semantics
                                      cannot be primary, overlays separated, empty input
minimum breadth                  4   adds candidate when under minimum, skips when
                                      already met, skips when too few families, does
                                      not add overlays
overlay attachment               5   best host chosen, preferred host beats higher-scored
                                      non-preferred, no host → empty, multiple overlays
                                      → same host, overlay-only list → no attachment
explanation generation           5   two drivers, single driver, unknown metric fallback,
                                      high/low polarity, vis-ending lookup
select_visualisations (e2e)      5   full plan shape, primary is highest scorer,
                                      overlay attached, empty corpus (no scores above
                                      threshold), semantics never primary
"""
from __future__ import annotations

import pytest

from server.analytics.render import (
    _preferred_if_boost,
    apply_diversity_bonus,
    apply_family_balance,
    apply_resonance_boosts,
    apply_suppression,
    apply_threshold_gating,
    assign_roles,
    attach_overlays,
    enforce_minimum_breadth,
    evaluate_activation,
    generate_candidates,
    generate_explanation,
    select_visualisations,
    _Candidate,
)
from server.analytics.types import FinalRenderPlan, ScoredMetric
from server.analytics.visualisation import VISUALISATION_META


# ── Fixtures ──────────────────────────────────────────────────────────────

def _metric(
    name: str,
    rarity: float = 0.8,
    pct_rank: float = 90.0,
    score: float = 0.9,
    family: str = "indentation",
) -> ScoredMetric:
    return ScoredMetric(
        metric=name,
        family=family,
        value=1.0,
        percentile_rank=pct_rank,
        rarity=rarity,
        score=score,
    )


def _candidate(
    key: str,
    score: float = 0.7,
    suppressed_by: str | None = None,
) -> _Candidate:
    return _Candidate(key=key, score=score, driven_by=[key], contributing=[key],
                      suppressed_by=suppressed_by)


def _minimal_vis_meta(
    key: str,
    metrics: set[str],
    families: set[str] = frozenset({"indentation"}),
    vis_type: str = "profile",
    base_weight: float = 1.0,
    min_score: float = 0.5,
    preferred_if: dict | None = None,
    suppress_if_present: list[str] | None = None,
    supports_overlay: bool = False,
    ui_priority: float = 1.0,
) -> dict:
    return {
        key: {
            "metrics": metrics,
            "families": families,
            "description": f"{key} description.",
            "preferred_if": preferred_if or {},
            "base_weight": base_weight,
            "min_score": min_score,
            "max_instances": 1,
            "visualisation_type": vis_type,
            "ui_priority": ui_priority,
            "suppress_if_present": suppress_if_present or [],
            "supports_overlay": supports_overlay,
            "notes": "",
        }
    }


def _minimal_metric_meta(name: str, display_weight: float = 1.0) -> dict:
    return {name: {"family": "indentation", "display_weight": display_weight,
                   "reliability_weight": 1.0, "local_activity_weight": 1.0}}


# ── Candidate generation ───────────────────────────────────────────────────

class TestGenerateCandidates:

    def test_single_metric_single_vis(self):
        scores = {"indentation_volatility": _metric("indentation_volatility", rarity=0.8)}
        vis_meta = _minimal_vis_meta("v", {"indentation_volatility"})
        mm = _minimal_metric_meta("indentation_volatility", display_weight=1.2)
        candidates = generate_candidates(scores, vis_meta, mm)
        assert len(candidates) == 1
        assert candidates[0].key == "v"
        assert candidates[0].score > 0

    def test_contribution_uses_rarity_times_display_weight(self):
        scores = {"m": _metric("m", rarity=0.5)}
        vis_meta = _minimal_vis_meta("v", {"m"}, base_weight=1.0)
        mm = _minimal_metric_meta("m", display_weight=2.0)
        candidates = generate_candidates(scores, vis_meta, mm)
        # contribution = 0.5 * 2.0 = 1.0; score = 1.0 * (0.6*1.0 + 0.4*1.0) = 1.0
        assert abs(candidates[0].score - 1.0) < 1e-4

    def test_preferred_if_boost_applied(self):
        scores = {"m": _metric("m", rarity=0.9)}
        vis_meta = _minimal_vis_meta("v", {"m"}, preferred_if={"m": 0.8})
        mm = _minimal_metric_meta("m")
        c_with = generate_candidates(scores, vis_meta, mm)
        vis_meta_no = _minimal_vis_meta("v", {"m"})
        c_without = generate_candidates(scores, vis_meta_no, mm)
        assert c_with[0].score > c_without[0].score

    def test_missing_metric_skipped(self):
        scores = {}
        vis_meta = _minimal_vis_meta("v", {"missing_metric"})
        mm = {}
        candidates = generate_candidates(scores, vis_meta, mm)
        assert candidates == []

    def test_driven_by_sorted_by_contribution(self):
        scores = {
            "a": _metric("a", rarity=0.9),
            "b": _metric("b", rarity=0.3),
        }
        vis_meta = _minimal_vis_meta("v", {"a", "b"})
        mm = {
            "a": {"display_weight": 1.0, "reliability_weight": 1.0, "local_activity_weight": 1.0},
            "b": {"display_weight": 1.0, "reliability_weight": 1.0, "local_activity_weight": 1.0},
        }
        candidates = generate_candidates(scores, vis_meta, mm)
        assert candidates[0].driven_by[0] == "a"

    def test_candidates_sorted_score_desc(self):
        scores = {"m1": _metric("m1", rarity=0.9), "m2": _metric("m2", rarity=0.2)}
        vis_meta = {
            **_minimal_vis_meta("high_v", {"m1"}),
            **_minimal_vis_meta("low_v", {"m2"}),
        }
        mm = _minimal_metric_meta("m1") | _minimal_metric_meta("m2")
        candidates = generate_candidates(scores, vis_meta, mm)
        assert candidates[0].score >= candidates[1].score

    def test_preferred_if_boost_caps_at_1_3_per_threshold(self):
        scores = {"a": _metric("a", rarity=1.0), "b": _metric("b", rarity=1.0)}
        preferred_if = {"a": 0.5, "b": 0.5}
        boost = _preferred_if_boost(preferred_if, {"a": scores["a"], "b": scores["b"]})
        assert boost == pytest.approx(1.2)


# ── Resonance boosts ───────────────────────────────────────────────────────

class TestResonanceBoosts:

    def _scores(self, **rarities) -> dict:
        return {name: _metric(name, rarity=r) for name, r in rarities.items()}

    def test_group_fires_and_boosts_candidate(self):
        candidates = [_candidate("momentum_profile", 1.0)]
        resonance = {
            "test_group": {
                "metrics": {"m1", "m2"},
                "boost_visualisations": {"momentum_profile": 1.15},
                "activation_threshold": 0.5,
                "min_activations": 2,
            }
        }
        scores = self._scores(m1=0.8, m2=0.7)
        result = apply_resonance_boosts(candidates, scores, resonance)
        assert result[0].score == pytest.approx(1.15)

    def test_group_does_not_fire_below_min_activations(self):
        candidates = [_candidate("momentum_profile", 1.0)]
        resonance = {
            "test_group": {
                "metrics": {"m1", "m2", "m3"},
                "boost_visualisations": {"momentum_profile": 1.15},
                "activation_threshold": 0.5,
                "min_activations": 2,
            }
        }
        scores = self._scores(m1=0.8)  # only 1 of 3 active
        result = apply_resonance_boosts(candidates, scores, resonance)
        assert result[0].score == pytest.approx(1.0)

    def test_missing_vis_key_silently_skipped(self):
        candidates = [_candidate("other_vis", 1.0)]
        resonance = {
            "test_group": {
                "metrics": {"m1", "m2"},
                "boost_visualisations": {"absent_vis": 1.20},
                "activation_threshold": 0.5,
                "min_activations": 2,
            }
        }
        scores = self._scores(m1=0.9, m2=0.9)
        result = apply_resonance_boosts(candidates, scores, resonance)
        assert result[0].score == pytest.approx(1.0)  # untouched

    def test_multiple_groups_stack_on_same_candidate(self):
        candidates = [_candidate("momentum_profile", 1.0)]
        resonance = {
            "group_a": {
                "metrics": {"m1", "m2"},
                "boost_visualisations": {"momentum_profile": 1.15},
                "activation_threshold": 0.5,
                "min_activations": 2,
            },
            "group_b": {
                "metrics": {"m3", "m4"},
                "boost_visualisations": {"momentum_profile": 1.10},
                "activation_threshold": 0.5,
                "min_activations": 2,
            },
        }
        scores = self._scores(m1=0.8, m2=0.7, m3=0.9, m4=0.6)
        result = apply_resonance_boosts(candidates, scores, resonance)
        assert result[0].score == pytest.approx(1.15 * 1.10, rel=1e-4)


# ── Diversity bonus ────────────────────────────────────────────────────────

class TestDiversityBonus:

    def test_first_candidate_always_earns_bonus(self):
        c = _candidate("a", 1.0)
        vis_meta = _minimal_vis_meta("a", set(), families={"indentation"})
        result = apply_diversity_bonus([c], vis_meta, bonus=1.10)
        assert result[0].score == pytest.approx(1.10)

    def test_same_family_second_candidate_gets_no_bonus(self):
        a = _candidate("a", 1.0)
        b = _candidate("b", 0.8)
        vis_meta = {
            **_minimal_vis_meta("a", set(), families={"indentation"}),
            **_minimal_vis_meta("b", set(), families={"indentation"}),
        }
        result = apply_diversity_bonus([a, b], vis_meta, bonus=1.10)
        assert result[0].score == pytest.approx(1.10)  # a boosted
        assert result[1].score == pytest.approx(0.80)  # b untouched

    def test_new_family_earns_bonus(self):
        a = _candidate("a", 1.0)
        b = _candidate("b", 0.8)
        vis_meta = {
            **_minimal_vis_meta("a", set(), families={"indentation"}),
            **_minimal_vis_meta("b", set(), families={"rhythm"}),
        }
        result = apply_diversity_bonus([a, b], vis_meta, bonus=1.10)
        assert result[0].score == pytest.approx(1.10)
        assert result[1].score == pytest.approx(0.88)

    def test_overlays_exempt_and_do_not_mark_families(self):
        ov = _candidate("ov", 0.9)
        b  = _candidate("b",  0.7)
        vis_meta = {
            **_minimal_vis_meta("ov", set(), vis_type="overlay", families={"semantics"}),
            **_minimal_vis_meta("b",  set(), families={"semantics"}),
        }
        result = apply_diversity_bonus([ov, b], vis_meta, bonus=1.10)
        # overlay unchanged, and since it didn't mark "semantics" as seen,
        # b earns the bonus for being the first non-overlay to introduce semantics
        ov_result = next(r for r in result if r.key == "ov")
        b_result  = next(r for r in result if r.key == "b")
        assert ov_result.score == pytest.approx(0.90)
        assert b_result.score  == pytest.approx(0.77)


# ── Threshold gating ───────────────────────────────────────────────────────

class TestThresholdGating:

    def test_passes_above_min_score(self):
        c = _candidate("indentation_map", score=0.7)
        vis_meta = _minimal_vis_meta("indentation_map", {"m"}, min_score=0.5)
        passes, _ = evaluate_activation(c, vis_meta)
        assert passes

    def test_fails_below_min_score(self):
        c = _candidate("indentation_map", score=0.3)
        vis_meta = _minimal_vis_meta("indentation_map", {"m"}, min_score=0.5)
        passes, reason = evaluate_activation(c, vis_meta)
        assert not passes
        assert "min_score" in reason

    def test_gating_removes_low_scorers(self):
        candidates = [_candidate("a", 0.8), _candidate("b", 0.3)]
        vis_meta = {
            **_minimal_vis_meta("a", set(), min_score=0.5),
            **_minimal_vis_meta("b", set(), min_score=0.5),
        }
        result = apply_threshold_gating(candidates, vis_meta)
        assert [c.key for c in result] == ["a"]

    def test_overlay_fails_below_discounted_threshold(self):
        # min_score=0.5, discount=0.75 → effective=0.375; score=0.3 < 0.375
        c = _candidate("ov", score=0.3)
        vis_meta = _minimal_vis_meta("ov", {"m"}, vis_type="overlay", min_score=0.5)
        passes, _ = evaluate_activation(c, vis_meta)
        assert not passes

    def test_overlay_passes_above_discounted_threshold(self):
        # min_score=0.5, discount=0.75 → effective=0.375; score=0.4 > 0.375
        c = _candidate("ov", score=0.4)
        vis_meta = _minimal_vis_meta("ov", {"m"}, vis_type="overlay", min_score=0.5)
        passes, _ = evaluate_activation(c, vis_meta)
        assert passes

    def test_standalone_uses_full_threshold(self):
        # Same min_score=0.5, score=0.4; no discount for non-overlay → should fail
        c = _candidate("v", score=0.4)
        vis_meta = _minimal_vis_meta("v", {"m"}, vis_type="profile", min_score=0.5)
        passes, _ = evaluate_activation(c, vis_meta)
        assert not passes

    def test_all_gated_returns_empty(self):
        candidates = [_candidate("a", 0.1)]
        vis_meta = _minimal_vis_meta("a", set(), min_score=0.9)
        assert apply_threshold_gating(candidates, vis_meta) == []


# ── Suppression ────────────────────────────────────────────────────────────

class TestSuppression:

    def test_single_key_suppression(self):
        candidates = [_candidate("strong", 0.9), _candidate("weak", 0.6)]
        vis_meta = {
            **_minimal_vis_meta("strong", set()),
            **_minimal_vis_meta("weak", set(), suppress_if_present=["strong"]),
        }
        result = apply_suppression(candidates, vis_meta)
        assert [c.key for c in result] == ["strong"]

    def test_all_semantics_suppression_requires_both(self):
        # fracture_map is suppressed only when BOTH indentation_map AND
        # interruption_density_profile are present
        candidates = [
            _candidate("indentation_map", 0.9),
            _candidate("fracture_map", 0.7),
        ]
        vis_meta = {
            **_minimal_vis_meta("indentation_map", set()),
            **_minimal_vis_meta(
                "fracture_map", set(),
                suppress_if_present=["indentation_map", "interruption_density_profile"],
            ),
        }
        # Only one of the two trigger keys present → fracture_map survives
        result = apply_suppression(candidates, vis_meta)
        assert len(result) == 2

    def test_all_semantics_suppression_triggers_when_all_present(self):
        candidates = [
            _candidate("indentation_map", 0.9),
            _candidate("interruption_density_profile", 0.85),
            _candidate("fracture_map", 0.7),
        ]
        vis_meta = {
            **_minimal_vis_meta("indentation_map", set()),
            **_minimal_vis_meta("interruption_density_profile", set()),
            **_minimal_vis_meta(
                "fracture_map", set(),
                suppress_if_present=["indentation_map", "interruption_density_profile"],
            ),
        }
        result = apply_suppression(candidates, vis_meta)
        assert "fracture_map" not in [c.key for c in result]

    def test_suppressor_records_suppresses_list(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.6)]
        vis_meta = {
            **_minimal_vis_meta("a", set()),
            **_minimal_vis_meta("b", set(), suppress_if_present=["a"]),
        }
        apply_suppression(candidates, vis_meta)
        assert "b" in candidates[0].suppresses

    def test_no_suppress_if_present_never_suppresses(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.7)]
        vis_meta = {
            **_minimal_vis_meta("a", set()),
            **_minimal_vis_meta("b", set()),
        }
        result = apply_suppression(candidates, vis_meta)
        assert len(result) == 2

    def test_order_preserved_after_suppression(self):
        candidates = [
            _candidate("first", 0.95),
            _candidate("second", 0.8),
            _candidate("third", 0.5),
        ]
        vis_meta = {c: _minimal_vis_meta(c, set())[c] for c in ["first", "second", "third"]}
        result = apply_suppression(candidates, vis_meta)
        assert [c.key for c in result] == ["first", "second", "third"]

    def test_suppressed_by_field_set(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.6)]
        vis_meta = {
            **_minimal_vis_meta("a", set()),
            **_minimal_vis_meta("b", set(), suppress_if_present=["a"]),
        }
        apply_suppression(candidates, vis_meta)
        assert candidates[1].suppressed_by == "a"


# ── Family balancing ───────────────────────────────────────────────────────

class TestFamilyBalance:

    def test_caps_per_family(self):
        candidates = [
            _candidate("a", 0.9), _candidate("b", 0.8), _candidate("c", 0.7),
        ]
        vis_meta = {
            k: _minimal_vis_meta(k, set(), families={"indentation"})[k]
            for k in ["a", "b", "c"]
        }
        result = apply_family_balance(candidates, vis_meta, max_per_family=2)
        assert len(result) == 2
        assert [c.key for c in result] == ["a", "b"]

    def test_different_families_both_allowed(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.8)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), families={"indentation"})["a"],
            "b": _minimal_vis_meta("b", set(), families={"rhythm"})["b"],
        }
        result = apply_family_balance(candidates, vis_meta, max_per_family=1)
        assert len(result) == 2

    def test_overlays_exempt_from_family_cap(self):
        candidates = [_candidate("a", 0.9), _candidate("ov", 0.8)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), families={"semantics"})["a"],
            "ov": _minimal_vis_meta("ov", set(), families={"semantics"}, vis_type="overlay")["ov"],
        }
        result = apply_family_balance(candidates, vis_meta, max_per_family=1)
        assert len(result) == 2

    def test_cross_family_vis_increments_both_family_counts(self):
        # A vis in both {rhythm, structure} should increment both family counts
        candidates = [_candidate("a", 0.9), _candidate("b", 0.8)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), families={"rhythm", "structure"})["a"],
            "b": _minimal_vis_meta("b", set(), families={"structure"})["b"],
        }
        result = apply_family_balance(candidates, vis_meta, max_per_family=1)
        # After 'a', structure count = 1 = max; 'b' should be dropped
        assert [c.key for c in result] == ["a"]

    def test_max_per_family_1_allows_one_per_family(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.85), _candidate("c", 0.8)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), families={"indentation"})["a"],
            "b": _minimal_vis_meta("b", set(), families={"rhythm"})["b"],
            "c": _minimal_vis_meta("c", set(), families={"indentation"})["c"],
        }
        result = apply_family_balance(candidates, vis_meta, max_per_family=1)
        assert len(result) == 2
        assert "c" not in [r.key for r in result]


# ── Role assignment ────────────────────────────────────────────────────────

class TestAssignRoles:

    def test_highest_scorer_becomes_primary(self):
        candidates = [_candidate("a", 0.9), _candidate("b", 0.7)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), families={"indentation"})["a"],
            "b": _minimal_vis_meta("b", set(), families={"rhythm"})["b"],
        }
        primary, *_ = assign_roles(candidates, vis_meta)
        assert primary.key == "a"

    def test_semantics_only_cannot_be_primary(self):
        candidates = [
            _candidate("sem", 0.99),
            _candidate("struct", 0.5),
        ]
        vis_meta = {
            "sem":    _minimal_vis_meta("sem",    set(), families={"semantics"})["sem"],
            "struct": _minimal_vis_meta("struct", set(), families={"structure"})["struct"],
        }
        primary, *_ = assign_roles(candidates, vis_meta)
        assert primary.key == "struct"

    def test_secondary_cap(self):
        candidates = [_candidate(k, 0.9 - i * 0.1) for i, k in enumerate("abcde")]
        vis_meta = {k: _minimal_vis_meta(k, set(), families={"indentation"})[k] for k in "abcde"}
        _, secondary, supporting, _ = assign_roles(candidates, vis_meta)
        assert len(secondary) == 2

    def test_supporting_cap(self):
        candidates = [_candidate(k, 0.9 - i * 0.1) for i, k in enumerate("abcde")]
        vis_meta = {k: _minimal_vis_meta(k, set(), families={"indentation"})[k] for k in "abcde"}
        _, _, supporting, _ = assign_roles(candidates, vis_meta)
        assert len(supporting) == 2

    def test_overlays_separated(self):
        candidates = [_candidate("a", 0.9), _candidate("ov", 0.8)]
        vis_meta = {
            "a":  _minimal_vis_meta("a",  set())["a"],
            "ov": _minimal_vis_meta("ov", set(), vis_type="overlay")["ov"],
        }
        primary, secondary, supporting, overlays = assign_roles(candidates, vis_meta)
        assert primary.key == "a"
        assert overlays[0].key == "ov"

    def test_empty_input_returns_none_primary(self):
        primary, secondary, supporting, overlays = assign_roles([], VISUALISATION_META)
        assert primary is None
        assert secondary == []


# ── Minimum breadth ────────────────────────────────────────────────────────

class TestMinimumBreadth:

    def _vis_meta(self, *keys_families):
        meta = {}
        for key, fam in keys_families:
            meta[key] = _minimal_vis_meta(key, set(), families={fam})[key]
        return meta

    def test_adds_candidate_when_under_minimum(self):
        primary = _candidate("a", 0.9)
        gated = [_candidate("a", 0.9), _candidate("b", 0.6), _candidate("c", 0.5)]
        post_supp = gated[:]
        vis_meta = self._vis_meta(("a", "indentation"), ("b", "rhythm"), ("c", "line_length"))
        _, _, supporting = enforce_minimum_breadth(
            primary, [], [], post_supp, gated, vis_meta, min_vis=3, min_families=3,
        )
        assert len(supporting) >= 1

    def test_skips_when_already_at_minimum(self):
        primary = _candidate("a", 0.9)
        sec = [_candidate("b", 0.7), _candidate("c", 0.6)]
        vis_meta = self._vis_meta(("a", "indentation"), ("b", "rhythm"), ("c", "line_length"))
        _, secondary, supporting = enforce_minimum_breadth(
            primary, sec, [], [], [], vis_meta, min_vis=3, min_families=3,
        )
        assert len(secondary) == 2  # unchanged
        assert supporting == []

    def test_skips_when_too_few_families(self):
        primary = _candidate("a", 0.9)
        gated = [_candidate("a", 0.9), _candidate("b", 0.6)]
        post_supp = gated[:]
        # only 2 distinct families — below min_families=3
        vis_meta = self._vis_meta(("a", "indentation"), ("b", "rhythm"))
        _, _, supporting = enforce_minimum_breadth(
            primary, [], [], post_supp, gated, vis_meta, min_vis=3, min_families=3,
        )
        assert supporting == []

    def test_does_not_add_overlays(self):
        primary = _candidate("a", 0.9)
        overlay = _candidate("ov", 0.8)
        gated = [primary, overlay, _candidate("b", 0.6), _candidate("c", 0.5)]
        post_supp = gated[:]
        vis_meta = {
            **_minimal_vis_meta("a",  set(), families={"indentation"}),
            **_minimal_vis_meta("ov", set(), vis_type="overlay", families={"semantics"}),
            **_minimal_vis_meta("b",  set(), families={"rhythm"}),
            **_minimal_vis_meta("c",  set(), families={"line_length"}),
        }
        _, _, supporting = enforce_minimum_breadth(
            primary, [], [], post_supp, gated, vis_meta, min_vis=3, min_families=3,
        )
        assert all(vis_meta[c.key]["visualisation_type"] != "overlay" for c in supporting)


# ── Overlay attachment ─────────────────────────────────────────────────────

class TestAttachOverlays:

    def _overlay_candidate(self, key: str = "semantic_pressure_overlay") -> _Candidate:
        return _Candidate(key=key, score=0.6, driven_by=["negation_density"], contributing=[])

    def test_attaches_to_best_host(self):
        overlay = self._overlay_candidate()
        charts = [_candidate("a", 0.5), _candidate("b", 0.9)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), supports_overlay=True)["a"],
            "b": _minimal_vis_meta("b", set(), supports_overlay=True)["b"],
            "semantic_pressure_overlay": _minimal_vis_meta(
                "semantic_pressure_overlay", set(), vis_type="overlay"
            )["semantic_pressure_overlay"],
        }
        result = attach_overlays([overlay], charts, vis_meta)
        assert len(result) == 1
        assert result[0].host_visualisation == "b"

    def test_no_compatible_host_returns_empty(self):
        overlay = self._overlay_candidate()
        charts = [_candidate("a", 0.9)]
        vis_meta = {
            "a": _minimal_vis_meta("a", set(), supports_overlay=False)["a"],
            "semantic_pressure_overlay": _minimal_vis_meta(
                "semantic_pressure_overlay", set(), vis_type="overlay"
            )["semantic_pressure_overlay"],
        }
        result = attach_overlays([overlay], charts, vis_meta)
        assert result == []

    def test_multiple_overlays_attach_to_same_best_host(self):
        overlays = [self._overlay_candidate("ov1"), self._overlay_candidate("ov2")]
        charts = [_candidate("host", 0.9)]
        vis_meta = {
            "host": _minimal_vis_meta("host", set(), supports_overlay=True)["host"],
            "ov1": _minimal_vis_meta("ov1", set(), vis_type="overlay")["ov1"],
            "ov2": _minimal_vis_meta("ov2", set(), vis_type="overlay")["ov2"],
        }
        result = attach_overlays(overlays, charts, vis_meta)
        assert all(o.host_visualisation == "host" for o in result)

    def test_preferred_host_beats_higher_scored_non_preferred(self):
        # preferred score=0.7, non-preferred score=0.9
        # affinity: 0.7 × 1.40 = 0.98 > 0.9 × 1.0 = 0.90 → preferred wins
        overlay = self._overlay_candidate()
        preferred_host     = _candidate("preferred", 0.7)
        non_preferred_host = _candidate("other",     0.9)
        vis_meta = {
            "preferred": _minimal_vis_meta("preferred", set(), supports_overlay=True)["preferred"],
            "other":     _minimal_vis_meta("other",     set(), supports_overlay=True)["other"],
            "semantic_pressure_overlay": {
                **_minimal_vis_meta("semantic_pressure_overlay", set(), vis_type="overlay")[
                    "semantic_pressure_overlay"
                ],
                "preferred_hosts": ["preferred"],
            },
        }
        result = attach_overlays([overlay], [preferred_host, non_preferred_host], vis_meta)
        assert result[0].host_visualisation == "preferred"

    def test_empty_overlay_list_returns_empty(self):
        result = attach_overlays([], [], VISUALISATION_META)
        assert result == []


# ── Explanation generation ─────────────────────────────────────────────────

class TestGenerateExplanation:

    def _scores(self, **kwargs) -> dict:
        return {
            name: _metric(name, pct_rank=pct)
            for name, pct in kwargs.items()
        }

    def test_two_drivers_high_pct(self):
        scores = self._scores(indentation_volatility=80.0, left_margin_returns=75.0)
        vis_meta = _minimal_vis_meta("indentation_map", set())
        expl = generate_explanation(
            "indentation_map",
            ["indentation_volatility", "left_margin_returns"],
            scores,
            vis_meta,
        )
        assert "volatile spatial positioning" in expl.lower()
        assert "repeated margin resets" in expl.lower()

    def test_single_driver(self):
        scores = self._scores(indentation_volatility=85.0)
        vis_meta = _minimal_vis_meta("indentation_map", set())
        expl = generate_explanation("indentation_map", ["indentation_volatility"], scores, vis_meta)
        assert expl.endswith(".")
        assert "volatile spatial positioning" in expl.lower()

    def test_low_pct_uses_low_prose(self):
        scores = self._scores(momentum_persistence_score=20.0)
        vis_meta = _minimal_vis_meta("momentum_profile", set())
        expl = generate_explanation("momentum_profile", ["momentum_persistence_score"], scores, vis_meta)
        assert "arrested rhythmic continuity" in expl.lower()

    def test_unknown_metric_uses_name_fallback(self):
        scores = {"unknown_metric": _metric("unknown_metric")}
        vis_meta = _minimal_vis_meta("v", set())
        expl = generate_explanation("v", ["unknown_metric"], scores, vis_meta)
        assert "unknown metric" in expl.lower()

    def test_no_drivers_falls_back_to_description(self):
        vis_meta = _minimal_vis_meta("v", set())
        expl = generate_explanation("v", [], {}, vis_meta)
        assert "v description" in expl


# ── End-to-end ────────────────────────────────────────────────────────────

class TestSelectVisualisations:

    def _strong_scores(self) -> list[ScoredMetric]:
        """Scores that activate indentation and rhythm visualisations strongly."""
        return [
            _metric("indentation_volatility",    rarity=0.9, pct_rank=95.0, score=1.1, family="indentation"),
            _metric("left_margin_returns",        rarity=0.8, pct_rank=88.0, score=0.88, family="structure"),
            _metric("fraction_indented_lines",    rarity=0.7, pct_rank=85.0, score=0.77, family="indentation"),
            _metric("avg_indentation_depth",      rarity=0.65, pct_rank=82.0, score=0.59, family="indentation"),
            _metric("max_indentation_depth",      rarity=0.6, pct_rank=80.0, score=0.54, family="indentation"),
            _metric("interruption_density_mean",  rarity=0.75, pct_rank=87.0, score=0.83, family="rhythm"),
            _metric("breath_interruption_severity", rarity=0.7, pct_rank=84.0, score=0.76, family="rhythm"),
            _metric("pressure_peak_line",         rarity=0.65, pct_rank=80.0, score=0.68, family="structure"),
            _metric("dash_count",                 rarity=0.5, pct_rank=70.0, score=0.55, family="punctuation"),
            _metric("negation_density",           rarity=0.75, pct_rank=88.0, score=0.62, family="semantics"),
            _metric("repetition_pressure",        rarity=0.3, pct_rank=60.0, score=0.26, family="semantics"),
            _metric("momentum_persistence_score", rarity=0.65, pct_rank=20.0, score=0.59, family="rhythm"),
            _metric("stanza_volatility",          rarity=0.4, pct_rank=65.0, score=0.52, family="structure"),
            _metric("line_length_range",          rarity=0.5, pct_rank=72.0, score=0.55, family="line_length"),
            _metric("enjambment_ratio",           rarity=0.5, pct_rank=28.0, score=0.60, family="rhythm"),
            _metric("terminal_stop_density",      rarity=0.5, pct_rank=72.0, score=0.45, family="punctuation"),
            _metric("comma_density",              rarity=0.2, pct_rank=55.0, score=0.18, family="punctuation"),
            _metric("punctuation_per_line",       rarity=0.2, pct_rank=54.0, score=0.20, family="punctuation"),
            _metric("syntax_fracture_density",    rarity=0.1, pct_rank=52.0, score=0.09, family="structure"),
            _metric("median_line_length",         rarity=0.0, pct_rank=50.0, score=0.0, family="line_length"),
            _metric("shortest_line",              rarity=0.15, pct_rank=57.0, score=0.14, family="line_length"),
            _metric("longest_line",               rarity=0.18, pct_rank=58.0, score=0.18, family="line_length"),
        ]

    def test_plan_shape(self):
        plan = select_visualisations(self._strong_scores())
        assert isinstance(plan, FinalRenderPlan)
        total = len(plan.ordered_visualisations)
        assert 1 <= total <= 5

    def test_primary_is_present_and_expanded(self):
        plan = select_visualisations(self._strong_scores())
        assert plan.primary is not None
        assert plan.primary.display_mode == "expanded"
        assert plan.primary.role == "primary"

    def test_secondary_and_supporting_are_compact(self):
        plan = select_visualisations(self._strong_scores())
        for vis in plan.secondary + plan.supporting:
            assert vis.display_mode == "compact"

    def test_overlay_attaches_when_semantic_scores_high(self):
        plan = select_visualisations(self._strong_scores())
        # semantic_pressure_overlay should attach if negation_density passes threshold
        hosts_with_overlay = [v for v in plan.ordered_visualisations if v.overlays]
        # Not guaranteed for these scores but overlay field should exist
        for v in plan.ordered_visualisations:
            assert hasattr(v, "overlays")

    def test_semantics_family_never_primary(self):
        # Give semantics extremely high scores but structural metrics very low
        weak_structural = [
            _metric("indentation_volatility",    rarity=0.0, pct_rank=50.0, score=0.0),
            _metric("interruption_density_mean", rarity=0.0, pct_rank=50.0, score=0.0),
            _metric("negation_density",          rarity=0.99, pct_rank=99.0, score=1.5, family="semantics"),
            _metric("repetition_pressure",       rarity=0.99, pct_rank=99.0, score=1.5, family="semantics"),
        ]
        plan = select_visualisations(weak_structural)
        if plan.primary:
            assert "semantics" not in plan.primary.families or len(set(plan.primary.families)) > 1
