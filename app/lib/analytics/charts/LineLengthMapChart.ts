import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class LineLengthMapChart extends BaseChart {
    readonly title = "Line Length"

    buildFigure(): PlotlyFigure {
        const lines = this.perLine.line_lengths
        const maxLength = Math.max(...lines.map((line) => line.with_spaces), 1)
        const lineAxis = this.makeLineNumberAxis({
            lineNumbers: lines.map((line) => line.line),
        })

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    orientation: "h",
                    x: lines.map((line) => line.with_spaces / maxLength),
                    y: lines.map((line) => line.line),
                    marker: { color: "#7E8A97" },
                    showlegend: false,
                    hovertemplate: "Line %{y}<br>Length %{x:.2f}<extra></extra>",
                },
            ],
            layout: {
                showlegend: false,
                xaxis: {
                    title: { text: "Normalised Length" },
                    range: [0, 1],
                },
                yaxis: lineAxis,
            },
        })
    }
}
