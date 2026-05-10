export type InterruptionEventType =
    | "dash"
    | "comma"
    | "semicolon"
    | "colon"
    | "midline_terminal"
    | "indent_shift"
    | "short_line"

export interface Theme {
    indentation: string
    lineLength: string
    interruption: string
    momentum: string
    stanzaA: string
    stanzaB: string
    punctuation: string
    fracture: string
    semantic: string
    trace: string
}

export interface InterruptionEventConfig {
    glyph: string
    color: string
    fontSize: number
    label: string
}

export const COLOURMAP = {
    Blue: "#0077BB",
    Cyan: "#33BBEE",
    Teal: "#009988",
    Orange: "#EE7733",
    Red: "#CC3311",
    Magenta: "#EE3377",
    Grey: "#BBBBBB",
    Black: "#000000AA",
} as const

export type ColourmapEntry = (typeof COLOURMAP)[keyof typeof COLOURMAP]

function clampChannel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)))
}

function adjustColour(
    colour: ColourmapEntry,
    amount: number,
    toward: 0 | 255
): string {
    const match = /^#([0-9a-fA-F]{6})$/.exec(colour)
    if (!match) return colour

    const [redHex, greenHex, blueHex] = [
        match[1].slice(0, 2),
        match[1].slice(2, 4),
        match[1].slice(4, 6),
    ]
    const mix = Math.max(0, Math.min(1, amount))
    const red = parseInt(redHex, 16)
    const green = parseInt(greenHex, 16)
    const blue = parseInt(blueHex, 16)

    const next = [red, green, blue]
        .map((channel) => clampChannel(channel + (toward - channel) * mix))
        .map((channel) => channel.toString(16).padStart(2, "0").toUpperCase())
        .join("")

    return `#${next}`
}

export function darker(colour: ColourmapEntry, amount = 0.15): string {
    return adjustColour(colour, amount, 0)
}

export const darken = darker

export function lighter(colour: ColourmapEntry, amount = 0.15): string {
    return adjustColour(colour, amount, 255)
}

export const DEFAULT_RENDER_MARGIN = {
    top: 8,
    right: 8,
    bottom: 28,
    left: 44,
}

export const RENDER_CHROME = {
    axisColor: COLOURMAP.Black,
    labelColor: COLOURMAP.Black,
    tickSize: 3,
    tickLabelSize: 12,
    axisLabelSize: 14,
    axisStrokeWidth: 0.5,
    yAxisLabelTranslateX: 10,
    yAxisTickLabelGap: 3,
    xAxisLabelBottomOffset: 3,
    xAxisTickLabelOffset: 9,
    legendTranslateY: 6,
    legendRowHeight: 18,
    legendSymbolPad: 12,
    legendTextOffset: 20,
    legendTextSize: 10,
    segmentationBandEven: COLOURMAP.Grey,
    segmentationBandOdd: COLOURMAP.Blue,
    eventStripRadiusFactor: 0.25,
    eventStripMinRadius: 1.5,
    interruptionGlyphScaleDivisor: 8,
} as const

export const VIS_STYLE_DEFAULTS = {
    indentationBarOpacity: 0.85,
    lineLengthFillOpacity: 1,
    lineLengthBarBorderWidth: 1,
    lineLengthTraceStrokeWidth: 1.5,
    lineLengthTraceOpacity: 0.9,
    lineLengthDistributionOpacity: 0.85,
    interruptionDensityOpacity: 1,
    interruptionLegendColumns: 4,
    interruptionMargin: {
        top: 28,
        right: 8,
        bottom: 64,
        left: 44,
    },
    momentumFillOpacity: 0.2,
    momentumTraceStrokeWidth: 1.5,
    momentumTraceOpacity: 0.85,
    stanzaBarOpacity: 0.85,
    punctuationStripOpacity: 0.85,
    fractureFillOpacity: 1,
    fractureBarBorderWidth: 1,
    fractureTraceStrokeWidth: 1.25,
    fractureTraceOpacity: 0.85,
    semanticOverlayOpacity: 0.35,
} as const

