import type { PlotlyFigure } from "../types"
import type { Data } from "plotly.js"
import { BaseChart } from "./BaseChart"

const GLYPH_FONT_FAMILY =
    'var(--font-glyph), var(--font-glyph-alt), "Noto Sans TC", "Noto Sans CJK TC", "Noto Sans CJK SC", "Noto Sans CJK JP", var(--font-serif), serif'

const INTERRUPTION_EVENT_STYLE = {
    color: "#355C7D",
    glyph: "•",
    label: "Interruption event",
    size: 13,
} as const

const INDENTATION_OVERLAY_STYLE = {
    color: "#9B59B6",
    label: "Indent shift",
    size: 13,
} as const

export class InterruptionDensityChart extends BaseChart {
    readonly title = "Interruption Density"

    buildFigure(): PlotlyFigure {
        type InterruptionPoint = { x: number; y: number; value: number }
        type IndentPoint = { y: number; value: number }

        const lines = this.perLine.interruption
        const maxScore = Math.max(...lines.map((l) => l.score), 1)
        const lineNumbers = lines.map((line) => line.line)
        const lineAxis = this.makeLineNumberAxis({ lineNumbers })

        // Exclude indent_shift events from the main interruption scatter
        const points: InterruptionPoint[] = lines.flatMap((line) =>
            line.events
                .filter((event) => event.type !== "indent_shift")
                .map((event) => ({
                    x: Math.max(0, Math.min(1, event.x)),
                    y: line.line,
                    value: event.value,
                }))
        )

        // Indentation events — only when the overlay is requested
        const indentPoints: IndentPoint[] = this.overlayTypes.includes("indentation_overlay")
            ? lines.flatMap((line) =>
                  line.events
                      .filter((e) => e.type === "indent_shift")
                      .map((e) => ({ y: line.line, value: e.value }))
              )
            : []

        const eventTrace: Data[] =
            points.length === 0
                ? []
                : [
                      {
                          type: "scatter",
                          mode: "text" as const,
                          x: points.map((p) => p.x),
                          y: points.map((p) => p.y),
                          customdata: points.map((p) => p.value),
                          xaxis: "x" as const,
                          yaxis: "y" as const,
                          name: INTERRUPTION_EVENT_STYLE.label,
                          text: points.map(() => INTERRUPTION_EVENT_STYLE.glyph),
                          textposition: "middle center",
                          textfont: {
                              color: INTERRUPTION_EVENT_STYLE.color,
                              size: INTERRUPTION_EVENT_STYLE.size,
                              family: GLYPH_FONT_FAMILY,
                          },
                          hovertemplate: "Line %{y}<br>Interruption @ %{x:.2f}<br>Value %{customdata:.2f}<extra></extra>",
                      },
                  ]

        const indentTrace: Data[] =
            indentPoints.length === 0
                ? []
                : [
                      {
                          type: "scatter",
                          mode: "text" as const,
                          x: indentPoints.map(() => 0.04),
                          y: indentPoints.map((p) => p.y),
                          customdata: indentPoints.map((p) => p.value),
                          xaxis: "x" as const,
                          yaxis: "y" as const,
                          name: INDENTATION_OVERLAY_STYLE.label,
                          text: indentPoints.map((p) => (p.value >= 0 ? "→" : "←")),
                          textposition: "middle center",
                          textfont: {
                              color: INDENTATION_OVERLAY_STYLE.color,
                              size: INDENTATION_OVERLAY_STYLE.size,
                              family: GLYPH_FONT_FAMILY,
                          },
                          hovertemplate: "Line %{y}<br>Indent shift %{customdata:.2f}<extra></extra>",
                      },
                  ]

        const summaryTrace: Data = {
            type: "bar",
            orientation: "h",
            x: lines.map((line) => line.score / maxScore),
            y: lines.map((line) => line.line),
            xaxis: "x2",
            yaxis: "y2",
            marker: { color: "#D1495B" },
            name: "Density",
            showlegend: false,
            hovertemplate: "Line %{y}<br>Density %{x:.2f}<extra></extra>",
        }

        return this.withBaseFigure({
            data: [...eventTrace, ...indentTrace, summaryTrace],
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
                    zeroline: false,
                    showgrid: false,
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
                    title: { text: "Density", standoff: 10 },
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
