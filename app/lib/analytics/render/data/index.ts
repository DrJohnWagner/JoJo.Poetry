/**
 * Render Data Layer — pure data transformation, no SVG, no React.
 *
 * Each extractor converts PerLineData + AnalyticsSummary into the typed,
 * drawable data shape for its visualisation. These functions are the only
 * place that knows the mapping between analytics domain values and drawable
 * coordinates/densities.
 */

import type {
  PerLineData,
  AnalyticsSummary,
  VisType,
  VisData,
  IndentationMapData,
  LineLengthContourData,
  LineLengthDistributionData,
  InterruptionDensityData,
  MomentumProfileData,
  StanzaArchitectureData,
  PunctuationPressureData,
  FractureMapData,
  SemanticPressureData,
} from "../types";

const NEGATION_RE = /\b(no|not|never|neither|nothing|without|nor|none)\b/gi;

// ---------------------------------------------------------------------------
// Individual extractors
// ---------------------------------------------------------------------------

function extractIndentationMap(
  perLine: PerLineData,
): IndentationMapData {
  const lines = perLine.indentation.map((l) => ({
    lineIndex: l.line - 1,
    depth: l.leading_spaces,
    text: l.text,
  }));
  const maxDepth = Math.max(...lines.map((l) => l.depth), 1);
  return { kind: "indentation_map", lines, maxDepth, lineCount: lines.length };
}

function extractLineLengthContour(
  perLine: PerLineData,
): LineLengthContourData {
  const lines = perLine.line_lengths.map((l) => ({
    lineIndex: l.line - 1,
    length: l.with_spaces,
  }));
  const maxLength = Math.max(...lines.map((l) => l.length), 1);
  return { kind: "line_length_contour", lines, maxLength, lineCount: lines.length };
}

function extractLineLengthDistribution(
  perLine: PerLineData,
): LineLengthDistributionData {
  const BIN = 10;
  const counts = new Map<number, number>();

  for (const l of perLine.line_lengths) {
    const start = l.with_spaces <= 0 ? 0 : Math.floor((l.with_spaces - 1) / BIN) * BIN + 1;
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }

  const bins = Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, count]) => ({
      label: start === 0 ? "0" : `${start}–${start + BIN - 1}`,
      count,
    }));

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  return {
    kind: "line_length_distribution",
    bins,
    maxCount,
    totalLines: perLine.line_lengths.length,
  };
}

function extractInterruptionDensity(
  perLine: PerLineData,
): InterruptionDensityData {
  const lines = perLine.interruption.map((l) => ({
    lineIndex: l.line - 1,
    score:     l.score,
    events:    l.events,
  }));
  const maxScore = Math.max(...lines.map((l) => l.score), 1);
  return { kind: "interruption_density_profile", lines, maxScore, lineCount: lines.length };
}

function extractMomentumProfile(
  perLine: PerLineData,
): MomentumProfileData {
  const scores = perLine.interruption.map((l) => l.score);
  const maxScore = Math.max(...scores, 1);
  // Momentum = inverse of interruption: high interruption → low momentum.
  const lines = perLine.interruption.map((l) => ({
    lineIndex: l.line - 1,
    momentum: 1 - l.score / maxScore,
  }));
  return { kind: "momentum_profile", lines, lineCount: lines.length };
}

function extractStanzaArchitecture(
  perLine: PerLineData,
): StanzaArchitectureData {
  const stanzaLengths = perLine.stanzas.stanza_lengths;
  const allLineLengths = perLine.line_lengths.map((l) => l.with_spaces);
  const maxLineLength = Math.max(...allLineLengths, 1);

  let cursor = 0;
  const stanzas = stanzaLengths.map((count, i) => {
    const lineLengths = allLineLengths.slice(cursor, cursor + count);
    const seg = {
      stanzaIndex: i,
      startLineIndex: cursor,
      endLineIndex: cursor + count - 1,
      lineLengths,
    };
    cursor += count;
    return seg;
  });

  return {
    kind: "stanza_architecture",
    stanzas,
    totalLines: perLine.stanzas.total_lines,
    maxLineLength,
  };
}

