"use client"

import dynamic from "next/dynamic"

import type { PlotlyFigure } from "../types"

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

type LegendEvent = {
    curveNumber?: number
}

export function PlotlyRenderer({
    figure,
    onLegendClick,
    onLegendDoubleClick,
}: {
    figure: PlotlyFigure
    onLegendClick?: (event: LegendEvent) => boolean
    onLegendDoubleClick?: (event: LegendEvent) => boolean
}) {
    return (
        <Plot
            data={figure.data}
            layout={figure.layout}
            config={figure.config}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onLegendClick={onLegendClick}
            onLegendDoubleClick={onLegendDoubleClick}
        />
    )
}
