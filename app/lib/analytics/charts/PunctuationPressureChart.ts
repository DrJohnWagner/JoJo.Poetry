import type { PlotlyFigure } from "../types"
import type { Data } from "plotly.js"
import { BaseChart } from "./BaseChart"

const GLYPH_FONT_FAMILY =
    'var(--font-glyph), var(--font-glyph-alt), "Noto Sans TC", "Noto Sans CJK TC", "Noto Sans CJK SC", "Noto Sans CJK JP", var(--font-serif), serif'

const EVENT_STYLE: Record<
    string,
    { color: string; glyph: string; label: string; size: number }
> = {
    dash: { color: "#CC3311", glyph: "—", label: "Dash", size: 14 },
    comma: { color: "#0077BB", glyph: "，", label: "Comma", size: 14 },
    semicolon: { color: "#B04AA6", glyph: "；", label: "Semicolon", size: 14 },
    colon: { color: "#009988", glyph: "：", label: "Colon", size: 14 },
    midline_terminal: {
        color: "#EE7733",
        glyph: "·",
        label: "Mid-line Terminal",
        size: 16,
    },
    indent_shift_increase: {
        color: "#118877",
        glyph: "→",
        label: "Indent Shift",
        size: 14,
    },
    indent_shift_decrease: {
        color: "#118877",
        glyph: "←",
        label: "De-indent Shift",
        size: 14,
    },
    short_line: { color: "#118877", glyph: "•", label: "Short Line", size: 16 },
}

const EVENT_ORDER = [
    "dash",
    "comma",
    "semicolon",
    "colon",
    "midline_terminal",
    "indent_shift_increase",
    "indent_shift_decrease",
    "short_line",
] as const

export class PunctuationPressureChart extends BaseChart {
    readonly title = "Punctuation Pressure"

    buildFigure(): PlotlyFigure {
        type InterruptionPoint = { x: number; y: number; value: number }

        const lines = this.perLine.interruption
        const maxScore = Math.max(...lines.map((line) => line.score), 1)
        const lineNumbers = lines.map((line) => line.line)
        const lineAxis = this.makeLineNumberAxis({ lineNumbers })

        const eventTraces: Data[] = EVENT_ORDER.flatMap((eventType) => {
            const points: InterruptionPoint[] = lines.flatMap((line) =>
                line.events
                    .filter((event) => {
                        if (eventType === "indent_shift_increase") {
                            return event.type === "indent_shift" && event.value > 0
                        }
                        if (eventType === "indent_shift_decrease") {
                            return event.type === "indent_shift" && event.value < 0
                        }
                        return event.type === eventType
                    })
                    .map((event) => ({
                        x: event.type === "indent_shift" ? 0.02 : Math.max(0, Math.min(1, event.x)),
                        y: line.line,
                        value: event.value,
                    }))
            )
            if (points.length === 0) {
                return []
            }

            const trace: Data = {
                type: "scatter" as const,
                mode: "text" as const,
                x: points.map((p) => p.x),
                y: points.map((p) => p.y),
                customdata: points.map((p) => p.value),
                xaxis: "x",
                yaxis: "y",
                name: EVENT_STYLE[eventType].label,
                legendgroup:
                    eventType === "indent_shift_increase" || eventType === "indent_shift_decrease"
                        ? "indentation-shift"
                        : undefined,
                text: points.map(() => EVENT_STYLE[eventType].glyph),
                textposition: "middle center",
                textfont: {
                    color: EVENT_STYLE[eventType].color,
                    size: EVENT_STYLE[eventType].size,
                    family: GLYPH_FONT_FAMILY,
                },
                hovertemplate: `Line %{y}<br>${EVENT_STYLE[eventType].label} @ %{x:.2f}<br>Value %{customdata:.2f}<extra></extra>`,
            }
            return [trace]
        })

        const summaryTrace: Data = {
            type: "bar",
            orientation: "h",
            x: lines.map((line) => line.score / maxScore),
            y: lines.map((line) => line.line),
            xaxis: "x2",
            yaxis: "y2",
            name: "Pressure",
            marker: {
                color: "#66A9D9",
            },
            showlegend: false,
            hovertemplate: "Pressure %{x:.2f}<extra></extra>",
        }

        return this.withBaseFigure({
            data: [...eventTraces, summaryTrace],
            layout: {
                margin: { t: 16, r: 44, b: 44, l: 52 },
                hovermode: "closest",
                showlegend: this.options.isPrimary ?? true,
                legend: {
                    orientation: "h",
                    x: 0,
                    y: -0.18,
                },
                xaxis: {
                    domain: [0, 0.76],
                    title: { text: "Line Progression" },
                    range: [0, 1],
                    tickmode: "array",
                    tickvals: [0, 1],
                    ticktext: ["        Start", "End       "],
                    zeroline: false,
                },
                xaxis2: {
                    domain: [0.8, 1],
                    anchor: "y2",
                    range: [0, 1],
                    tickmode: "array",
                    tickvals: [0, 1],
                    ticktext: ["0", "1"],
                    showgrid: false,
                    zeroline: false,
                },
                yaxis: {
                    ...lineAxis,
                },
                yaxis2: {
                    ...lineAxis,
                    overlaying: "y",
                    side: "right",
                    anchor: "x2",
                    automargin: true,
                    title: { text: "Pressure", standoff: 10 },
                    showline: false,
                    showticklabels: false,
                    ticks: "",
                    ticklen: 0,
                    showgrid: false,
                    zeroline: false,
                },
            },
        })
    }
}
