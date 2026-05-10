"""Metric scoring: rarity, local activity, and family-suppressed selection."""
from __future__ import annotations

import statistics
from typing import Any

import numpy as np

from server.analytics.pipeline import TERMINAL_CHARS, summary as compute_summary
from server.analytics.types import MetricScoring, ScoredMetric

PERCENTILE_KEYS = [5, 10, 25, 50, 75, 90, 95]

METRIC_META: dict[str, dict[str, Any]] = {
    # rarity_mode controls directional interpretation of percentile rank:
    #   two_sided  — abs(pct - 50) / 50  (both extremes count equally)
    #   high_only  — max(0, (pct - 50) / 50)  (only above-median values are rare)
    #   low_only   — max(0, (50 - pct) / 50)  (only below-median values are rare)
    #
    # high_only is used for metrics where a zero or near-zero value is structurally
    # neutral and should not dominate scoring merely because it is statistically
    # uncommon in the corpus.
    "max_indentation_depth":        {"family": "indentation",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
    "fraction_indented_lines":      {"family": "indentation",  "display_weight": 1.0,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
    "avg_indentation_depth":        {"family": "indentation",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
    "indentation_volatility":       {"family": "indentation",  "display_weight": 1.0,  "reliability_weight": 1.0,  "local_activity_weight": 1.2,  "rarity_mode": "high_only"},
    "median_line_length":           {"family": "line_length",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "shortest_line":                {"family": "line_length",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "longest_line":                 {"family": "line_length",  "display_weight": 1.0,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "line_length_range":            {"family": "line_length",  "display_weight": 1.2,  "reliability_weight": 1.0,  "local_activity_weight": 1.1,  "rarity_mode": "two_sided"},
    "punctuation_per_line":         {"family": "punctuation",  "display_weight": 1.0,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "dash_count":                   {"family": "punctuation",  "display_weight": 1.1,  "reliability_weight": 1.0,  "local_activity_weight": 1.1,  "rarity_mode": "high_only"},
    "comma_density":                {"family": "punctuation",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "terminal_stop_density":        {"family": "punctuation",  "display_weight": 0.9,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "enjambment_ratio":             {"family": "rhythm",       "display_weight": 1.2,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "interruption_density_mean":    {"family": "rhythm",       "display_weight": 1.3,  "reliability_weight": 1.0,  "local_activity_weight": 1.2,  "rarity_mode": "high_only"},
    "breath_interruption_severity": {"family": "rhythm",       "display_weight": 1.3,  "reliability_weight": 0.9,  "local_activity_weight": 1.1,  "rarity_mode": "high_only"},
    "momentum_persistence_score":   {"family": "rhythm",       "display_weight": 1.2,  "reliability_weight": 0.9,  "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "stanza_volatility":            {"family": "structure",    "display_weight": 1.3,  "reliability_weight": 1.0,  "local_activity_weight": 1.1,  "rarity_mode": "two_sided"},
    "syntax_fracture_density":      {"family": "structure",    "display_weight": 1.3,  "reliability_weight": 0.9,  "local_activity_weight": 1.1,  "rarity_mode": "two_sided"},
    "left_margin_returns":          {"family": "structure",    "display_weight": 1.1,  "reliability_weight": 1.0,  "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
    "pressure_peak_line":           {"family": "structure",    "display_weight": 1.1,  "reliability_weight": 0.95, "local_activity_weight": 1.0,  "rarity_mode": "two_sided"},
    "repetition_pressure":          {"family": "semantics",    "display_weight": 1.1,  "reliability_weight": 0.8,  "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
    "negation_density":             {"family": "semantics",    "display_weight": 1.1,  "reliability_weight": 0.75, "local_activity_weight": 1.0,  "rarity_mode": "high_only"},
}


def _percentile_rank(value: float, dist: dict) -> float:
    """Interpolate percentile rank (0–100) of value in a stored distribution."""
    points = sorted((dist[f"p{p}"], float(p)) for p in PERCENTILE_KEYS)
    if value <= points[0][0]:
        v0, p0 = points[0]
        v1, p1 = points[1]
        if v1 > v0:
            return max(0.0, p0 - (p1 - p0) * (v0 - value) / (v1 - v0))
        return 0.0
    if value >= points[-1][0]:
        v0, p0 = points[-2]
        v1, p1 = points[-1]
        if v1 > v0:
            return min(100.0, p1 + (p1 - p0) * (value - v1) / (v1 - v0))
        return 100.0
    for i in range(len(points) - 1):
        v0, p0 = points[i]
        v1, p1 = points[i + 1]
        if v0 <= value <= v1:
            if v1 == v0:
                return p0
            return p0 + (p1 - p0) * (value - v0) / (v1 - v0)
    return 100.0


def _rarity(pct_rank: float, mode: str = "two_sided") -> float:
    if mode == "high_only":
        return max(0.0, (pct_rank - 50.0) / 50.0)
    if mode == "low_only":
        return max(0.0, (50.0 - pct_rank) / 50.0)
    return abs(pct_rank - 50.0) / 50.0


def _compute_local_activity(values: list[float], weight: float) -> float:
    """CV + peak-excess signal, normalised to [0.5, 1.5] via weight."""
    if len(values) < 3:
        return 1.0
    mean = statistics.mean(values)
    if mean < 1e-9:
        return 0.5
    try:
        cv = statistics.stdev(values) / mean
    except statistics.StatisticsError:
        return 1.0
    peak_excess = (max(values) / (mean + 1e-9)) - 1.0
    raw = cv * 0.6 + min(peak_excess, 3.0) / 3.0 * 0.4
    return min(1.5, 0.5 + min(raw, 1.0) * weight)


def _extract_per_line(metric: str, per_line: dict) -> list[float] | None:
    """Return per-line float values for a metric, or None if not mappable."""
    try:
        if metric in {"indentation_volatility", "max_indentation_depth",
                      "avg_indentation_depth", "fraction_indented_lines"}:
            return [float(r["leading_spaces"]) for r in per_line["indentation"]]
        if metric in {"median_line_length", "longest_line", "line_length_range"}:
            return [float(r["with_spaces"]) for r in per_line["line_lengths"]["per_line"]]
        if metric == "shortest_line":
            return [float(r["without_spaces"]) for r in per_line["line_lengths"]["per_line"]]
        if metric in {"interruption_density_mean", "pressure_peak_line",
                      "breath_interruption_severity", "momentum_persistence_score"}:
            return [float(r["score"]) for r in per_line["interruption"]]
        if metric == "stanza_volatility":
            return [float(n) for n in per_line["stanza_lengths"]["stanza_lengths"]]
        if metric == "punctuation_per_line":
            return [
                float(r["period_count"] + r["comma_count"] + r["dash_count"]
                      + r["semicolon_count"] + r["other_count"])
                for r in per_line["punctuation_pressure"]
            ]
        if metric == "dash_count":
            return [float(r["dash_count"]) for r in per_line["punctuation_pressure"]]
        if metric == "comma_density":
            return [float(r["comma_count"]) for r in per_line["punctuation_pressure"]]
        if metric in {"terminal_stop_density", "enjambment_ratio"}:
            return [
                float(bool(r["text"].rstrip() and r["text"].rstrip()[-1] in TERMINAL_CHARS))
                for r in per_line["punctuation_pressure"]
            ]
    except (KeyError, TypeError, IndexError):
        pass
    return None


def score_all(
    summary_data: dict,
    per_line: dict,
    distributions: dict,
) -> list[ScoredMetric]:
    """Score all metrics for a poem against the corpus distributions.

    per_line keys: indentation, line_lengths, interruption, punctuation_pressure,
    stanza_lengths — matching the pipeline function return values.
    """
    scored = []
    for metric, meta in METRIC_META.items():
        value = summary_data.get(metric)
        if value is None or metric not in distributions:
            continue
        pct_rank = _percentile_rank(float(value), distributions[metric])
        rarity = _rarity(pct_rank, meta.get("rarity_mode", "two_sided"))

        per_line_values = _extract_per_line(metric, per_line)
        local_activity = (
            _compute_local_activity(per_line_values, meta["local_activity_weight"])
            if per_line_values
            else 1.0
        )

        score = round(
            rarity * meta["display_weight"] * meta["reliability_weight"] * local_activity,
            6,
        )
        scored.append(ScoredMetric(
            metric=metric,
            family=meta["family"],
            value=float(value),
            percentile_rank=round(pct_rank, 4),
            rarity=round(rarity, 4),
            score=score,
        ))

    return sorted(scored, key=lambda m: m.score, reverse=True)


def select_top(
    scored: list[ScoredMetric],
    n: int = 6,
    max_per_family: int = 2,
) -> list[str]:
    """Family-suppressed top-N selection.

    First pass: one metric per family (highest scoring).
    Second pass: fill remaining slots, respecting max_per_family.
    """
    family_counts: dict[str, int] = {}
    selected: list[str] = []

    for m in scored:
        if family_counts.get(m.family, 0) == 0 and len(selected) < n:
            selected.append(m.metric)
            family_counts[m.family] = 1

    if len(selected) < n:
        for m in scored:
            if m.metric not in selected and family_counts.get(m.family, 0) < max_per_family:
                selected.append(m.metric)
                family_counts[m.family] = family_counts.get(m.family, 0) + 1
                if len(selected) == n:
                    break

    return selected


def build_scoring(
    summary_data: dict,
    per_line: dict,
    distributions: dict,
) -> MetricScoring:
    scored = score_all(summary_data, per_line, distributions)
    return MetricScoring(
        scores=scored,
        top_metrics=select_top(scored),
    )


def compute_distributions(poems: list) -> dict:
    """Aggregate corpus-wide percentile distributions from a list of poems.

    Accepts Pydantic poem objects (with .body) or plain dicts (with 'body' key).
    """
    summaries = []
    for poem in poems:
        body = getattr(poem, "body", None) or (poem.get("body") if isinstance(poem, dict) else None)
        if not body:
            continue
        try:
            summaries.append(compute_summary(body))
        except Exception:
            pass

    if not summaries:
        return {}

    metrics = list(summaries[0].keys())
    out = {}
    for metric in metrics:
        values = np.array([s[metric] for s in summaries], dtype=float)
        median = float(np.median(values))
        mad = float(np.median(np.abs(values - median)))
        out[metric] = {
            "mean": round(float(np.mean(values)), 6),
            "stddev": round(float(np.std(values, ddof=1)), 6),
            "median": round(median, 6),
            "mad": round(mad, 6),
            **{f"p{p}": round(float(np.percentile(values, p)), 6) for p in PERCENTILE_KEYS},
        }
    return out
