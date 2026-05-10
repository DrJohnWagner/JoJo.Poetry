"""Visualisation metadata for the poetry analytics system.

Each entry describes one candidate visualisation: which metrics drive it,
when to prefer it, how it suppresses weaker siblings, and how it should
behave in the UI.

Selection algorithm (caller's responsibility):
  1. Score each visualisation against the poem's ScoredMetric list.
  2. Apply preferred_if thresholds as activation bonuses.
  3. Apply suppress_if_present: if a higher-ranked entry is already selected,
     remove any entry that lists it in suppress_if_present.
  4. Overlays (visualisation_type == "overlay") are never selected standalone;
     attach them to the highest-priority host chart that supports_overlay.
  5. Enforce max_instances per entry key.
  6. Target 3–5 non-overlay visualisations per poem.

visualisation_type values:
  "spatial"       per-line positional / horizontal-extent chart
  "profile"       per-line sequential signal (line or bar)
  "architecture"  stanza-level structural chart
  "heatmap"       per-line categorical presence matrix
  "distribution"  aggregate histogram (no positional axis)
  "overlay"       annotation layer only; never rendered standalone
"""
from __future__ import annotations

from typing import Any

VISUALISATION_META: dict[str, dict[str, Any]] = {

    # ── Primary structural charts ──────────────────────────────────────────

    "indentation_map": {
        "metrics": {
            "indentation_volatility",
            "avg_indentation_depth",
            "fraction_indented_lines",
            "left_margin_returns",
            "max_indentation_depth",
        },
        "families": {"indentation", "structure"},
        "description": (
            "Per-line horizontal trace of leading spaces. "
            "Reveals inward drift, alignment instability, and margin snapping."
        ),
        "preferred_if": {
            "indentation_volatility": 0.75,
            "left_margin_returns":    0.65,
            "fraction_indented_lines": 0.60,
        },
        "base_weight": 1.3,
        "min_score": 0.55,
        "max_instances": 1,
        "visualisation_type": "spatial",
        "ui_priority": 1.0,
        "suppress_if_present": [],
        "supports_overlay": True,
        "notes": (
            "Primary chart for poems with strong spatial dynamics. "
            "Margin return events annotated as markers. "
            "Accepts semantic_pressure_overlay when negation or repetition is active."
        ),
    },

    "interruption_density_profile": {
        "metrics": {
            "interruption_density_mean",
            "breath_interruption_severity",
            "pressure_peak_line",
            "dash_count",
            "comma_density",
            "syntax_fracture_density",
        },
        "families": {"rhythm", "punctuation", "structure"},
        "description": (
            "Per-line stacked interruption score decomposed into dash, comma, "
            "colon, mid-terminal, indent-shift, and short-line contributions. "
            "Pressure peak annotated as a marker."
        ),
        "preferred_if": {
            "interruption_density_mean":    0.70,
            "breath_interruption_severity": 0.65,
            "pressure_peak_line":           0.60,
        },
        "base_weight": 1.3,
        "min_score": 0.55,
        "max_instances": 1,
        "visualisation_type": "profile",
        "ui_priority": 1.0,
        "suppress_if_present": [],
        "supports_overlay": True,
        "notes": (
            "Accepts momentum_profile as an overlay rather than a sibling chart. "
            "Accepts semantic_pressure_overlay when those metrics are active. "
            "Subsumes punctuation_pressure_matrix when both would be selected."
        ),
    },

    "line_length_contour": {
        "metrics": {
            "line_length_range",
            "median_line_length",
            "shortest_line",
            "longest_line",
        },
        "families": {"line_length"},
        "description": (
            "Per-line character count as a step contour. "
            "Reveals breath variation, expansion, and contraction across the poem."
        ),
        "preferred_if": {
            "line_length_range":   0.65,
            "median_line_length":  0.60,
        },
        "base_weight": 1.1,
        "min_score": 0.50,
        "max_instances": 1,
        "visualisation_type": "profile",
        "ui_priority": 0.85,
        "suppress_if_present": [],
        "supports_overlay": True,
        "notes": (
            "Most meaningful when line_length_range is high. "
            "Terminal stop / enjambment overlay available to show relationship "
            "between breath length and line closure. "
            "Suppresses line_length_distribution when selected."
        ),
    },

    "stanza_architecture": {
        "metrics": {
            "stanza_volatility",
            "syntax_fracture_density",
        },
        "families": {"structure"},
        "description": (
            "Bar sequence showing line-count per stanza in order. "
            "Reveals macro pacing, structural symmetry, and instability."
        ),
        "preferred_if": {
            "stanza_volatility": 0.70,
        },
        "base_weight": 1.2,
        "min_score": 0.50,
        "max_instances": 1,
        "visualisation_type": "architecture",
        "ui_priority": 0.90,
        "suppress_if_present": [],
        "supports_overlay": False,
        "notes": (
            "Not useful when all stanzas are equal length (stanza_volatility near zero). "
            "Caller should suppress when stanza_volatility score is below min_score "
            "regardless of other signals."
        ),
    },

    # ── Secondary / supporting charts ─────────────────────────────────────

    "momentum_profile": {
        "metrics": {
            "momentum_persistence_score",
            "enjambment_ratio",
            "terminal_stop_density",
            "breath_interruption_severity",
        },
        "families": {"rhythm"},
        "description": (
            "Per-line rolling signal of rhythmic continuity derived from enjambment "
            "and interruption. Shows where the poem accelerates, sustains, or arrests."
        ),
        "preferred_if": {
            "momentum_persistence_score": 0.65,
            "enjambment_ratio":           0.60,
        },
        "base_weight": 1.1,
        "min_score": 0.50,
        "max_instances": 1,
        "visualisation_type": "profile",
        "ui_priority": 0.80,
        "suppress_if_present": ["interruption_density_profile"],
        "suppression_weight": 0.65,
        "supports_overlay": True,
        "notes": (
            "Shares underlying signal with interruption_density_profile. "
            "When that chart is selected, render momentum as an overlay on it "
            "rather than a sibling. Standalone only when interruption is absent."
        ),
    },

    "punctuation_pressure_strip": {
        "metrics": {
            "punctuation_per_line",
            "dash_count",
            "comma_density",
            "terminal_stop_density",
        },
        "families": {"punctuation"},
        "description": (
            "Per-line categorical presence strip for period, comma, dash, and "
            "semicolon. Shows punctuation type distribution across the poem."
        ),
        "preferred_if": {
            "punctuation_per_line": 0.65,
            "dash_count":           0.65,
        },
        "requires_any": {
            "terminal_stop_density": 0.50,
            "dash_count":            0.50,
            "punctuation_per_line":  0.50,
        },
        "base_weight": 1.0,
        "min_score": 0.40,
        "max_instances": 1,
        "visualisation_type": "heatmap",
        "ui_priority": 0.70,
        "suppress_if_present": ["interruption_density_profile"],
        "suppression_weight": 0.65,
        "supports_overlay": False,
        "notes": (
            "Suppressed when interruption_density_profile is present: dash and comma "
            "contributions are already decomposed there. "
            "Standalone only when punctuation is the primary signal without high "
            "interruption density."
        ),
    },

    "fracture_map": {
        "metrics": {
            "syntax_fracture_density",
            "left_margin_returns",
            "pressure_peak_line",
            "breath_interruption_severity",
        },
        "families": {"structure", "rhythm"},
        "description": (
            "Per-line fracture event markers: short fragments, large indent shifts, "
            "isolated clauses. Concentrates where structural breakdown occurs."
        ),
        "preferred_if": {
            "syntax_fracture_density": 0.70,
            "left_margin_returns":     0.65,
        },
        "base_weight": 1.1,
        "min_score": 0.55,
        "max_instances": 1,
        "visualisation_type": "profile",
        "ui_priority": 0.75,
        "suppress_if_present": ["indentation_map", "interruption_density_profile"],
        "suppression_weight": 0.0,
        "supports_overlay": True,
        "notes": (
            "Suppressed when both indentation_map and interruption_density_profile "
            "are selected: those charts already surface the same events. "
            "Standalone only when fracture is the dominant feature in the absence "
            "of those primaries."
        ),
    },

    "line_length_distribution": {
        "metrics": {
            "median_line_length",
            "shortest_line",
            "longest_line",
            "line_length_range",
        },
        "families": {"line_length"},
        "description": (
            "Histogram of line character counts in bins. "
            "Shows the line-length vocabulary without positional information."
        ),
        "preferred_if": {
            "line_length_range": 0.70,
        },
        "base_weight": 0.85,
        "min_score": 0.20,
        "max_instances": 1,
        "visualisation_type": "distribution",
        "ui_priority": 0.55,
        "suppress_if_present": ["line_length_contour"],
        "suppression_weight": 0.40,
        "supports_overlay": False,
        "notes": (
            "Secondary to line_length_contour. "
            "Useful when distribution shape is the interpretive point "
            "(bimodal, heavy-tailed) rather than positional variation. "
            "Higher min_score than the contour — only surface when line-length "
            "variation is genuinely unusual."
        ),
    },

    # ── Overlay-only ──────────────────────────────────────────────────────

    "semantic_pressure_overlay": {
        "metrics": {
            "negation_density",
            "repetition_pressure",
        },
        "families": {"semantics"},
        "description": (
            "Line-level annotation marking negation and repetition activation. "
            "Not a standalone chart — annotates a host visualisation."
        ),
        "preferred_if": {
            "negation_density":    0.65,
            "repetition_pressure": 0.60,
        },
        "base_weight": 1.0,
        "min_score": 0.20,
        "max_instances": 1,
        "visualisation_type": "overlay",
        "ui_priority": 0.50,
        "suppress_if_present": [],
        "supports_overlay": False,
        "preferred_hosts": [
            "interruption_density_profile",
            "momentum_profile",
            "indentation_map",
            "line_length_contour",
        ],
        "notes": (
            "Always rendered as an annotation layer on a host chart. "
            "Preferred hosts in priority order: interruption_density_profile, "
            "momentum_profile, indentation_map, line_length_contour. "
            "Never rendered standalone. "
            "Low base_weight ensures semantic metrics never displace structural charts."
        ),
    },
}
