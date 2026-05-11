import type { Config, Data, Layout } from "plotly.js"

export interface IndentationLine {
    line: number
    leading_spaces: number
    indent_level: number
    text: string
}

export interface LineLengthLine {
    line: number
    with_spaces: number
    without_spaces: number
}

export interface InterruptionEventMark {
    type: string
    x: number
    value: number
}

export interface InterruptionLine {
    line: number
    score: number
    dash_score: number
    comma_score: number
    semicolon_score: number
    colon_score: number
    midline_terminal_score: number
    indent_shift_score: number
    short_line_score: number
    text: string
    events: InterruptionEventMark[]
}

export interface PunctuationLine {
    line: number
    period_count: number
    comma_count: number
    dash_count: number
    semicolon_count: number
    other_count: number
    text: string
}

export interface StanzaData {
    stanza_lengths: number[]
    total_stanzas: number
    total_lines: number
    average_lines_per_stanza: number
}

export interface PerLineData {
    indentation: IndentationLine[]
    line_lengths: LineLengthLine[]
    interruption: InterruptionLine[]
    punctuation: PunctuationLine[]
    stanzas: StanzaData
}

export interface AnalyticsSummary {
    max_indentation_depth: number
    fraction_indented_lines: number
    avg_indentation_depth: number
    indentation_volatility: number
    median_line_length: number
    shortest_line: number
    longest_line: number
    line_length_range: number
    punctuation_per_line: number
    dash_count: number
    comma_density: number
    terminal_stop_density: number
    enjambment_ratio: number
    interruption_density_mean: number
    stanza_volatility: number
    repetition_pressure: number
    negation_density: number
    pressure_peak_line: number
    left_margin_returns: number
    breath_interruption_severity: number
    momentum_persistence_score: number
    syntax_fracture_density: number
}

export type VisType =
    | "indentation_map"
    | "line_length_map"
    | "line_length_distribution"
    | "interruption_density_profile"
    | "momentum_profile"
    | "stanza_architecture"
    | "punctuation_pressure_strip"
    | "fracture_map"
    | "semantic_pressure_overlay"
    | "indentation_overlay"

export interface OverlayAttachment {
    overlay_type: string
    host_visualisation: string
}

export interface VisCandidate {
    type: string
    explanation?: string
}

export interface RenderPlan {
    primary: VisCandidate | null
    secondary: VisCandidate[]
    supporting: VisCandidate[]
    overlays: OverlayAttachment[]
}

export interface PlotlyFigure {
    data: Data[]
    layout: Partial<Layout>
    config?: Partial<Config>
}
