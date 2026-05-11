import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class FractureMapChart extends BaseChart {
    readonly title = "Syntax Fracture"

    buildFigure(): PlotlyFigure {
        const lines = this.perLine.interruption
        const weighted = lines.map((line) =>
            line.dash_score * 1.0 +
            line.semicolon_score * 0.8 +
            line.colon_score * 0.6 +
            line.midline_terminal_score * 0.9 +
            Math.abs(line.indent_shift_score) * 0.7 +
            line.short_line_score * 1.2 +
            line.comma_score * 0.15
        )
        const maxValue = Math.max(...weighted, 1)

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    orientation: "h",
                    x: weighted.map((value) => value / maxValue),
                    y: lines.map((line) => line.line),
                    marker: { color: "#EE7733" },
                    hovertemplate: "Line %{y}<br>Fracture %{x:.2f}<extra></extra>",
                },
            ],
            layout: {
                showlegend: false,
                xaxis: {
                    title: { text: "Normalised Fracture" },
                    range: [0, 1],
                },
                yaxis: {
                    title: { text: "Line" },
                    autorange: "reversed",
                },
            },
        })
    }
}
