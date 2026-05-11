import type { PlotlyFigure } from "../types"
import { BaseChart } from "./BaseChart"

export class StanzaArchitectureChart extends BaseChart {
    readonly title = "Stanza Architecture"

    buildFigure(): PlotlyFigure {
        const stanzaLengths = this.perLine.stanzas.stanza_lengths
        const maxLength = Math.max(...stanzaLengths, 1)

        return this.withBaseFigure({
            data: [
                {
                    type: "bar",
                    orientation: "h",
                    x: stanzaLengths.map((value) => value / maxLength),
                    y: stanzaLengths.map((_, index) => index + 1),
                    marker: { color: "#4F7EA8" },
                    showlegend: false,
                    hovertemplate: "Stanza %{y}<br>Length %{x:.2f}<extra></extra>",
                },
            ],
            layout: {
                showlegend: false,
                xaxis: {
                    title: { text: "Normalised Length" },
                    range: [0, 1],
                },
                yaxis: {
                    title: { text: "Stanza" },
                    autorange: "reversed",
                },
            },
        })
    }
}