export const INTERRUPTION_DENSITY_CHROME = {
    plotEnd: 0.84,
    summaryStart: 0.90,
    summaryWidth: 0.09,
    plotInset: 0.012,
    guideColor: COLOURMAP.Black,
    guideStrokeWidth: 0.5,
    eventColor: COLOURMAP.Red,
    eventOpacity: 0.9,
    eventStrokeWidth: 1.25,
    eventHeightFactor: 0.68,
    glowColor: COLOURMAP.Red,
    glowOpacity: 0.1,
    glowWidths: [0.018, 0.036, 0.064],
    glowHeightFactor: 0.72,
    summaryColor: COLOURMAP.Red,
    summaryOpacity: 0.78,
    summaryBarHeightFactor: 0.55,
    summaryLabel: "Density",
    summaryLabelOffsetY: 10,
    summaryLabelSize: 12,
} as const

export const PUNCTUATION_PRESSURE_CHROME = {
    commaColor: COLOURMAP.Blue,
    emDashColor: COLOURMAP.Magenta,
    semicolonColor: darker(COLOURMAP.Magenta, 0.25),
    colonColor: COLOURMAP.Teal,
    terminalColor: COLOURMAP.Orange,
    eventOpacity: 0.9,
    summaryColor: lighter(COLOURMAP.Blue, 0.15),
    summaryStrokeWidth: 1,
    summaryOpacity: 0.9,
    summaryLabel: "Pressure",
    summaryLabelSize: 12,
} as const

export const OVERLAY_TRANSFORM_DEFAULTS = {
    fracture_map: {
        minScale: 0.85,
        maxScale: 1.35,
        baseStrokeWidth: 1.25,
        strokeBoost: 1.0,
        fillOpacity: 0.1,
        colorMix: 1.0,
    },
    line_length_contour: {
        minScale: 0.9,
        maxScale: 1.18,
        baseStrokeWidth: 1.5,
        strokeBoost: 0.65,
        fillOpacity: 0.22,
        colorMix: 0.65,
    },
    momentum_profile: {
        minScale: 0.92,
        maxScale: 1.15,
        baseStrokeWidth: 1.5,
        strokeBoost: 0.5,
        fillOpacity: 0.18,
        colorMix: 0.6,
    },
} as const

export const EVENT_STRIP_TYPE_COLORS: Record<string, string> = {
    dash: COLOURMAP.Magenta,
    period: COLOURMAP.Grey,
    comma: COLOURMAP.Blue,
    semicolon: COLOURMAP.Cyan,
    other: COLOURMAP.Orange,
}

export const PUNCTUATION_EVENT_X: Record<string, number> = {
    period: 0.1,
    comma: 0.25,
    dash: 0.45,
    semicolon: 0.65,
    other: 0.82,
}

export const INTERRUPTION_EVENTS: Record<
    InterruptionEventType,
    InterruptionEventConfig
> = {
    dash: {
        glyph: "‒",
        color: COLOURMAP.Red,
        fontSize: 24,
        label: "Dash (— –)",
    },
    midline_terminal: {
        glyph: "●",
        color: COLOURMAP.Blue,
        fontSize: 9,
        label: "Mid-line terminal",
    },
    semicolon: {
        glyph: ";",
        color: COLOURMAP.Cyan,
        fontSize: 18,
        label: "Semicolon (;)",
    },
    colon: {
        glyph: ":",
        color: COLOURMAP.Magenta,
        fontSize: 18,
        label: "Colon (:)",
    },
    comma: {
        glyph: ",",
        color: COLOURMAP.Orange,
        fontSize: 18,
        label: "Comma (,)",
    },
    indent_shift: {
        glyph: "▶",
        color: COLOURMAP.Teal,
        fontSize: 9,
        label: "Indent shift",
    },
    short_line: {
        glyph: "‒",
        color: COLOURMAP.Teal,
        fontSize: 24,
        label: "Short line (≤ 12)",
    },
}

export const DEFAULT_THEME: Theme = {
    indentation: COLOURMAP.Blue,
    lineLength: COLOURMAP.Grey,
    interruption: COLOURMAP.Orange,
    momentum: COLOURMAP.Magenta,
    stanzaA: COLOURMAP.Blue,
    stanzaB: COLOURMAP.Grey,
    punctuation: COLOURMAP.Red,
    fracture: COLOURMAP.Orange,
    semantic: COLOURMAP.Teal,
    trace: COLOURMAP.Grey,
}
