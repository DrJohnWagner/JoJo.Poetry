import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class IndentationMapChart extends BaseChart {
    readonly title = "Spatial Position"

    buildFigure(): PlotlyFigure {
        const lines = this.perLine.indentation
        const maxDepth = Math.max(...lines.map((line) => line.leading_spaces), 1)
        const lineAxis = this.makeLineNumberAxis({
            lineNumbers: lines.map((line) => line.line),
        })

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    orientation: "h",
                    x: lines.map((line) => line.leading_spaces / maxDepth),
                    y: lines.map((line) => line.line),
                    marker: { color: "#0077BB" },
                    showlegend: false,
                    hovertemplate: "Line %{y}<br>Indent %{x:.2f}<extra></extra>",
                },
            ],
            layout: {
                showlegend: false,
                xaxis: {
                    title: { text: "Normalised Indentation" },
                    range: [0, 1],
                },
                yaxis: lineAxis,
            },
        })
    }
}
