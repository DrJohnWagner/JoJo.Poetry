import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class LineLengthDistributionChart extends BaseChart {
    readonly title = "Line Length Distribution"

    buildFigure(): PlotlyFigure {
        const binWidth = 10
        const counts = new Map<number, number>()

        for (const line of this.perLine.line_lengths) {
            const start = line.with_spaces <= 0 ? 0 : Math.floor((line.with_spaces - 1) / binWidth) * binWidth + 1
            counts.set(start, (counts.get(start) ?? 0) + 1)
        }

        const bins = Array.from(counts.entries())
            .sort(([a], [b]) => a - b)
            .map(([start, count]) => ({
                label: start === 0 ? "0" : `${start}-${start + binWidth - 1}`,
                count,
            }))

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    x: bins.map((bin) => bin.label),
                    y: bins.map((bin) => bin.count),
                    marker: { color: "#7E8A97" },
                    showlegend: false,
                    hovertemplate: "Bin %{x}<br>Lines %{y}<extra></extra>",
                },
            ],
            layout: {
                margin: { t: 16, r: 12, b: 52, l: 52 },
                showlegend: false,
                xaxis: {
                    title: { text: "Characters" },
                },
                yaxis: {
                    title: { text: "Lines" },
                    rangemode: "tozero",
                },
            },
        })
    }
}
