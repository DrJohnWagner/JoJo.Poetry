/**
 * Render architecture types — four-layer system:
 *   data  → spec  → engine  → presentation
 *
 * Nothing below knows about analytics computation or React rendering.
 * Each layer consumes the layer above it and is ignorant of layers below.
 */

import type { InterruptionEventType, Theme } from "./theme";

// ---------------------------------------------------------------------------
// API shapes (mirror server/analytics/types.py)
// ---------------------------------------------------------------------------

export interface IndentationLine {
  line: number;
  leading_spaces: number;
  indent_level: number;
  text: string;
}

export interface LineLengthLine {
  line: number;
  with_spaces: number;
  without_spaces: number;
}

export interface InterruptionEventMark {
  type: InterruptionEventType;
  x: number;
  value: number;
}

export interface InterruptionLine {
  line: number;
  score: number;
  dash_score: number;
  comma_score: number;
  semicolon_score: number;
  colon_score: number;
  midline_terminal_score: number;
  indent_shift_score: number;
  short_line_score: number;
  text: string;
  events: InterruptionEventMark[];
}

export interface PunctuationLine {
  line: number;
  period_count: number;
  comma_count: number;
  dash_count: number;
  semicolon_count: number;
  other_count: number;
  text: string;
}

export interface StanzaData {
  stanza_lengths: number[];
  total_stanzas: number;
  total_lines: number;
  average_lines_per_stanza: number;
}

export interface PerLineData {
  indentation: IndentationLine[];
  line_lengths: LineLengthLine[];
  interruption: InterruptionLine[];
  punctuation: PunctuationLine[];
  stanzas: StanzaData;
}

export interface AnalyticsSummary {
  max_indentation_depth: number;
  fraction_indented_lines: number;
  avg_indentation_depth: number;
  indentation_volatility: number;
  median_line_length: number;
  shortest_line: number;
  longest_line: number;
  line_length_range: number;
  punctuation_per_line: number;
  dash_count: number;
  comma_density: number;
  terminal_stop_density: number;
  enjambment_ratio: number;
  interruption_density_mean: number;
  stanza_volatility: number;
  repetition_pressure: number;
  negation_density: number;
  pressure_peak_line: number;
  left_margin_returns: number;
  breath_interruption_severity: number;
  momentum_persistence_score: number;
  syntax_fracture_density: number;
}

// ---------------------------------------------------------------------------
// Layer 1: Render Data — typed, drawable data per vis type
// ---------------------------------------------------------------------------

export type VisType =
  | "indentation_map"
  | "line_length_contour"
  | "line_length_distribution"
  | "interruption_density_profile"
  | "momentum_profile"
  | "stanza_architecture"
  | "punctuation_pressure_strip"
  | "fracture_map"
  | "semantic_pressure_overlay";

export interface IndentationMapData {
  kind: "indentation_map";
  lines: Array<{ lineIndex: number; depth: number; text: string }>;
  maxDepth: number;
  lineCount: number;
}

export interface LineLengthContourData {
  kind: "line_length_contour";
  lines: Array<{ lineIndex: number; length: number }>;
  maxLength: number;
  lineCount: number;
}

export interface InterruptionDensityData {
  kind: "interruption_density_profile";
  lines: Array<{ lineIndex: number; score: number; events: InterruptionEventMark[] }>;
  maxScore: number;
  lineCount: number;
}

export interface MomentumProfileData {
  kind: "momentum_profile";
  lines: Array<{ lineIndex: number; momentum: number }>;
  lineCount: number;
}

export interface StanzaArchitectureData {
  kind: "stanza_architecture";
  stanzas: Array<{
    stanzaIndex: number;
    startLineIndex: number;
    endLineIndex: number;
    lineLengths: number[];
  }>;
  totalLines: number;
  maxLineLength: number;
}

export interface PunctuationPressureData {
  kind: "punctuation_pressure_strip";
  lines: Array<{
    lineIndex: number;
    score: number;
    events: Array<{
      type: "comma" | "em_dash" | "semicolon" | "colon" | "terminal";
      x: number;
    }>;
  }>;
  lineCount: number;
  maxScore: number;
}

export interface FractureMapData {
  kind: "fracture_map";
  lines: Array<{ lineIndex: number; value: number }>;
  lineCount: number;
}

export interface SemanticPressureData {
  kind: "semantic_pressure_overlay";
  lines: Array<{ lineIndex: number; pressure: number }>;
  lineCount: number;
}

export interface LineLengthDistributionData {
  kind: "line_length_distribution";
  bins: Array<{ label: string; count: number }>;
  maxCount: number;
  totalLines: number;
}

