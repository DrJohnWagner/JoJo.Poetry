"""Structural resonance groups.

A group models multiple metrics converging on the same formal behaviour.
When enough of a group's metrics activate strongly (rarity ≥
activation_threshold), the group fires and boosts the scores of its
listed visualisation candidates by the given multipliers.

Boost multipliers follow a shared scale:
    mild redundancy removal / soft preference   1.10 – 1.15
    strong convergence signal                   1.20 – 1.25
    (values above 1.3 would distort family balance)
"""
from __future__ import annotations

from typing import Any

STRUCTURAL_RESONANCE: dict[str, dict[str, Any]] = {

    "arrested_continuity": {
        "metrics": {
            "momentum_persistence_score",
            "terminal_stop_density",
            "left_margin_returns",
            "breath_interruption_severity",
        },
        "boost_visualisations": {
            "momentum_profile":           1.15,
            "punctuation_pressure_strip": 1.10,
        },
        "activation_threshold": 0.5,
        "min_activations":      2,
    },

    "spatial_instability": {
        "metrics": {
            "indentation_volatility",
            "left_margin_returns",
            "avg_indentation_depth",
            "fraction_indented_lines",
        },
        "boost_visualisations": {
            "indentation_map": 1.15,
            "fracture_map":    1.10,
        },
        "activation_threshold": 0.5,
        "min_activations":      2,
    },

    "punctuation_saturation": {
        "metrics": {
            "dash_count",
            "comma_density",
            "punctuation_per_line",
            "interruption_density_mean",
        },
        "boost_visualisations": {
            "interruption_density_profile": 1.15,
            "punctuation_pressure_strip":   1.10,
        },
        "activation_threshold": 0.5,
        "min_activations":      2,
    },

    "syntactic_fracture": {
        "metrics": {
            "syntax_fracture_density",
            "breath_interruption_severity",
            "pressure_peak_line",
        },
        "boost_visualisations": {
            "fracture_map":                 1.20,
            "interruption_density_profile": 1.10,
        },
        "activation_threshold": 0.5,
        "min_activations":      2,
    },

}
