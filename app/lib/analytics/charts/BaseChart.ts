import type { Config, Data, Layout } from "plotly.js"
import type {
    AnalyticsSummary,
    PerLineData,
    PlotlyFigure,
    VisType,
} from "../types"

export interface ChartOptions {
    width: number
    height: number
    isPrimary?: boolean
}

export interface ChartContext {
    summary: AnalyticsSummary
    perLine: PerLineData
    visType: VisType
    overlayTypes?: string[]
    explanation?: string
    options: ChartOptions
}

interface BaseChartStyle {
    layout: {
        margin: { t: number; r: number; b: number; l: number }
        paperBgColor: string
        plotBgColor: string
        font: { family: string; size: number; color: string }
        legend: { orientation: "h"; x: number; y: number }
        xaxis: Partial<NonNullable<Layout["xaxis"]>>
        yaxis: Partial<NonNullable<Layout["yaxis"]>>
    }
    config: {
        displayModeBar: boolean
        responsive: boolean
    }
}

export abstract class BaseChart {
    static readonly STYLE: BaseChartStyle = {
        layout: {
            margin: { t: 16, r: 12, b: 44, l: 52 },
            paperBgColor: "white",
            plotBgColor: "white",
            font: {
                family: "var(--font-serif), Georgia, ui-serif, serif",
                size: 12,
                color: "#000000AA",
            },
            legend: {
                orientation: "h",
                x: 0,
                y: -0.18,
            },
            xaxis: {
                showline: true,
                linecolor: "#00000080",
                linewidth: 1,
                ticks: "outside",
                ticklen: 4,
                tickwidth: 1,
                tickcolor: "#00000080",
                title: { standoff: 6 },
            },
            yaxis: {
                showline: true,
                linecolor: "#00000080",
                linewidth: 1,
                ticks: "outside",
                ticklen: 6,
                tickwidth: 1,
                tickcolor: "#00000080",
                ticklabelposition: "outside",
                title: { standoff: 6 },
            },
        },
        config: {
            displayModeBar: false,
            responsive: true,
        },
    }

    readonly summary: AnalyticsSummary
    readonly perLine: PerLineData
    readonly visType: VisType
    readonly overlayTypes: string[]
    readonly explanation?: string
    readonly options: ChartOptions

    constructor(ctx: ChartContext) {
        this.summary = ctx.summary
        this.perLine = ctx.perLine
        this.visType = ctx.visType
        this.overlayTypes = ctx.overlayTypes ?? []
        this.explanation = ctx.explanation
        this.options = ctx.options
    }

    abstract readonly title: string

    protected makeLineNumberAxis(args: {
        lineNumbers: number[]
        title?: string
        every?: number
    }): Partial<NonNullable<Layout["yaxis"]>> {
        const uniqueLineNumbers = [...new Set(args.lineNumbers)].sort(
            (left, right) => left - right
        )
        const minLine = uniqueLineNumbers.length > 0 ? uniqueLineNumbers[0] : 1
        const maxLine =
            uniqueLineNumbers.length > 0
                ? uniqueLineNumbers[uniqueLineNumbers.length - 1]
                : 1
        const totalLines = uniqueLineNumbers.length
        const inferredEvery =
            totalLines < 10
                ? 1
                : totalLines < 20
                  ? 2
                  : totalLines < 40
                    ? 5
                    : totalLines < 80
                      ? 10
                      : totalLines < 160
                        ? 20
                        : 40

        const every = Math.max(args.every ?? inferredEvery, 1)
        const tickvals = uniqueLineNumbers.filter((lineNumber) => {
            if (lineNumber === minLine) {
                return true
            }
            if (every >= 5) {
                return lineNumber % every === 0
            }
            return (lineNumber - minLine) % every === 0
        })

        return {
            title: { text: args.title ?? "Line" },
            range: [maxLine + 0.5, minLine - 0.5],
            tickmode: "array",
            tickvals,
            zeroline: false,
        }
    }

    protected withBaseFigure(args: {
        data: Data[]
        layout?: Partial<Layout>
        config?: Partial<Config>
    }): PlotlyFigure {
        const style = BaseChart.STYLE
        const layout = args.layout ?? {}
        const layoutXAxis = (layout.xaxis ?? {}) as Partial<
            NonNullable<Layout["xaxis"]>
        >
        const layoutYAxis = (layout.yaxis ?? {}) as Partial<
            NonNullable<Layout["yaxis"]>
        >
        const layoutXAxis2 = (layout.xaxis2 ?? {}) as Partial<
            NonNullable<Layout["xaxis"]>
        >
        const layoutYAxis2 = (layout.yaxis2 ?? {}) as Partial<
            NonNullable<Layout["yaxis"]>
        >
        const layoutXAxisTitle =
            typeof layoutXAxis.title === "string"
                ? { text: layoutXAxis.title }
                : (layoutXAxis.title ?? {})
        const layoutYAxisTitle =
            typeof layoutYAxis.title === "string"
                ? { text: layoutYAxis.title }
                : (layoutYAxis.title ?? {})
        const layoutXAxis2Title =
            typeof layoutXAxis2.title === "string"
                ? { text: layoutXAxis2.title }
                : (layoutXAxis2.title ?? {})
        const layoutYAxis2Title =
            typeof layoutYAxis2.title === "string"
                ? { text: layoutYAxis2.title }
                : (layoutYAxis2.title ?? {})

        const mergedLayout: Partial<Layout> = {
            width: this.options.width,
            height: this.options.height,
            paper_bgcolor: style.layout.paperBgColor,
            plot_bgcolor: style.layout.plotBgColor,
            font: style.layout.font,
            ...layout,
            margin: {
                ...style.layout.margin,
                ...(layout.margin ?? {}),
            },
            legend: {
                ...style.layout.legend,
                ...(layout.legend ?? {}),
            },
            xaxis: {
                ...style.layout.xaxis,
                ...layoutXAxis,
                title: {
                    ...(style.layout.xaxis.title ?? {}),
                    ...layoutXAxisTitle,
                },
            },
            yaxis: {
                ...style.layout.yaxis,
                ...layoutYAxis,
                title: {
                    ...(style.layout.yaxis.title ?? {}),
                    ...layoutYAxisTitle,
                },
            },
            ...(layout.xaxis2
                ? {
                      xaxis2: {
                          ...style.layout.xaxis,
                          ...layoutXAxis2,
                          title: {
                              ...(style.layout.xaxis.title ?? {}),
                              ...layoutXAxis2Title,
                          },
                      },
                  }
                : {}),
            ...(layout.yaxis2
                ? {
                      yaxis2: {
                          ...style.layout.yaxis,
                          ...layoutYAxis2,
                          title: {
                              ...(style.layout.yaxis.title ?? {}),
                              ...layoutYAxis2Title,
                          },
                      },
                  }
                : {}),
        }

        return {
            data: args.data,
            layout: mergedLayout,
            config: {
                ...style.config,
                ...(args.config ?? {}),
            },
        }
    }

    abstract buildFigure(): PlotlyFigure
}
