"""Tests for server.analytics.scoring — rarity modes, percentile rank, score_all."""
from __future__ import annotations

import pytest

from server.analytics.scoring import (
    METRIC_META,
    PERCENTILE_KEYS,
    _percentile_rank,
    _rarity,
    score_all,
    select_top,
)


# ---------------------------------------------------------------------------
# _rarity
# ---------------------------------------------------------------------------

class TestRarity:
    def test_two_sided_above_median(self):
        assert _rarity(75.0) == pytest.approx(0.5)

    def test_two_sided_below_median(self):
        assert _rarity(25.0) == pytest.approx(0.5)

    def test_two_sided_at_median_is_zero(self):
        assert _rarity(50.0) == pytest.approx(0.0)

    def test_two_sided_at_extremes(self):
        assert _rarity(0.0)   == pytest.approx(1.0)
        assert _rarity(100.0) == pytest.approx(1.0)

    def test_two_sided_default_mode(self):
        assert _rarity(25.0) == _rarity(25.0, "two_sided")

    def test_high_only_above_median(self):
        assert _rarity(75.0, "high_only") == pytest.approx(0.5)

    def test_high_only_at_median_is_zero(self):
        assert _rarity(50.0, "high_only") == pytest.approx(0.0)

    def test_high_only_below_median_is_zero(self):
        # low values must not produce rarity for high_only metrics
        assert _rarity(25.0, "high_only") == pytest.approx(0.0)
        assert _rarity(0.0,  "high_only") == pytest.approx(0.0)
        assert _rarity(10.0, "high_only") == pytest.approx(0.0)

    def test_high_only_at_100(self):
        assert _rarity(100.0, "high_only") == pytest.approx(1.0)

    def test_low_only_below_median(self):
        assert _rarity(25.0, "low_only") == pytest.approx(0.5)

    def test_low_only_at_median_is_zero(self):
        assert _rarity(50.0, "low_only") == pytest.approx(0.0)

    def test_low_only_above_median_is_zero(self):
        assert _rarity(75.0,  "low_only") == pytest.approx(0.0)
        assert _rarity(100.0, "low_only") == pytest.approx(0.0)
        assert _rarity(90.0,  "low_only") == pytest.approx(0.0)

    def test_low_only_at_0(self):
        assert _rarity(0.0, "low_only") == pytest.approx(1.0)

    def test_high_only_symmetry_with_low_only(self):
        # For any pct, exactly one of high_only/low_only is nonzero (except at 50)
        for pct in [10.0, 30.0, 70.0, 90.0]:
            hi = _rarity(pct, "high_only")
            lo = _rarity(pct, "low_only")
            assert (hi == 0.0) != (lo == 0.0), f"pct={pct} both nonzero or both zero"


# ---------------------------------------------------------------------------
# _percentile_rank
# ---------------------------------------------------------------------------

def _make_dist(values: list[float]) -> dict:
    import numpy as np
    arr = np.array(values, dtype=float)
    return {f"p{p}": float(np.percentile(arr, p)) for p in PERCENTILE_KEYS}


class TestPercentileRank:
    def test_median_value_returns_near_50(self):
        dist = _make_dist(list(range(1, 101)))
        rank = _percentile_rank(50.5, dist)
        assert 45.0 < rank < 55.0

    def test_min_value_returns_near_0(self):
        dist = _make_dist(list(range(1, 101)))
        rank = _percentile_rank(1.0, dist)
        assert rank <= 10.0

    def test_max_value_returns_near_100(self):
        dist = _make_dist(list(range(1, 101)))
        rank = _percentile_rank(100.0, dist)
        assert rank >= 90.0

    def test_below_min_clamped_to_non_negative(self):
        dist = _make_dist([10, 20, 30, 40, 50, 60, 70])
        rank = _percentile_rank(0.0, dist)
        assert rank >= 0.0

    def test_above_max_clamped_to_lte_100_ish(self):
        dist = _make_dist([10, 20, 30, 40, 50, 60, 70])
        rank = _percentile_rank(200.0, dist)
        assert rank <= 110.0


# ---------------------------------------------------------------------------
# METRIC_META — rarity_mode completeness
# ---------------------------------------------------------------------------

class TestMetricMetaRarityMode:
    VALID_MODES = {"two_sided", "high_only", "low_only"}

    def test_all_metrics_have_rarity_mode(self):
        for metric, meta in METRIC_META.items():
            assert "rarity_mode" in meta, f"{metric} missing rarity_mode"

    def test_all_rarity_modes_are_valid(self):
        for metric, meta in METRIC_META.items():
            mode = meta["rarity_mode"]
            assert mode in self.VALID_MODES, f"{metric} has unknown rarity_mode '{mode}'"

    def test_expected_high_only_metrics(self):
        high_only = {m for m, meta in METRIC_META.items() if meta["rarity_mode"] == "high_only"}
        expected = {
            "dash_count", "interruption_density_mean", "breath_interruption_severity",
            "left_margin_returns", "repetition_pressure", "negation_density",
        }
        assert expected.issubset(high_only), f"Missing high_only: {expected - high_only}"

    def test_indentation_metrics_are_high_only(self):
        for m in ("max_indentation_depth", "fraction_indented_lines",
                  "avg_indentation_depth", "indentation_volatility"):
            assert METRIC_META[m]["rarity_mode"] == "high_only"


