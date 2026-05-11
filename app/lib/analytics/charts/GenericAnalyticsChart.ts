import type { PlotlyFigure } from "../types"
import { BaseChart, type ChartContext } from "./BaseChart"

export class GenericAnalyticsChart extends BaseChart {
    readonly title: string

    constructor(title: string, ctx: ChartContext) {
        super(ctx)
        this.title = title
    }

    buildFigure(): PlotlyFigure {
        return this.withBaseFigure({
            data: [],
            layout: {
                margin: { t: 16, r: 12, b: 44, l: 12 },
                showlegend: false,
                xaxis: { visible: false },
                yaxis: { visible: false },
                annotations: [
                    {
                        text: "Chart not migrated yet",
                        x: 0.5,
                        y: 0.5,
                        xref: "paper",
                        yref: "paper",
                        showarrow: false,
                        font: { size: 12, color: "#64748B" },
                    },
                ],
            },
        })
    }
}
