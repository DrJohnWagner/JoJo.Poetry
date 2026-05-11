"use client"

import { useMemo, useState } from "react"
import type { Data } from "plotly.js"

import { FractureMapChart } from "../charts/FractureMapChart"
import { GenericAnalyticsChart } from "../charts/GenericAnalyticsChart"
import { IndentationMapChart } from "../charts/IndentationMapChart"
import { InterruptionDensityChart } from "../charts/InterruptionDensityChart"
import { LineLengthDistributionChart } from "../charts/LineLengthDistributionChart"
import { LineLengthMapChart } from "../charts/LineLengthMapChart"
import { MomentumProfileChart } from "../charts/MomentumProfileChart"
import { PunctuationPressureChart } from "../charts/PunctuationPressureChart"
import { StanzaArchitectureChart } from "../charts/StanzaArchitectureChart"
import type { BaseChart, ChartContext } from "../charts/BaseChart"
import { LegendOnlyChart } from "./LegendOnlyChart"
import { PlotlyRenderer } from "../plotly/PlotlyRenderer"
import type {
    AnalyticsSummary,
    PerLineData,
    RenderPlan,
    VisCandidate,
    VisType,
    PlotlyFigure,
} from "../types"

const TITLES: Record<VisType, string> = {
    indentation_map: "Spatial Position",
    line_length_map: "Line Length",
    line_length_distribution: "Line Length Distribution",
    interruption_density_profile: "Interruption Density",
    momentum_profile: "Rhythmic Momentum",
    stanza_architecture: "Stanza Architecture",
    punctuation_pressure_strip: "Punctuation Pressure",
    fracture_map: "Syntax Fracture",
    semantic_pressure_overlay: "Semantic Pressure",
    indentation_overlay: "Indent Shifts",
}

interface DashboardComposerProps {
    summary: AnalyticsSummary
    perLine: PerLineData
    renderPlan: RenderPlan
    primaryWidth?: number
    primaryHeight?: number
    secondaryHeight?: number
}

interface DashboardLayout {
    primary: BaseChart[]
    secondary: BaseChart[]
    supporting: BaseChart[]
}

function makeChart(args: {
    vis: VisCandidate
    summary: AnalyticsSummary
    perLine: PerLineData
    overlayTypes: string[]
    width: number
    height: number
    isPrimary: boolean
}): BaseChart {
    const visType = args.vis.type as VisType
    const ctx: ChartContext = {
        summary: args.summary,
        perLine: args.perLine,
        visType,
        overlayTypes: args.overlayTypes,
        explanation: args.vis.explanation,
        options: { width: args.width, height: args.height, isPrimary: args.isPrimary },
    }

    switch (visType) {
        case "indentation_map":
            return new IndentationMapChart(ctx)
        case "line_length_map":
            return new LineLengthMapChart(ctx)
        case "line_length_distribution":
            return new LineLengthDistributionChart(ctx)
        case "punctuation_pressure_strip":
            return new PunctuationPressureChart(ctx)
        case "interruption_density_profile":
            return new InterruptionDensityChart(ctx)
        case "momentum_profile":
            return new MomentumProfileChart(ctx)
        case "stanza_architecture":
            return new StanzaArchitectureChart(ctx)
        case "fracture_map":
            return new FractureMapChart(ctx)
        default:
            return new GenericAnalyticsChart(TITLES[visType] ?? args.vis.type, ctx)
    }
}

function withSemanticOverlay(chart: BaseChart, figure: PlotlyFigure): PlotlyFigure {
    if (!chart.overlayTypes.includes("semantic_pressure_overlay")) {
        return figure
    }

    const compatibleHosts: VisType[] = [
        "momentum_profile",
        "indentation_map",
        "line_length_map",
    ]
    if (!compatibleHosts.includes(chart.visType)) {
        return figure
    }

    const negationRegex = /\b(no|not|never|neither|nothing|without|nor|none)\b/gi
    const points = chart.perLine.interruption.map((line) => {
        const negCount = (line.text.match(negationRegex) ?? []).length
        const pressure = Math.min(negCount * 0.4 + chart.summary.repetition_pressure * 0.25, 1)
        return { line: line.line, pressure }
    })

    const overlayTrace: Data = {
        type: "scatter",
        mode: "markers",
        x: points.map((p) => p.pressure),
        y: points.map((p) => p.line),
        marker: {
            color: "#009988",
            opacity: 0.35,
            symbol: "circle-open",
            size: points.map((p) => 4 + p.pressure * 10),
            line: { color: "#009988", width: 1 },
        },
        name: "Semantic Pressure",
        showlegend: false,
        hovertemplate: "Line %{y}<br>Semantic %{x:.2f}<extra></extra>",
    }

    return {
        ...figure,
        data: [...figure.data, overlayTrace],
    }
}