# ---------------------------------------------------------------------------
# score_all — rarity_mode applied correctly
# ---------------------------------------------------------------------------

def _uniform_dist(n: int = 101) -> dict:
    """Uniform distribution over [0, n-1]; p50 == (n-1)/2."""
    import numpy as np
    vals = np.arange(n, dtype=float)
    return {f"p{p}": float(np.percentile(vals, p)) for p in PERCENTILE_KEYS}


def _make_corpus_distributions(metrics: list[str]) -> dict:
    return {m: _uniform_dist() for m in metrics}


def _make_per_line() -> dict:
    return {
        "indentation":          [{"leading_spaces": 0}] * 5,
        "line_lengths":         {"per_line": [{"with_spaces": 10, "without_spaces": 8}] * 5},
        "interruption":         [{"score": 0.5}] * 5,
        "punctuation_pressure": [{"period_count": 0, "comma_count": 0, "dash_count": 0,
                                   "semicolon_count": 0, "other_count": 0,
                                   "text": "hello"}] * 5,
        "stanza_lengths":       {"stanza_lengths": [5]},
    }


class TestScoreAllRarityMode:
    def test_high_only_low_value_gets_zero_rarity(self):
        """A below-median dash_count (high_only) must yield rarity=0."""
        # dash_count at p10 — well below median
        dists = _make_corpus_distributions(["dash_count"])
        summary = {"dash_count": 5.0}   # p10 of [0..100] is 10; 5 is below median
        per_line = _make_per_line()
        scored = score_all(summary, per_line, dists)
        dc = next((m for m in scored if m.metric == "dash_count"), None)
        assert dc is not None
        assert dc.rarity == pytest.approx(0.0), (
            f"dash_count below median should have rarity=0, got {dc.rarity}"
        )

    def test_high_only_high_value_gets_nonzero_rarity(self):
        """An above-median dash_count must yield positive rarity."""
        dists = _make_corpus_distributions(["dash_count"])
        summary = {"dash_count": 90.0}  # above median of [0..100]
        per_line = _make_per_line()
        scored = score_all(summary, per_line, dists)
        dc = next((m for m in scored if m.metric == "dash_count"), None)
        assert dc is not None
        assert dc.rarity > 0.0

    def test_two_sided_low_value_gets_nonzero_rarity(self):
        """A below-median two_sided metric must still yield positive rarity."""
        dists = _make_corpus_distributions(["enjambment_ratio"])
        summary = {"enjambment_ratio": 5.0}
        per_line = _make_per_line()
        scored = score_all(summary, per_line, dists)
        er = next((m for m in scored if m.metric == "enjambment_ratio"), None)
        assert er is not None
        assert er.rarity > 0.0

    def test_high_only_at_median_is_zero(self):
        """Exactly median value for a high_only metric → rarity=0."""
        dists = _make_corpus_distributions(["left_margin_returns"])
        # p50 of uniform [0..100] is 50.0
        summary = {"left_margin_returns": 50.0}
        per_line = _make_per_line()
        scored = score_all(summary, per_line, dists)
        lm = next((m for m in scored if m.metric == "left_margin_returns"), None)
        assert lm is not None
        assert lm.rarity == pytest.approx(0.0, abs=0.02)


# ---------------------------------------------------------------------------
# select_top
# ---------------------------------------------------------------------------

class TestSelectTop:
    def _make_scored(self, specs: list[tuple[str, str, float]]):
        from server.analytics.types import ScoredMetric
        return [
            ScoredMetric(metric=m, family=f, value=0.0,
                         percentile_rank=50.0, rarity=s, score=s)
            for m, f, s in specs
        ]

    def test_one_per_family_first_pass(self):
        scored = self._make_scored([
            ("a", "rhythm",    0.9),
            ("b", "rhythm",    0.8),
            ("c", "structure", 0.7),
            ("d", "semantics", 0.6),
        ])
        top = select_top(scored, n=3)
        assert top == ["a", "c", "d"]

    def test_second_pass_fills_slots(self):
        scored = self._make_scored([
            ("a", "rhythm", 0.9),
            ("b", "rhythm", 0.8),
            ("c", "rhythm", 0.7),
        ])
        top = select_top(scored, n=2, max_per_family=2)
        assert top == ["a", "b"]

    def test_max_per_family_respected(self):
        scored = self._make_scored([
            ("a", "rhythm",    0.9),
            ("b", "rhythm",    0.8),
            ("c", "rhythm",    0.7),
            ("d", "structure", 0.6),
        ])
        top = select_top(scored, n=4, max_per_family=2)
        assert "c" not in top
        assert len(top) == 3  # only 2 rhythm + 1 structure available

    def test_returns_up_to_n(self):
        scored = self._make_scored([
            ("a", "rhythm", 0.9),
            ("b", "rhythm", 0.8),
        ])
        top = select_top(scored, n=6)
        assert len(top) <= 2
