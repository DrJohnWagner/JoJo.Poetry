"""Structural analytics pipeline: summary scalars and per-line visualisation datasets."""
from __future__ import annotations

import re
import string
import statistics
from collections import Counter


TERMINAL_CHARS = frozenset(".?!")
NEGATION_TERMS = frozenset({"no", "not", "never", "neither", "nothing", "without", "nor", "none"})
PUNCT_CHARS = frozenset(string.punctuation)

_METAPHOR_WORDS = frozenset({
    "like", "as", "metaphor", "symbol", "represents", "stands",
    "river", "ocean", "sun", "moon", "fire", "mirror", "shadow",
    "light", "darkness", "bridge", "road", "journey", "storm",
})
_REJECTION_WORDS = frozenset({
    "not", "no", "never", "refuse", "hate", "stop", "enough",
    "fail", "wrong", "nothing", "deny",
})
_BODY_WORDS = frozenset({
    "breath", "breathing", "skin", "hand", "arm", "chest",
    "eye", "eyes", "mouth", "blood", "bone", "finger",
    "heart", "lung", "lungs", "shoulder", "throat", "face",
    "flesh", "scar", "touch", "hold", "weight",
})
_PRESENCE_WORDS = frozenset({
    "presence", "silence", "contact", "close", "space", "near",
    "together", "alone", "still", "quiet", "absent", "here",
    "within", "between", "distance", "edge", "threshold",
})

# Pre-compiled patterns for whole-word matching.
def _pattern(words: frozenset[str]) -> re.Pattern:
    return re.compile(r"\b(?:" + "|".join(re.escape(w) for w in sorted(words)) + r")\b")

_METAPHOR_RE = _pattern(_METAPHOR_WORDS)
_REJECTION_RE = _pattern(_REJECTION_WORDS)
_BODY_RE = _pattern(_BODY_WORDS)
_PRESENCE_RE = _pattern(_PRESENCE_WORDS)


def _plain(body: str) -> str:
    return re.sub(r"<br\s*/?>", "\n", body)


def _non_empty(plain: str) -> list[str]:
    return [line for line in plain.splitlines() if line.strip()]


def _indent_level(line: str, spaces_per_level: int = 4) -> int:
    return (len(line) - len(line.lstrip(" "))) // spaces_per_level


def stanza_length_data(body: str) -> dict:
    plain = _plain(body)
    blocks = [b for b in re.split(r"\n{2,}", plain.strip()) if b.strip()]
    stanza_lengths = [len([l for l in b.splitlines() if l.strip()]) for b in blocks]
    if not stanza_lengths:
        stanza_lengths = [len(_non_empty(plain))]
    distribution = dict(sorted(Counter(stanza_lengths).items()))
    total_lines = sum(stanza_lengths)
    return {
        "stanza_lengths": stanza_lengths,
        "distribution": distribution,
        "total_stanzas": len(stanza_lengths),
        "total_lines": total_lines,
        "average_lines_per_stanza": total_lines / len(stanza_lengths) if stanza_lengths else 0.0,
    }


def indentation_data(body: str, spaces_per_level: int = 4) -> list[dict]:
    rows = []
    for index, line in enumerate(_non_empty(_plain(body)), start=1):
        leading_spaces = len(line) - len(line.lstrip(" "))
        rows.append({
            "line": index,
            "leading_spaces": leading_spaces,
            "indent_level": leading_spaces // spaces_per_level,
            "text": line,
        })
    return rows