function extractPunctuationPressure(
  perLine: PerLineData,
): PunctuationPressureData {
  type PunctuationEventType = "comma" | "em_dash" | "semicolon" | "colon" | "terminal";

  function extractEvents(text: string): Array<{ type: PunctuationEventType; x: number }> {
    const chars = Array.from(text ?? "");
    const events: Array<{ type: PunctuationEventType; x: number }> = [];

    chars.forEach((char, idx) => {
      const x = chars.length > 1 ? idx / (chars.length - 1) : 1;
      if (char === ",") events.push({ type: "comma", x });
      else if (char === ";") events.push({ type: "semicolon", x });
      else if (char === ":") events.push({ type: "colon", x });
      else if (/[\-\u2012\u2013\u2014]/.test(char)) {
        events.push({ type: "em_dash", x });
      }
    });

    const trimmed = (text ?? "").trimEnd();
    const terminal = Array.from(trimmed).at(-1);
    if (terminal && /[.!?;:\-\u2012\u2013\u2014]/.test(terminal)) {
      events.push({ type: "terminal", x: 1 });
    }

    return events;
  }

  const pressureWeight: Record<PunctuationEventType, number> = {
    comma: 0.6,
    em_dash: 1.0,
    semicolon: 1.0,
    colon: 0.9,
    terminal: 1.2,
  };

  const lines = perLine.punctuation.map((l) => {
    const events = extractEvents(l.text);
    const rawScore = events.reduce((sum, event) => sum + pressureWeight[event.type], 0);
    return { lineIndex: l.line - 1, events, rawScore };
  });

  const maxScore = Math.max(...lines.map((line) => line.rawScore), 1);

  return {
    kind: "punctuation_pressure_strip",
    lines: lines.map((line) => ({
      lineIndex: line.lineIndex,
      events: line.events,
      score: line.rawScore / maxScore,
    })),
    lineCount: lines.length,
    maxScore,
  };
}

function extractFractureMap(
  perLine: PerLineData,
  summary: AnalyticsSummary,
): FractureMapData {
  // Fracture should remain sparse: downweight diffuse comma activity and
  // emphasize structural rupture events (short fragments, terminal breaks,
  // hard punctuation, and indent shocks).
  const weighted = perLine.interruption.map((inter) => {
    const local =
      inter.dash_score * 1.0 +
      inter.semicolon_score * 0.8 +
      inter.colon_score * 0.6 +
      inter.midline_terminal_score * 0.9 +
      Math.abs(inter.indent_shift_score) * 0.7 +
      inter.short_line_score * 1.2 +
      inter.comma_score * 0.15;
    return local;
  });

  const maxWeighted = Math.max(...weighted, 1);
  const baselineScale = 0.55 + summary.syntax_fracture_density * 0.45;
  const peakIdx = Math.max(0, summary.pressure_peak_line - 1);

  const lines = weighted.map((value, i) => {
    const norm = value / maxWeighted;
    const sparse = Math.pow(norm, 1.35);
    const localBase = norm > 0 ? 0.035 : 0;
    const peakBoost = i === peakIdx ? 0.18 : 0;
    return {
      lineIndex: i,
      value: Math.min((sparse * 0.85 + localBase + peakBoost) * baselineScale, 1),
    };
  });

  return { kind: "fracture_map", lines, lineCount: lines.length };
}

function extractSemanticPressure(
  perLine: PerLineData,
  summary: AnalyticsSummary,
): SemanticPressureData {
  // Per-line negation density + corpus-level repetition_pressure as a scalar anchor.
  const lines = perLine.interruption.map((l) => {
    const negCount = (l.text.match(NEGATION_RE) ?? []).length;
    const pressure = Math.min(negCount * 0.4 + summary.repetition_pressure * 0.25, 1);
    return { lineIndex: l.line - 1, pressure };
  });
  return { kind: "semantic_pressure_overlay", lines, lineCount: lines.length };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const EXTRACTORS: {
  [K in VisType]: (perLine: PerLineData, summary: AnalyticsSummary) => VisData;
} = {
  indentation_map:              (p)    => extractIndentationMap(p),
  line_length_contour:          (p)    => extractLineLengthContour(p),
  line_length_distribution:     (p)    => extractLineLengthDistribution(p),
  interruption_density_profile: (p)    => extractInterruptionDensity(p),
  momentum_profile:             (p)    => extractMomentumProfile(p),
  stanza_architecture:          (p)    => extractStanzaArchitecture(p),
  punctuation_pressure_strip:   (p)    => extractPunctuationPressure(p),
  fracture_map:                 (p, s) => extractFractureMap(p, s),
  semantic_pressure_overlay:    (p, s) => extractSemanticPressure(p, s),
};

export function extractVisData(
  type: VisType,
  perLine: PerLineData,
  summary: AnalyticsSummary,
): VisData {
  return EXTRACTORS[type](perLine, summary);
}
