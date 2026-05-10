/**
 * Render Spec Layer — declarative scene builders.
 *
 * Each builder takes typed VisData and a VisConfig, applies linear scales,
 * and returns a RenderSpec: an ordered list of LayerSpec objects with
 * normalised [0, 1] coordinates, plus axis specs. The engine scales to pixels.
 *
 * Overlay layers built here are additive. Overlay application (including
 * transformational overlays that rewrite host specs) is handled by the
 * overlay application layer.
 */

import { linearScale } from "./scales";
import {
  INTERRUPTION_DENSITY_CHROME,
  VIS_STYLE_DEFAULTS,
  darken,
} from "../theme";
import type {
  VisData,
  VisType,
  VisConfig,
  RenderSpec,
  LayerSpec,
  AxisSpec,
  AxisTick,
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

// ---------------------------------------------------------------------------
// Axis helpers
// ---------------------------------------------------------------------------

function yAxis(lineCount: number): AxisSpec {
  const desired = Math.min(5, lineCount);
  const step    = Math.max(1, Math.round((lineCount - 1) / (desired - 1)));
  const idxSet  = new Set<number>([0]);
  for (let i = step; i < lineCount - 1; i += step) idxSet.add(i);
  idxSet.add(lineCount - 1);

  return {
    label: "Line",
    ticks: Array.from(idxSet)
      .sort((a, b) => a - b)
      .map((i) => ({
        normPos: lineCount > 1 ? i / (lineCount - 1) : 0,
        label:   String(i + 1),
      })),
  };
}

function interruptionYAxis(lineCount: number): AxisSpec {
  const ticks: AxisTick[] = [];

  for (let i = 0; i < lineCount; i++) {
    const lineNumber = i + 1;
    if (lineNumber === 1 || lineNumber % 10 === 0) {
      ticks.push({
        normPos: lineCount > 1 ? i / (lineCount - 1) : 0,
        label: String(lineNumber),
      });
    }
  }

  return {
    label: "Line",
    ticks,
  };
}

function xAxis(label: string, domain: number, count: number = 4): AxisSpec {
  const ticks: AxisTick[] = [];
  for (let i = 0; i <= count; i++) {
    const v = (domain / count) * i;
    ticks.push({
      normPos: i / count,
      label:   Number.isInteger(v) ? String(v) : v.toFixed(1),
    });
  }
  return { label, ticks };
}

function fixedXAxis(label: string, values: number[]): AxisSpec {
  const max = values[values.length - 1];
  return {
    label,
    ticks: values.map((v) => ({
      normPos: max > 0 ? v / max : 0,
      label:   v % 1 === 0 ? String(v) : v.toFixed(2),
    })),
  };
}

// ---------------------------------------------------------------------------
// Individual builders
// ---------------------------------------------------------------------------

function buildIndentationMapSpec(data: IndentationMapData, cfg: VisConfig): RenderSpec {
  const scaleX = linearScale([0, data.maxDepth], [0, 1]);
  const cellH  = 1 / data.lineCount;

  return {
    layers: [{
      id:        "indentation-bars",
      primitive: "bar_series",
      data: {
        kind: "bar_series",
        bars: data.lines.map((l) => ({
          index:  l.lineIndex,
          y:      l.lineIndex * cellH,
          height: cellH,
          width:  scaleX(l.depth),
        })),
      },
      style: { fill: cfg.theme.indentation, opacity: VIS_STYLE_DEFAULTS.indentationBarOpacity },
    }],
    xAxis: xAxis("Spaces", data.maxDepth, Math.min(4, data.maxDepth)),
    yAxis: yAxis(data.lineCount),
  };
}

function buildLineLengthContourSpec(data: LineLengthContourData, cfg: VisConfig): RenderSpec {
  const scaleX = linearScale([0, data.maxLength], [0, 1]);
  const cellH  = 1 / data.lineCount;

  return {
    layers: [{
      id:        "length-bars",
      primitive: "bar_series",
      data: {
        kind: "bar_series",
        bars: data.lines.map((l) => ({
          index: l.lineIndex,
          y: l.lineIndex * cellH,
          height: cellH,
          width: scaleX(l.length),
        })),
      },
      style: {
        fill: cfg.theme.lineLength,
        stroke: darken(cfg.theme.lineLength),
        strokeWidth: VIS_STYLE_DEFAULTS.lineLengthBarBorderWidth,
        opacity: VIS_STYLE_DEFAULTS.lineLengthFillOpacity,
      },
    }],
    xAxis: xAxis("Characters", data.maxLength),
    yAxis: yAxis(data.lineCount),
  };
}

function buildLineLengthDistributionSpec(data: LineLengthDistributionData, cfg: VisConfig): RenderSpec {
  const n      = data.bins.length;
  const colW   = 1 / n;
  const gap    = colW * 0.12;
  const scaleH = linearScale([0, data.maxCount], [0, 1]);

  const bars = data.bins.map((bin, i) => ({
    index:  i,
    x:      i * colW + gap / 2,
    width:  colW - gap,
    height: scaleH(bin.count),
  }));

  const xAxisSpec: AxisSpec = {
    label: "Characters",
    ticks: data.bins.map((bin, i) => ({
      normPos: (i + 0.5) * colW,
      label:   bin.label,
    })),
  };

  const countStep = Math.ceil(data.maxCount / 4);
  const yAxisSpec: AxisSpec = {
    label: "Lines",
    ticks: Array.from({ length: Math.floor(data.maxCount / countStep) + 1 }, (_, i) => {
      const v = i * countStep;
      return { normPos: 1 - v / data.maxCount, label: String(v) };
    }),
  };

  return {
    layers: [{
      id:        "length-distribution",
      primitive: "vertical_bar_series",
      data:      { kind: "vertical_bar_series", bars },
      style:     { fill: cfg.theme.lineLength, opacity: VIS_STYLE_DEFAULTS.lineLengthDistributionOpacity },
    }],
    xAxis: xAxisSpec,
    yAxis: yAxisSpec,
  };
}

function buildInterruptionDensitySpec(data: InterruptionDensityData, cfg: VisConfig): RenderSpec {
  const cellH  = 1 / data.lineCount;

  return {
    layers: [
      {
        id: "interruption-event-plot",
        primitive: "interruption_event_plot",
        data: {
          kind: "interruption_event_plot",
          lines: data.lines.map((l) => ({
            lineIndex: l.lineIndex,
            y: l.lineIndex * cellH,
            height: cellH,
            events: l.events,
          })),
        },
        style: { fill: cfg.theme.interruption, opacity: VIS_STYLE_DEFAULTS.interruptionDensityOpacity },
      },
      {
        id: "interruption-density-summary",
        primitive: "interruption_density_summary",
        data: {
          kind: "interruption_density_summary",
          lines: data.lines.map((l) => ({
            lineIndex: l.lineIndex,
            y: l.lineIndex * cellH,
            height: cellH,
            score: data.maxScore > 0 ? l.score / data.maxScore : 0,
          })),
        },
        style: { fill: cfg.theme.interruption, opacity: VIS_STYLE_DEFAULTS.interruptionDensityOpacity },
      },
    ],
    xAxis:  {
      label: "Line Progression →",
      ticks: [],
      endNorm: INTERRUPTION_DENSITY_CHROME.plotEnd,
      labelOffset: 18,
    },
    yAxis:  { ...interruptionYAxis(data.lineCount), labelPlacement: "top-horizontal" },
    margin: VIS_STYLE_DEFAULTS.interruptionMargin,
  };
}

function buildMomentumProfileSpec(data: MomentumProfileData, cfg: VisConfig): RenderSpec {
  const points = data.lines.map((l) => ({
    x: l.momentum,
    y: l.lineIndex / (data.lineCount - 1 || 1),
  }));

  const stepPoints = points.reduce<Array<{ x: number; y: number }>>((acc, p, i) => {
    if (i === 0) {
      acc.push(p);
      return acc;
    }

    const prev = points[i - 1];
    // Staircase topology: horizontal segment, then vertical drop/rise.
    acc.push({ x: p.x, y: prev.y });
    acc.push(p);
    return acc;
  }, []);

  return {
    layers: [
      {
        id:        "momentum-trace",
        primitive: "topology_trace",
        data:      { kind: "topology_trace", points: stepPoints },
        style:     {
          stroke: cfg.theme.momentum,
          strokeWidth: VIS_STYLE_DEFAULTS.momentumTraceStrokeWidth,
          opacity: VIS_STYLE_DEFAULTS.momentumTraceOpacity,
        },
      },
    ],
    xAxis: fixedXAxis("Momentum", [0, 0.25, 0.5, 0.75, 1.0]),
    yAxis: yAxis(data.lineCount),
  };
}

function buildStanzaArchitectureSpec(data: StanzaArchitectureData, cfg: VisConfig): RenderSpec {
  const totalStanzas = data.stanzas.length;
  const lineCounts   = data.stanzas.map((s) => s.endLineIndex - s.startLineIndex + 1);
  const maxCount     = Math.max(...lineCounts, 1);
  const scaleX       = linearScale([0, maxCount], [0, 1]);
  const bandH        = 1 / totalStanzas;

  const bars = data.stanzas.map((_, i) => ({
    index:  i,
    y:      i * bandH,
    height: bandH,
    width:  scaleX(lineCounts[i]),
  }));

  // Y-axis: stanza number centred in each band.
  const stanzaTicks = data.stanzas.map((_, i) => ({
    normPos: (i + 0.5) * bandH,
    label:   String(i + 1),
  }));

  return {
    layers: [{
      id:        "stanza-bars",
      primitive: "bar_series",
      data:      { kind: "bar_series", bars },
      style:     { fill: cfg.theme.stanzaA, opacity: VIS_STYLE_DEFAULTS.stanzaBarOpacity },
    }],
    xAxis: xAxis("Lines per stanza", maxCount, Math.min(4, maxCount)),
    yAxis: { label: "Stanza", ticks: stanzaTicks },
  };
}

function buildPunctuationPressureSpec(data: PunctuationPressureData, cfg: VisConfig): RenderSpec {
  const cellH = 1 / data.lineCount;

  return {
    layers: [
      {
        id: "punctuation-event-plot",
        primitive: "punctuation_event_plot",
        data: {
          kind: "punctuation_event_plot",
          lines: data.lines.map((l) => ({
            lineIndex: l.lineIndex,
            y: l.lineIndex * cellH,
            height: cellH,
            events: l.events,
          })),
        },
        style: { fill: cfg.theme.punctuation, opacity: VIS_STYLE_DEFAULTS.punctuationStripOpacity },
      },
      {
        id: "punctuation-pressure-summary",
        primitive: "punctuation_pressure_summary",
        data: {
          kind: "punctuation_pressure_summary",
          lines: data.lines.map((l) => ({
            lineIndex: l.lineIndex,
            y: l.lineIndex * cellH,
            height: cellH,
            score: l.score,
          })),
        },
        style: { fill: cfg.theme.punctuation, opacity: VIS_STYLE_DEFAULTS.punctuationStripOpacity },
      },
    ],
    xAxis: {
      label: "Poem progression →",
      ticks: [],
      endNorm: INTERRUPTION_DENSITY_CHROME.plotEnd,
      labelOffset: 18,
    },
    yAxis: { ...interruptionYAxis(data.lineCount), labelPlacement: "top-horizontal" },
    margin: VIS_STYLE_DEFAULTS.interruptionMargin,
  };
}

function buildFractureMapSpec(data: FractureMapData, cfg: VisConfig): RenderSpec {
  const cellH = 1 / data.lineCount;

  return {
    layers: [{
      id:        "fracture-bars",
      primitive: "bar_series",
      data: {
        kind: "bar_series",
        bars: data.lines.map((l) => ({
          index: l.lineIndex,
          y: l.lineIndex * cellH,
          height: cellH,
          width: l.value,
        })),
      },
      style: {
        fill: cfg.theme.fracture,
        stroke: darken(cfg.theme.fracture),
        strokeWidth: VIS_STYLE_DEFAULTS.fractureBarBorderWidth,
        opacity: VIS_STYLE_DEFAULTS.fractureFillOpacity,
      },
    }],
    xAxis: fixedXAxis("Intensity", [0, 0.5, 1.0]),
    yAxis: yAxis(data.lineCount),
  };
}

// Additive overlay builder; transformational handling lives in overlay/apply.
export function buildSemanticPressureOverlayLayers(
  data: SemanticPressureData,
  cfg: VisConfig,
): LayerSpec[] {
  const cellH = 1 / data.lineCount;

  return [{
    id:        "semantic-pressure",
    primitive: "marker_overlay",
    data: {
      kind:    "marker_overlay",
      markers: data.lines.map((l) => ({
        lineIndex: l.lineIndex,
        y:         l.lineIndex * cellH,
        height:    cellH,
        value:     l.pressure,
      })),
    },
    style: { fill: cfg.theme.semantic, opacity: VIS_STYLE_DEFAULTS.semanticOverlayOpacity },
  }];
}

export function composeSpec(host: RenderSpec, overlayLayers: LayerSpec[]): RenderSpec {
  return { ...host, layers: [...host.layers, ...overlayLayers] };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const BUILDERS: {
  [K in VisType]: (data: VisData, cfg: VisConfig) => RenderSpec;
} = {
  indentation_map:              (d, c) => buildIndentationMapSpec(d as IndentationMapData, c),
  line_length_contour:          (d, c) => buildLineLengthContourSpec(d as LineLengthContourData, c),
  line_length_distribution:     (d, c) => buildLineLengthDistributionSpec(d as LineLengthDistributionData, c),
  interruption_density_profile: (d, c) => buildInterruptionDensitySpec(d as InterruptionDensityData, c),
  momentum_profile:             (d, c) => buildMomentumProfileSpec(d as MomentumProfileData, c),
  stanza_architecture:          (d, c) => buildStanzaArchitectureSpec(d as StanzaArchitectureData, c),
  punctuation_pressure_strip:   (d, c) => buildPunctuationPressureSpec(d as PunctuationPressureData, c),
  fracture_map:                 (d, c) => buildFractureMapSpec(d as FractureMapData, c),
  semantic_pressure_overlay:    (d, c) => ({
    layers: buildSemanticPressureOverlayLayers(d as SemanticPressureData, c),
  }),
};

export function buildVisSpec(data: VisData, cfg: VisConfig): RenderSpec {
  return BUILDERS[data.kind](data, cfg);
}