def _bin_label(value: int, bin_size: int = 10) -> str:
    if value <= 0:
        return "0"
    start = ((value - 1) // bin_size) * bin_size + 1
    return f"{start}-{start + bin_size - 1}"


def line_length_distribution(body: str, bin_size: int = 10) -> dict:
    lines = _non_empty(_plain(body))
    without_spaces = [len("".join(line.split())) for line in lines]
    with_spaces = [len(line) for line in lines]
    without_counts = Counter(_bin_label(n, bin_size) for n in without_spaces)
    with_counts = Counter(_bin_label(n, bin_size) for n in with_spaces)
    all_bins = sorted(
        set(without_counts) | set(with_counts),
        key=lambda label: int(label.split("-")[0]) if "-" in label else 0,
    )
    return {
        "per_line": [
            {"line": i, "without_spaces": without_spaces[i - 1], "with_spaces": with_spaces[i - 1]}
            for i in range(1, len(lines) + 1)
        ],
        "bins": [
            {"bin": label, "without_spaces": without_counts.get(label, 0), "with_spaces": with_counts.get(label, 0)}
            for label in all_bins
        ],
    }


def interruption_density(body: str) -> list[dict]:
    all_lines = _plain(body).splitlines()
    non_empty  = [l for l in all_lines if l.strip()]
    max_len    = max((len(l.strip()) for l in non_empty), default=1)

    rows: list[dict] = []
    previous_indent: int | None = None  # None = start or after stanza break
    line_number = 0

    for line in all_lines:
        if not line.strip():
            previous_indent = None  # stanza break resets continuity
            continue

        line_number += 1
        stripped      = line.strip()
        leading_spaces = len(line) - len(line.lstrip(" "))
        n   = len(stripped)
        norm = (lambda _n: lambda pos: pos / (_n - 1) if _n > 1 else 0.5)(n)

        dash_score = 0.0
        comma_score = 0.0
        colon_score = 0.0
        midline_terminal_score = 0.0
        events: list[dict] = []

        semicolon_score = 0.0
        for j, c in enumerate(stripped):
            if c in "—–":
                dash_score += 1.0
                events.append({"type": "dash", "x": norm(j), "value": 1.0})
            if c == ",":
                comma_score += 0.5
                events.append({"type": "comma", "x": norm(j), "value": 0.5})
            if c == ";":
                semicolon_score += 0.75
                events.append({"type": "semicolon", "x": norm(j), "value": 0.75})
            if c == ":":
                colon_score += 0.65
                events.append({"type": "colon", "x": norm(j), "value": 0.65})
            if c in TERMINAL_CHARS and j < n - 1:
                midline_terminal_score += 1.0
                events.append({"type": "midline_terminal", "x": norm(j), "value": 1.0})

        # Stanza break (previous_indent is None) → first line of stanza always 0.0.
        # Sign is preserved: positive = further right, negative = back toward margin.
        indent_shift_score = (leading_spaces - previous_indent) / 4 if previous_indent is not None else 0.0
        if indent_shift_score != 0:
            events.append({"type": "indent_shift", "x": 0.0, "value": indent_shift_score})

        short_line_score = 1.0 if n <= 12 else 0.0
        if short_line_score > 0:
            events.append({"type": "short_line", "x": 0.0, "value": n / max_len})

        rows.append({
            "line": line_number,
            "score": dash_score + comma_score + semicolon_score + colon_score + midline_terminal_score + abs(indent_shift_score) + short_line_score,
            "dash_score": dash_score,
            "comma_score": comma_score,
            "semicolon_score": semicolon_score,
            "colon_score": colon_score,
            "midline_terminal_score": midline_terminal_score,
            "indent_shift_score": indent_shift_score,
            "short_line_score": short_line_score,
            "text": line,
            "events": events,
        })
        previous_indent = leading_spaces
    return rows


def punctuation_pressure_data(body: str) -> list[dict]:
    rows = []
    for index, line in enumerate(_non_empty(_plain(body)), start=1):
        rows.append({
            "line": index,
            "period": "." in line,
            "comma": "," in line,
            "dash": "—" in line or "–" in line,
            "semicolon": ";" in line,
            "other": any(c in line for c in ":?!()[]"),
            "period_count": line.count("."),
            "comma_count": line.count(","),
            "dash_count": line.count("—") + line.count("–"),
            "semicolon_count": line.count(";"),
            "other_count": sum(line.count(c) for c in ":?!()[]"),
            "text": line,
        })
    return rows


def metaphor_resistance_heuristic(body: str) -> list[dict]:
    rows = []
    for index, line in enumerate(_non_empty(_plain(body)), start=1):
        lower = line.lower()
        rows.append({
            "line": index,
            "metaphor_attempt": bool(_METAPHOR_RE.search(lower)),
            "rejection": bool(_REJECTION_RE.search(lower)),
            "bodily_pressure": bool(_BODY_RE.search(lower)),
            "presence_pressure": bool(_PRESENCE_RE.search(lower)),
            "text": line,
        })
    return rows


def _empty_summary() -> dict:
    return {
        "max_indentation_depth": 0,
        "fraction_indented_lines": 0.0,
        "avg_indentation_depth": 0.0,
        "indentation_volatility": 0.0,
        "median_line_length": 0.0,
        "shortest_line": 0,
        "longest_line": 0,
        "line_length_range": 0,
        "punctuation_per_line": 0.0,
        "dash_count": 0,
        "comma_density": 0.0,
        "terminal_stop_density": 0.0,
        "enjambment_ratio": 0.0,
        "interruption_density_mean": 0.0,
        "stanza_volatility": 0.0,
        "repetition_pressure": 0.0,
        "negation_density": 0.0,
        "pressure_peak_line": 0,
        "left_margin_returns": 0,
        "breath_interruption_severity": 0.0,
        "momentum_persistence_score": 0.0,
        "syntax_fracture_density": 0.0,
    }


def summary(body: str) -> dict:
    plain = _plain(body)
    lines = _non_empty(plain)
    if not lines:
        return _empty_summary()

    indent_levels = [_indent_level(line) for line in lines]
    lengths_ws = [len(line) for line in lines]
    lengths_no_ws = [len("".join(line.split())) for line in lines]

    indentation_volatility = (
        statistics.mean(abs(indent_levels[i] - indent_levels[i - 1]) for i in range(1, len(indent_levels)))
        if len(indent_levels) > 1 else 0.0
    )

    non_zero_no_ws = [n for n in lengths_no_ws if n > 0]
    shortest_line = min(non_zero_no_ws) if non_zero_no_ws else 0
    longest_line = max(lengths_ws)  # use log1p for analysis/visualisation

    terminal_stop_density = sum(
        1 for line in lines if line.rstrip() and line.rstrip()[-1] in TERMINAL_CHARS
    ) / len(lines)

    interruption_rows = interruption_density(body)
    interruption_density_mean = (
        statistics.mean(row["score"] for row in interruption_rows) if interruption_rows else 0.0
    )

    blocks = [b for b in re.split(r"\n{2,}", plain.strip()) if b.strip()] or [plain]
    stanza_sizes = [len([l for l in b.splitlines() if l.strip()]) for b in blocks]
    stanza_volatility = (
        statistics.mean(abs(stanza_sizes[i] - stanza_sizes[i - 1]) for i in range(1, len(stanza_sizes)))
        if len(stanza_sizes) > 1 else 0.0
    )

    words = re.findall(r"\b[a-zA-Z']+\b", plain.lower())
    total_words = len(words)
    counts = Counter(words)

    dash_count = sum(line.count("—") + line.count("–") for line in lines)
    enjambment_ratio = 1.0 - terminal_stop_density
    line_length_range = longest_line - shortest_line  # use log1p for analysis/visualisation
    leading_spaces_list = [len(line) - len(line.lstrip(" ")) for line in lines]

    # 14 — pressure peak line: 1-indexed line with highest interruption score; use log1p for analysis/visualisation
    pressure_peak_line = (
        max(range(len(interruption_rows)), key=lambda i: interruption_rows[i]["score"]) + 1
        if interruption_rows else 0
    )

    # 22 — left-margin returns: lines where indentation drops ≥ 4 spaces from previous; use log1p for analysis/visualisation
    left_margin_returns = sum(
        1 for i in range(1, len(leading_spaces_list))
        if (leading_spaces_list[i - 1] - leading_spaces_list[i]) >= 4
    )

    # 29 — breath interruption severity: mean interruption + short-line density + clustering
    short_indices = [i for i, line in enumerate(lines) if len(line.strip()) <= 12]
    if len(short_indices) > 1:
        max_run = cur_run = 1
        for i in range(1, len(short_indices)):
            if short_indices[i] == short_indices[i - 1] + 1:
                cur_run += 1
                max_run = max(max_run, cur_run)
            else:
                cur_run = 1
        cluster_boost = max_run / len(lines)
    else:
        cluster_boost = len(short_indices) / len(lines)
    breath_interruption_severity = round(
        interruption_density_mean * 0.6
        + (len(short_indices) / len(lines)) * 0.3
        + cluster_boost * 0.1,
        4,
    )

    # 30 — momentum persistence score: enjambment + low-interruption ratio + low dash rate
    low_interruption_ratio = sum(1 for r in interruption_rows if r["score"] == 0) / len(lines)
    momentum_persistence_score = round(
        enjambment_ratio * 0.5
        + low_interruption_ratio * 0.35
        + (1.0 - min(1.0, dash_count / len(lines))) * 0.15,
        4,
    )

    # 31 — syntax fracture density: fracture events per line
    fragment_count = sum(1 for line in lines if len(line.strip()) <= 8)
    isolated_clause_count = sum(
        1 for line in lines
        if len(line.strip()) <= 20 and (not line.rstrip() or line.rstrip()[-1] not in TERMINAL_CHARS)
    )
    large_shift_count = sum(
        1 for i in range(1, len(leading_spaces_list))
        if abs(leading_spaces_list[i] - leading_spaces_list[i - 1]) >= 8
    )
    syntax_fracture_density = round(
        (dash_count + fragment_count + isolated_clause_count + large_shift_count) / len(lines), 4
    )

    return {
        "max_indentation_depth": max(indent_levels),
        "fraction_indented_lines": round(sum(1 for l in indent_levels if l > 0) / len(lines), 4),
        "avg_indentation_depth": round(statistics.mean(indent_levels), 4),
        "indentation_volatility": round(indentation_volatility, 4),
        "median_line_length": float(statistics.median(lengths_ws)),
        "shortest_line": shortest_line,
        "longest_line": longest_line,
        "line_length_range": longest_line - shortest_line,
        "punctuation_per_line": round(
            sum(sum(1 for c in line if c in PUNCT_CHARS) for line in lines) / len(lines), 4
        ),
        "dash_count": dash_count,
        "comma_density": round(sum(line.count(",") for line in lines) / len(lines), 4),
        "terminal_stop_density": round(terminal_stop_density, 4),
        "enjambment_ratio": round(enjambment_ratio, 4),
        "interruption_density_mean": round(interruption_density_mean, 4),
        "stanza_volatility": round(stanza_volatility, 4),
        "repetition_pressure": round(
            sum(c for c in counts.values() if c >= 2) / total_words if total_words else 0.0, 4
        ),
        "negation_density": round(
            sum(1 for w in words if w in NEGATION_TERMS) / total_words if total_words else 0.0, 4
        ),
        "pressure_peak_line": pressure_peak_line,
        "left_margin_returns": left_margin_returns,
        "breath_interruption_severity": breath_interruption_severity,
        "momentum_persistence_score": momentum_persistence_score,
        "syntax_fracture_density": syntax_fracture_density,
    }
