"""Visualisation recommendation orchestration.

Pipeline:
    metric scores
        → candidate generation   (generate_candidates)
        → resonance boosts       (apply_resonance_boosts)
        → diversity bonus        (apply_diversity_bonus)
        → threshold gating       (apply_threshold_gating)
        → suppression            (apply_suppression)
        → family balancing       (apply_family_balance)
        → role assignment        (assign_roles)
        → minimum breadth        (enforce_minimum_breadth)
        → overlay attachment     (attach_overlays)
        → explanation generation (generate_explanation)
        → render plan            (select_visualisations)

Each stage is a pure function: independently testable, deterministic.

suppress_if_present semantics: a candidate is suppressed when ALL keys
listed in its suppress_if_present are present in the gated candidate set.
Single-element lists degrade to the standard "suppress if X is present".
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from server.analytics.resonance import STRUCTURAL_RESONANCE
from server.analytics.scoring import METRIC_META
from server.analytics.types import (
    FinalRenderPlan,
    OverlayAttachment,
    ScoredMetric,
    VisualisationCandidate,
)
from server.analytics.visualisation import VISUALISATION_META

log = logging.getLogger(__name__)

# ── Role slot limits ───────────────────────────────────────────────────────

_MAX_SECONDARY  = 2
_MAX_SUPPORTING = 2
_MAX_PER_FAMILY = 2

# Overlays activate at 75% of their stated min_score: they consume little
# UI space and should annotate structure rather than compete for slots.
_OVERLAY_THRESHOLD_DISCOUNT = 0.75

# Affinity multipliers applied to host candidate scores during overlay
# attachment. Index = position in the visualisation's preferred_hosts list.
# Hosts not in the list receive 1.0 (no affinity). Values are strong enough
# to override modest score differences while still losing to a much
# higher-scored non-preferred host.
_HOST_AFFINITIES = [1.40, 1.30, 1.20, 1.10]  # positions 0, 1, 2, 3+

# Quality floors: candidates below these scores are not assigned to the
# corresponding role even if a slot is available. Prefer omission over
# weak inclusion.
_MIN_SECONDARY_SCORE  = 0.40
_MIN_SUPPORTING_SCORE = 0.30


# ── Prose mappings ─────────────────────────────────────────────────────────

# (prose_when_high, prose_when_low) keyed by percentile_rank ≥ 50 / < 50
_METRIC_PROSE: dict[str, tuple[str, str]] = {
    "indentation_volatility":       ("volatile spatial positioning",          "unusually stable indentation"),
    "left_margin_returns":          ("repeated margin resets",                "consistent spatial drift"),
    "avg_indentation_depth":        ("sustained inward displacement",         "predominantly flush alignment"),
    "fraction_indented_lines":      ("heavy spatial displacement",            "near-uniform left alignment"),
    "max_indentation_depth":        ("extreme indentation depth",             "shallow spatial range"),
    "interruption_density_mean":    ("dense mid-line interruption",           "unusually uninterrupted lines"),
    "breath_interruption_severity": ("compressed and clustered breath units", "sustained open breath"),
    "pressure_peak_line":           ("a concentrated pressure peak",          "distributed interruption pressure"),
    "dash_count":                   ("heavy em-dash deployment",              "minimal dash interruption"),
    "comma_density":                ("comma-heavy lines",                     "sparse comma use"),
    "momentum_persistence_score":   ("sustained forward momentum",            "arrested rhythmic continuity"),
    "enjambment_ratio":             ("strong enjambment movement",            "heavily terminal lines"),
    "terminal_stop_density":        ("heavy terminal closure",                "predominantly open line ends"),
    "line_length_range":            ("wide breath variation",                 "tightly controlled line lengths"),
    "median_line_length":           ("long central line breath",              "compressed central line breath"),
    "syntax_fracture_density":      ("dense syntactic fracture",              "structurally cohesive syntax"),
    "stanza_volatility":            ("unstable stanza architecture",          "unusually regular stanza units"),
    "repetition_pressure":          ("significant lexical recurrence",        "low repetition"),
    "negation_density":             ("dense negation",                        "minimal negation"),
    "punctuation_per_line":         ("high overall punctuation load",         "spare punctuation"),
    "shortest_line":                ("extremely compressed lines",            "unusually long minimum lines"),
    "longest_line":                 ("extremely extended lines",              "compact maximum lines"),
}

_VIS_ENDINGS: dict[str, str] = {
    "indentation_map": "shape the poem's spatial behaviour",
    "interruption_density_profile": "interrupt the poem's forward movement",
    "line_length_map": "define the poem's breath variation",
    "stanza_architecture": "drive structural instability",
    "momentum_profile": "characterise rhythmic continuity",
    "punctuation_pressure_strip": "apply localised punctuation pressure",
    "fracture_map": "fracture the poem's syntactic continuity",
    "line_length_distribution": "define the poem's line-length vocabulary",
    "semantic_pressure_overlay": "annotate structural patterns",
    "indentation_overlay": "mark indentation shifts across lines",
}

_VIS_DENSITY: dict[str, str] = {
    "spatial":      "high",
    "profile":      "high",
    "architecture": "medium",
    "heatmap":      "medium",
    "distribution": "low",
    "overlay":      "low",
}


# ── Internal working type ──────────────────────────────────────────────────

@dataclass
class _Candidate:
    key: str
    score: float
    driven_by: list[str]
    contributing: list[str]
    suppressed_by: str | None = None
    suppresses: list[str] = field(default_factory=list)


# ── Candidate generation ───────────────────────────────────────────────────

def _preferred_if_boost(
    preferred_if: dict[str, float],
    scores: dict[str, ScoredMetric],
) -> float:
    """Multiplier in [1.0, 1.3]: +0.1 per preferred_if threshold met."""
    met = sum(
        1 for m, threshold in preferred_if.items()
        if m in scores and scores[m].rarity >= threshold
    )
    return 1.0 + 0.1 * met


def generate_candidates(
    scores: dict[str, ScoredMetric],
    vis_meta: dict[str, dict[str, Any]] = VISUALISATION_META,
    metric_meta: dict[str, dict[str, Any]] = METRIC_META,
) -> list[_Candidate]:
    """Score all visualisation candidates against available metric scores.

    Per-metric contribution: rarity × display_weight (from metric_meta).
    Candidate score: base_weight × (0.6 × mean_contribution + 0.4 × max_contribution) × preferred_if_boost.
    """
    candidates = []
    for key, vis in vis_meta.items():
        active = [m for m in vis["metrics"] if m in scores]
        if not active:
            continue

        contributions = [
            scores[m].rarity * metric_meta.get(m, {}).get("display_weight", 1.0)
            for m in active
        ]
        mean_c = sum(contributions) / len(contributions)
        max_c  = max(contributions)
        raw    = vis["base_weight"] * (0.6 * mean_c + 0.4 * max_c)
        boost  = _preferred_if_boost(vis.get("preferred_if", {}), scores)
        final  = round(raw * boost, 5)

        active_sorted = sorted(active, key=lambda m: contributions[active.index(m)], reverse=True)
        candidates.append(_Candidate(
            key=key,
            score=final,
            driven_by=active_sorted[:3],
            contributing=active_sorted,
        ))

    candidates.sort(key=lambda c: c.score, reverse=True)
    log.debug("Candidates: %s", [(c.key, c.score) for c in candidates])
    return candidates


# ── Resonance boosts ───────────────────────────────────────────────────────

def apply_resonance_boosts(
    candidates: list[_Candidate],
    scores: dict[str, ScoredMetric],
    resonance: dict[str, dict[str, Any]] = STRUCTURAL_RESONANCE,
) -> list[_Candidate]:
    """Boost candidate scores when a structural resonance group fires.

    A group fires when ≥ min_activations of its metrics have rarity ≥
    activation_threshold. Firing multiplies the score of each listed
    visualisation candidate. Multiple groups can boost the same candidate;
    their multipliers stack. Re-sorts candidates by score after all boosts.
    """
    index = {c.key: c for c in candidates}

    for group_name, group in resonance.items():
        threshold = group.get("activation_threshold", 0.5)
        min_act   = group.get("min_activations", 2)
        active    = sum(
            1 for m in group["metrics"]
            if m in scores and scores[m].rarity >= threshold
        )
        if active < min_act:
            continue
        log.debug("Resonance '%s' fired (%d/%d)", group_name, active, len(group["metrics"]))
        for vis_key, multiplier in group["boost_visualisations"].items():
            if vis_key in index:
                index[vis_key].score = round(index[vis_key].score * multiplier, 5)
                log.debug("  boost %s ×%.2f → %.5f", vis_key, multiplier, index[vis_key].score)

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# ── Diversity bonus ────────────────────────────────────────────────────────

def apply_diversity_bonus(
    candidates: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
    bonus: float = 1.10,
) -> list[_Candidate]:
    """Apply a modest bonus to candidates that introduce a new family.

    Iterates in current score-desc order. A non-overlay candidate earns the
    bonus if at least one of its families is not yet represented by any
    higher-scoring candidate. Re-sorts after all bonuses are applied.

    Overlays neither earn the bonus nor mark families as seen: they annotate
    rather than occupy a structural panel slot.
    """
    seen: set[str] = set()
    for c in candidates:
        vis = vis_meta[c.key]
        if vis["visualisation_type"] == "overlay":
            continue
        new_families = vis["families"] - seen
        if new_families:
            c.score = round(c.score * bonus, 5)
            log.debug("Diversity bonus %s (+%s) → %.5f", c.key, new_families, c.score)
        seen.update(vis["families"])

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# ── Threshold gating ───────────────────────────────────────────────────────

def evaluate_activation(
    candidate: _Candidate,
    vis_meta: dict[str, dict[str, Any]],
    scores: dict[str, "ScoredMetric"] | None = None,
) -> tuple[bool, str]:
    """Return (passes, rejection_reason).

    Overlays use a discounted threshold (_OVERLAY_THRESHOLD_DISCOUNT) because
    they consume minimal UI space and should annotate freely.

    If vis_meta contains a requires_any dict and scores are provided, at least
    one of the listed metrics must meet its rarity threshold. This prevents
    broad weak signal from activating charts that require local concentration.
    """
    vis = vis_meta[candidate.key]
    threshold = vis["min_score"]
    if vis["visualisation_type"] == "overlay":
        threshold = round(threshold * _OVERLAY_THRESHOLD_DISCOUNT, 4)
    if candidate.score < threshold:
        return False, f"score {candidate.score:.4f} < effective_min_score {threshold:.4f}"
    if scores:
        requires_any = vis.get("requires_any")
        if requires_any and not any(
            m in scores and scores[m].rarity >= req_threshold
            for m, req_threshold in requires_any.items()
        ):
            active = {m: round(scores[m].rarity, 3) for m in requires_any if m in scores}
            return False, f"requires_any not met: {active}"
    return True, ""


def apply_threshold_gating(
    candidates: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
    scores: dict[str, "ScoredMetric"] | None = None,
) -> list[_Candidate]:
    passed = []
    for c in candidates:
        ok, reason = evaluate_activation(c, vis_meta, scores)
        if ok:
            passed.append(c)
        else:
            log.debug("Gated %s: %s", c.key, reason)
    return passed


# ── Suppression ────────────────────────────────────────────────────────────

def apply_suppression(
    candidates: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
) -> list[_Candidate]:
    """Apply suppress_if_present rules (ALL-semantics: all listed keys must
    be present in the gated candidate set to trigger).

    When triggered, the candidate's score is multiplied by suppression_weight
    from vis_meta (default 0.0 = total suppression). Candidates with a
    non-zero weight survive with a penalised score; zero-weight candidates
    are removed. suppressed_by is set in both cases.
    """
    all_keys = {c.key for c in candidates}
    surviving: list[_Candidate] = []

    for c in candidates:
        trigger_keys = vis_meta[c.key].get("suppress_if_present", [])
        if trigger_keys and all(k in all_keys for k in trigger_keys):
            weight = vis_meta[c.key].get("suppression_weight", 0.0)
            suppressor = max(
                (d for d in candidates if d.key in trigger_keys),
                key=lambda d: d.score,
            )
            suppressor.suppresses.append(c.key)
            c.suppressed_by = suppressor.key
            if weight == 0.0:
                log.debug("Fully suppressed %s by %s", c.key, suppressor.key)
                continue
            c.score = round(c.score * weight, 5)
            log.debug(
                "Penalised %s by %s (weight=%.2f) → %.5f",
                c.key, suppressor.key, weight, c.score,
            )

        surviving.append(c)

    surviving.sort(key=lambda c: c.score, reverse=True)
    return surviving


# ── Family balancing ───────────────────────────────────────────────────────

def apply_family_balance(
    candidates: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
    max_per_family: int = _MAX_PER_FAMILY,
) -> list[_Candidate]:
    """Drop lowest-scoring candidates when a family exceeds max_per_family.
    Overlays are exempt: they annotate rather than occupy a panel slot.
    """
    family_counts: dict[str, int] = {}
    balanced: list[_Candidate] = []

    for c in candidates:
        vis = vis_meta[c.key]
        if vis["visualisation_type"] == "overlay":
            balanced.append(c)
            continue
        families: set[str] = vis["families"]
        if any(family_counts.get(f, 0) >= max_per_family for f in families):
            log.debug("Family-balanced out %s (families %s)", c.key, families)
            continue
        for f in families:
            family_counts[f] = family_counts.get(f, 0) + 1
        balanced.append(c)

    return balanced


# ── Role assignment ────────────────────────────────────────────────────────

def assign_roles(
    candidates: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
    min_secondary_score: float = _MIN_SECONDARY_SCORE,
    min_supporting_score: float = _MIN_SUPPORTING_SCORE,
) -> tuple[
    _Candidate | None,
    list[_Candidate],
    list[_Candidate],
    list[_Candidate],
]:
    """Partition candidates into (primary, secondary, supporting, overlays).

    Overlays are separated first. Among standalones (score-desc order):
    - first non-semantics-only → primary (no quality floor)
    - next _MAX_SECONDARY with score ≥ min_secondary_score → secondary
    - next _MAX_SUPPORTING with score ≥ min_supporting_score → supporting
    - remainder discarded

    Semantic-only candidates cannot be primary. Candidates below the quality
    floor for their target role are skipped — prefer omission over weak
    inclusion.
    """
    overlays = [c for c in candidates if vis_meta[c.key]["visualisation_type"] == "overlay"]
    standalones = [c for c in candidates if vis_meta[c.key]["visualisation_type"] != "overlay"]

    primary: _Candidate | None = None
    secondary: list[_Candidate] = []
    supporting: list[_Candidate] = []

    for c in standalones:
        families: set[str] = vis_meta[c.key]["families"]
        if primary is None and families != {"semantics"}:
            primary = c
        elif len(secondary) < _MAX_SECONDARY and c.score >= min_secondary_score:
            secondary.append(c)
        elif len(supporting) < _MAX_SUPPORTING and c.score >= min_supporting_score:
            supporting.append(c)

    return primary, secondary, supporting, overlays


# ── Minimum breadth ────────────────────────────────────────────────────────

def enforce_minimum_breadth(
    primary: _Candidate | None,
    secondary: list[_Candidate],
    supporting: list[_Candidate],
    post_suppression: list[_Candidate],
    gated: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
    min_vis: int = 3,
    min_families: int = 3,
) -> tuple[_Candidate | None, list[_Candidate], list[_Candidate]]:
    """Soft minimum breadth enforcement.

    If the plan has fewer than min_vis non-overlay visualisations but the
    gated set spans ≥ min_families distinct non-trivial families (any family
    except 'semantics'), draw from the post-suppression pool to reach min_vis.

    Candidates drawn this way survived threshold gating and suppression but
    were discarded by family balance or role-slot limits.
    """
    assigned = {c.key for c in ([primary] if primary else []) + secondary + supporting}
    current = len(assigned)
    if current >= min_vis:
        return primary, secondary, supporting

    non_trivial = {
        f
        for c in gated
        if vis_meta[c.key]["visualisation_type"] != "overlay"
        for f in vis_meta[c.key]["families"]
        if f != "semantics"
    }
    if len(non_trivial) < min_families:
        return primary, secondary, supporting

    extras = [
        c for c in post_suppression
        if c.key not in assigned
        and vis_meta[c.key]["visualisation_type"] != "overlay"
        and c.score >= _MIN_SUPPORTING_SCORE
    ]
    needed = min_vis - current
    for c in extras[:needed]:
        supporting.append(c)
        log.debug("Breadth rule added %s (plan was %d < min %d)", c.key, current, min_vis)
        current += 1

    return primary, secondary, supporting


# ── Overlay attachment ─────────────────────────────────────────────────────

def _host_affinity(host_key: str, preferred_hosts: list[str]) -> float:
    """Affinity multiplier for a host based on its position in preferred_hosts.
    Returns 1.0 for hosts not in the list.
    """
    try:
        idx = preferred_hosts.index(host_key)
    except ValueError:
        return 1.0
    return _HOST_AFFINITIES[min(idx, len(_HOST_AFFINITIES) - 1)]


def attach_overlays(
    overlay_candidates: list[_Candidate],
    charts: list[_Candidate],
    vis_meta: dict[str, dict[str, Any]],
) -> list[OverlayAttachment]:
    """Attach each overlay to its highest affinity-weighted compatible host.

    Each candidate host is scored as raw_score × affinity, where affinity is
    determined by the overlay's preferred_hosts list (_HOST_AFFINITIES).
    Hosts not in the list get affinity 1.0. This ensures structurally coherent
    preferred hosts win over marginally higher-scored non-preferred hosts while
    still losing to dramatically higher-scored alternatives.
    Overlays with no compatible host are silently dropped.
    """
    if not overlay_candidates:
        return []
    hosts = [c for c in charts if vis_meta[c.key]["supports_overlay"]]
    if not hosts:
        return []

    attached = []
    for overlay in overlay_candidates:
        preferred = vis_meta[overlay.key].get("preferred_hosts", [])
        allowed = vis_meta[overlay.key].get("allowed_hosts")
        eligible_hosts = [h for h in hosts if not allowed or h.key in allowed]
        if not eligible_hosts:
            continue

        host = max(
            eligible_hosts, key=lambda h: h.score * _host_affinity(h.key, preferred)
        )
        attached.append(OverlayAttachment(
            overlay_type=overlay.key,
            host_visualisation=host.key,
            score=round(overlay.score, 5),
            driven_by=overlay.driven_by,
        ))
        log.debug("Overlay %s → %s (affinity ×%.2f)", overlay.key, host.key, _host_affinity(host.key, preferred))
    return attached


# ── Explanation generation ─────────────────────────────────────────────────

def _metric_prose_fragment(metric: str, pct_rank: float) -> str:
    if metric not in _METRIC_PROSE:
        return metric.replace("_", " ")
    high, low = _METRIC_PROSE[metric]
    return high if pct_rank >= 50.0 else low


def generate_explanation(
    vis_key: str,
    driven_by: list[str],
    scores: dict[str, ScoredMetric],
    vis_meta: dict[str, dict[str, Any]],
) -> str:
    """Single sentence: '{driver(s)} {vis-ending}.'"""
    ending = _VIS_ENDINGS.get(vis_key, "are unusually active")
    fragments = [
        _metric_prose_fragment(m, scores[m].percentile_rank)
        for m in driven_by[:2]
        if m in scores
    ]
    if not fragments:
        return vis_meta[vis_key]["description"].split(".")[0] + "."
    if len(fragments) == 1:
        return f"{fragments[0].capitalize()} {ending}."
    return f"{fragments[0].capitalize()} and {fragments[1]} {ending}."


# ── Display utilities ──────────────────────────────────────────────────────

def _display_mode(role: str) -> str:
    return "expanded" if role == "primary" else "compact"


def _density(vis_type: str) -> str:
    return _VIS_DENSITY.get(vis_type, "medium")


# ── Build typed result ─────────────────────────────────────────────────────

def _build(
    c: _Candidate,
    role: str,
    attached_overlays: list[OverlayAttachment],
    scores: dict[str, ScoredMetric],
    vis_meta: dict[str, dict[str, Any]],
) -> VisualisationCandidate:
    vis = vis_meta[c.key]
    return VisualisationCandidate(
        type=c.key,
        score=c.score,
        driven_by=c.driven_by,
        contributing_metrics=c.contributing,
        role=role,
        overlays=[o for o in attached_overlays if o.host_visualisation == c.key],
        display_mode=_display_mode(role),
        families=sorted(vis["families"]),
        ui_priority=vis["ui_priority"],
        density=_density(vis["visualisation_type"]),
        supports_overlay=vis["supports_overlay"],
        suppresses=c.suppresses,
        suppressed_by=c.suppressed_by,
        explanation=generate_explanation(c.key, c.driven_by, scores, vis_meta),
    )


# ── Main orchestration ─────────────────────────────────────────────────────

def select_visualisations(
    metric_scores: list[ScoredMetric],
    visualisation_meta: dict[str, dict[str, Any]] = VISUALISATION_META,
    metric_meta: dict[str, dict[str, Any]] = METRIC_META,
    resonance_meta: dict[str, dict[str, Any]] = STRUCTURAL_RESONANCE,
) -> FinalRenderPlan:
    """Convert metric scoring output into a ranked render plan.

    Returns 1 primary + up to 2 secondary + up to 2 supporting visualisations,
    with overlays attached to the highest-scored compatible host.
    Targeting 3–5 total non-overlay visualisations per poem.
    """
    scores = {m.metric: m for m in metric_scores}

    candidates  = generate_candidates(scores, visualisation_meta, metric_meta)
    candidates  = apply_resonance_boosts(candidates, scores, resonance_meta)
    candidates  = apply_diversity_bonus(candidates, visualisation_meta)
    gated       = apply_threshold_gating(candidates, visualisation_meta, scores)
    suppressed  = apply_suppression(gated, visualisation_meta)
    balanced    = apply_family_balance(suppressed, visualisation_meta)

    primary_c, secondary_cs, supporting_cs, overlay_cs = assign_roles(balanced, visualisation_meta)
    primary_c, secondary_cs, supporting_cs = enforce_minimum_breadth(
        primary_c, secondary_cs, supporting_cs, suppressed, gated, visualisation_meta,
    )

    all_charts = (
        ([primary_c] if primary_c else [])
        + secondary_cs
        + supporting_cs
    )
    attached = attach_overlays(overlay_cs, all_charts, visualisation_meta)

    primary = (
        _build(primary_c, "primary", attached, scores, visualisation_meta)
        if primary_c else None
    )
    secondary  = [_build(c, "secondary",  attached, scores, visualisation_meta) for c in secondary_cs]
    supporting = [_build(c, "supporting", attached, scores, visualisation_meta) for c in supporting_cs]
    ordered    = ([primary] if primary else []) + secondary + supporting

    log.debug(
        "Render plan: primary=%s secondary=%s supporting=%s overlays=%s",
        primary.type if primary else None,
        [s.type for s in secondary],
        [s.type for s in supporting],
        [o.overlay_type for o in attached],
    )
    return FinalRenderPlan(
        primary=primary,
        secondary=secondary,
        supporting=supporting,
        overlays=attached,
        ordered_visualisations=ordered,
    )