function ChartWithLegend({ chart }: { chart: BaseChart }) {
    const [hiddenTraceIndices, setHiddenTraceIndices] = useState<Set<number>>(new Set())
    const sourceFigure = withSemanticOverlay(chart, chart.buildFigure())
    const hasLegendEntries = sourceFigure.data.some((trace) => {
        const showlegend = (trace as Data & { showlegend?: boolean }).showlegend
        return Boolean(trace.name) && showlegend !== false
    })

    const mainFigure: PlotlyFigure = {
        ...sourceFigure,
        data: sourceFigure.data.map((trace, idx) =>
            hiddenTraceIndices.has(idx)
                ? {
                      ...trace,
                      visible: false,
                  }
                : trace
        ),
        layout: {
            ...sourceFigure.layout,
            showlegend: false,
        },
    }

    return (
        <div className="flex flex-col gap-0">
            <div className="flex flex-col">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{chart.title}</p>
                {chart.explanation ? (
                    <p className="mb-2 text-xs leading-snug text-slate-500">{chart.explanation}</p>
                ) : null}
                <div
                    className="overflow-hidden rounded border border-slate-200 bg-white"
                    style={{ width: `${chart.options.width}px`, height: `${chart.options.height}px` }}
                >
                    <PlotlyRenderer figure={mainFigure} />
                </div>
            </div>

            {hasLegendEntries ? (
                <LegendOnlyChart
                    sourceFigure={sourceFigure}
                    width={chart.options.width}
                    hiddenSourceTraceIndices={hiddenTraceIndices}
                    onHiddenSourceTraceIndicesChange={setHiddenTraceIndices}
                />
            ) : null}
        </div>
    )
}

export function DashboardComposer({
    summary,
    perLine,
    renderPlan,
    primaryWidth = 640,
    primaryHeight = 320,
    secondaryHeight = 160,
}: DashboardComposerProps) {
    const dashboard = useMemo<DashboardLayout>(() => {
        const OVERLAY_ONLY_TYPES = new Set<VisType>(["semantic_pressure_overlay", "indentation_overlay"])
        const isOverlayOnly = (vis: VisCandidate | null): vis is VisCandidate =>
            Boolean(vis && !OVERLAY_ONLY_TYPES.has(vis.type as VisType))

        const primaryVis = isOverlayOnly(renderPlan.primary) ? renderPlan.primary : null
        const secondaryVis = renderPlan.secondary.filter((vis) => isOverlayOnly(vis))
        const supportingVis = renderPlan.supporting.filter((vis) => isOverlayOnly(vis))

        const overlaysByHost: Record<string, string[]> = {}
        for (const overlay of renderPlan.overlays) {
            ;(overlaysByHost[overlay.host_visualisation] ??= []).push(overlay.overlay_type)
        }

        const secondaryWidth = Math.round(primaryWidth / Math.max(secondaryVis.length, 1))
        const supportingWidth = Math.round(primaryWidth / Math.max(supportingVis.length, 1))

        return {
            primary: primaryVis
                ? [
                      makeChart({
                          vis: primaryVis,
                          summary,
                          perLine,
                          overlayTypes: overlaysByHost[primaryVis.type] ?? [],
                          width: primaryWidth,
                          height: primaryHeight,
                          isPrimary: true,
                      }),
                  ]
                : [],
            secondary: secondaryVis.map((vis) =>
                makeChart({
                    vis,
                    summary,
                    perLine,
                    overlayTypes: overlaysByHost[vis.type] ?? [],
                    width: secondaryWidth,
                    height: secondaryHeight,
                    isPrimary: false,
                })
            ),
            supporting: supportingVis.map((vis) =>
                makeChart({
                    vis,
                    summary,
                    perLine,
                    overlayTypes: overlaysByHost[vis.type] ?? [],
                    width: supportingWidth,
                    height: secondaryHeight,
                    isPrimary: false,
                })
            ),
        }
    }, [perLine, primaryHeight, primaryWidth, renderPlan, secondaryHeight, summary])

    return (
        <div className="flex flex-col gap-6">
            {dashboard.primary.map((chart, index) => (
                <ChartWithLegend key={`primary-${index}`} chart={chart} />
            ))}

            {dashboard.secondary.length > 0 ? (
                <div className="flex gap-4">
                    {dashboard.secondary.map((chart, index) => (
                        <ChartWithLegend key={`secondary-${index}`} chart={chart} />
                    ))}
                </div>
            ) : null}

            {dashboard.supporting.length > 0 ? (
                <div className="flex gap-4">
                    {dashboard.supporting.map((chart, index) => (
                        <ChartWithLegend key={`supporting-${index}`} chart={chart} />
                    ))}
                </div>
            ) : null}
        </div>
    )
}
