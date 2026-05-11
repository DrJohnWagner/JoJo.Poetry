"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Data } from "plotly.js"

import type { PlotlyFigure } from "../types"

type LegendEntry = {
    key: string
    sourceIndices: number[]
    label: string
    color: string
    glyph: string
    glyphFontFamily?: string
    glyphFontSize: number
}

function getTraceGlyph(trace: Data): { glyph: string; glyphFontFamily?: string; glyphFontSize: number } {
    const styledTrace = trace as Data & {
        text?: unknown
        textfont?: {
            family?: unknown
            size?: unknown
        }
    }

    const text = styledTrace.text
    if (typeof text === "string" && text.length > 0) {
        return {
            glyph: text,
            glyphFontFamily: typeof styledTrace.textfont?.family === "string" ? styledTrace.textfont.family : undefined,
            glyphFontSize: typeof styledTrace.textfont?.size === "number" ? styledTrace.textfont.size : 14,
        }
    }

    if (Array.isArray(text)) {
        const firstTextGlyph = text.find((item) => typeof item === "string" && item.length > 0)
        if (typeof firstTextGlyph === "string") {
            return {
                glyph: firstTextGlyph,
                glyphFontFamily: typeof styledTrace.textfont?.family === "string" ? styledTrace.textfont.family : undefined,
                glyphFontSize: typeof styledTrace.textfont?.size === "number" ? styledTrace.textfont.size : 14,
            }
        }
    }

    return { glyph: "●", glyphFontSize: 12 }
}

function getTraceColor(trace: Data): string {
    const styledTrace = trace as Data & {
        line?: { color?: unknown }
        marker?: { color?: unknown }
        textfont?: { color?: unknown }
    }

    const textColor = styledTrace.textfont?.color
    if (typeof textColor === "string") {
        return textColor
    }
    if (Array.isArray(textColor)) {
        const firstTextColor = textColor.find((value) => typeof value === "string")
        if (typeof firstTextColor === "string") {
            return firstTextColor
        }
    }

    const lineColor = styledTrace.line?.color
    if (typeof lineColor === "string") {
        return lineColor
    }

    const markerColor = styledTrace.marker?.color
    if (typeof markerColor === "string") {
        return markerColor
    }

    return "#475569"
}

function getLegendEntries(sourceFigure: PlotlyFigure): LegendEntry[] {
    const byKey = new Map<string, LegendEntry>()

    sourceFigure.data.forEach((trace, sourceIndex) => {
        const showlegend = (trace as Data & { showlegend?: boolean }).showlegend
        if (!trace.name || showlegend === false) {
            return
        }

        const styledTrace = trace as Data & { legendgroup?: unknown }
        const legendGroup = typeof styledTrace.legendgroup === "string" ? styledTrace.legendgroup : undefined

        if (legendGroup === "indentation-shift") {
            const existing = byKey.get(legendGroup)
            if (existing) {
                existing.sourceIndices.push(sourceIndex)
                return
            }

            const groupedGlyph = getTraceGlyph(trace)

            byKey.set(legendGroup, {
                key: legendGroup,
                sourceIndices: [sourceIndex],
                label: "Indent Shift",
                color: getTraceColor(trace),
                glyph: groupedGlyph.glyph,
                glyphFontFamily: groupedGlyph.glyphFontFamily,
                glyphFontSize: groupedGlyph.glyphFontSize,
            })
            return
        }

        byKey.set(`trace-${sourceIndex}`, {
            key: `trace-${sourceIndex}`,
            sourceIndices: [sourceIndex],
            label: String(trace.name),
            color: getTraceColor(trace),
            ...getTraceGlyph(trace),
        })
    })

    return [...byKey.values()]
}

export function LegendOnlyChart(props: {
    sourceFigure: PlotlyFigure
    width: number
    hiddenSourceTraceIndices: Set<number>
    onHiddenSourceTraceIndicesChange: Dispatch<SetStateAction<Set<number>>>
}) {
    const legendEntries = getLegendEntries(props.sourceFigure)
    const allHtmlLegendSourceIndices = legendEntries.flatMap((entry) => entry.sourceIndices)

    return (
        <div className="rounded border border-slate-200 bg-white px-3 py-2" style={{ width: `${props.width}px` }}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {legendEntries.map((entry) => {
                    const isHidden = entry.sourceIndices.every((idx) => props.hiddenSourceTraceIndices.has(idx))
                    return (
                        <button
                            key={entry.key}
                            type="button"
                            className="inline-flex items-center gap-1.5 text-left text-xs text-slate-700"
                            style={{ opacity: isHidden ? 0.45 : 1 }}
                            onClick={() => {
                                props.onHiddenSourceTraceIndicesChange((previous) => {
                                    const next = new Set(previous)
                                    const allHidden = entry.sourceIndices.every((idx) => next.has(idx))
                                    if (allHidden) {
                                        for (const idx of entry.sourceIndices) {
                                            next.delete(idx)
                                        }
                                    } else {
                                        for (const idx of entry.sourceIndices) {
                                            next.add(idx)
                                        }
                                    }
                                    return next
                                })
                            }}
                            onDoubleClick={() => {
                                props.onHiddenSourceTraceIndicesChange((previous) => {
                                    const next = new Set<number>()
                                    for (const idx of allHtmlLegendSourceIndices) {
                                        if (!entry.sourceIndices.includes(idx)) {
                                            next.add(idx)
                                        }
                                    }

                                    const isAlreadyIsolated = allHtmlLegendSourceIndices.every((idx) =>
                                        entry.sourceIndices.includes(idx) ? !previous.has(idx) : previous.has(idx)
                                    )

                                    return isAlreadyIsolated ? new Set<number>() : next
                                })
                            }}
                        >
                            <span
                                className="inline-flex min-w-4 items-center justify-center leading-none"
                                style={{
                                    color: entry.color,
                                    fontFamily: entry.glyphFontFamily,
                                    fontSize: `${Math.max(12, entry.glyphFontSize)}px`,
                                }}
                            >
                                {entry.glyph}
                            </span>
                            <span>{entry.label}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
