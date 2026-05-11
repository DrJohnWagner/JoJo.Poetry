import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class MomentumProfileChart extends BaseChart {
    readonly title = "Rhythmic Momentum"

    buildFigure(): PlotlyFigure {
        const lines = this.perLine.interruption
        const maxScore = Math.max(...lines.map((line) => line.score), 1)
        const lineAxis = this.makeLineNumberAxis({
            lineNumbers: lines.map((line) => line.line),
        })

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    orientation: "h",
                    x: lines.map((line) => 1 - line.score / maxScore),
                    y: lines.map((line) => line.line),
                    marker: { color: "#C9408A" },
                    showlegend: false,
                    hovertemplate: "Line %{y}<br>Momentum %{x:.2f}<extra></extra>",
                },
            ],
            layout: {
                showlegend: false,
                xaxis: {
                    title: { text: "Momentum" },
                    range: [0, 1],
                },
                yaxis: lineAxis,
            },
        })
    }
}