export type VisData =
  | IndentationMapData
  | LineLengthContourData
  | LineLengthDistributionData
  | InterruptionDensityData
  | MomentumProfileData
  | StanzaArchitectureData
  | PunctuationPressureData
  | FractureMapData
  | SemanticPressureData;

// ---------------------------------------------------------------------------
// Layer 2: Render Spec — declarative scene description
// ---------------------------------------------------------------------------

export type PrimitiveType =
  | "bar_series"
  | "vertical_bar_series"
  | "topology_trace"
  | "contour_fill"
  | "density_field"
  | "interruption_event_plot"
  | "interruption_density_summary"
  | "segmentation_band"
  | "marker_overlay"
  | "event_strip"
  | "interruption_event_strip"
  | "punctuation_event_plot"
  | "punctuation_pressure_summary";

// All x/y coordinates in normalised [0, 1] — the engine scales to pixels.

export interface BarSeriesData {
  kind: "bar_series";
  bars: Array<{ index: number; y: number; height: number; width: number }>;
}

export interface VerticalBarSeriesData {
  kind: "vertical_bar_series";
  bars: Array<{ index: number; x: number; width: number; height: number }>;
}

export interface TopologyTraceData {
  kind: "topology_trace";
  points: Array<{ x: number; y: number }>;
}

export interface ContourFillData {
  kind: "contour_fill";
  points: Array<{ x: number; y: number }>;
  baselineX: number;
}

export interface DensityFieldData {
  kind: "density_field";
  cells: Array<{ index: number; y: number; height: number; value: number }>;
}

export interface InterruptionEventPlotData {
  kind: "interruption_event_plot";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    events: InterruptionEventMark[];
  }>;
}

export interface InterruptionDensitySummaryData {
  kind: "interruption_density_summary";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    score: number;
  }>;
}

export interface SegmentationBandData {
  kind: "segmentation_band";
  segments: Array<{ stanzaIndex: number; startFrac: number; endFrac: number }>;
}

export interface MarkerOverlayData {
  kind: "marker_overlay";
  markers: Array<{ lineIndex: number; y: number; height: number; value: number }>;
}

export interface EventStripData {
  kind: "event_strip";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    events: Array<{ type: string; x: number }>;
  }>;
}

export interface InterruptionEventStripData {
  kind: "interruption_event_strip";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    events: InterruptionEventMark[];
  }>;
}

export interface PunctuationEventPlotData {
  kind: "punctuation_event_plot";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    events: Array<{
      type: "comma" | "em_dash" | "semicolon" | "colon" | "terminal";
      x: number;
    }>;
  }>;
}

export interface PunctuationPressureSummaryData {
  kind: "punctuation_pressure_summary";
  lines: Array<{
    lineIndex: number;
    y: number;
    height: number;
    score: number;
  }>;
}

export type PrimitiveData =
  | BarSeriesData
  | VerticalBarSeriesData
  | TopologyTraceData
  | ContourFillData
  | DensityFieldData
  | InterruptionEventPlotData
  | InterruptionDensitySummaryData
  | SegmentationBandData
  | MarkerOverlayData
  | EventStripData
  | InterruptionEventStripData
  | PunctuationEventPlotData
  | PunctuationPressureSummaryData;

export interface LayerStyle {
  fill?: string;
  fillAlt?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface LayerSpec {
  id: string;
  primitive: PrimitiveType;
  data: PrimitiveData;
  style: LayerStyle;
}

export interface AxisTick {
  normPos: number;  // position along axis in [0, 1]
  label: string;
}

export interface AxisSpec {
  label: string;
  ticks: AxisTick[];
  startNorm?: number;
  endNorm?: number;
  labelPlacement?: "center-rotated" | "top-horizontal";
  labelOffset?: number;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LegendItem {
  label:     string;
  glyph:     string;
  color:     string;
  fontSize?: number;
}

export interface LegendSpec {
  items: LegendItem[];
  columns?: number;
}

export interface RenderSpec {
  layers: LayerSpec[];
  xAxis?: AxisSpec;
  yAxis?: AxisSpec;
  margin?: Margin;
  legend?: LegendSpec;
}

export const VIS_TITLES: Record<VisType, string> = {
  indentation_map:              "Spatial Position",
  line_length_contour:          "Line Length",
  line_length_distribution:     "Line Length Distribution",
  interruption_density_profile: "Interruption Density",
  momentum_profile:             "Rhythmic Momentum",
  stanza_architecture:          "Stanza Architecture",
  punctuation_pressure_strip:   "Punctuation Pressure",
  fracture_map:                 "Syntax Fracture",
  semantic_pressure_overlay:    "Semantic Pressure",
};

export interface VisConfig {
  width: number;
  height: number;
  theme: Theme;
}
