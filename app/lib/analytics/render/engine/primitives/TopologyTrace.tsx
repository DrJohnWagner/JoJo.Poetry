/**
 * TopologyTrace — polyline through a sequence of normalised (x, y) points.
 *
 * Renders as a single <polyline> with no fill. Typically layered on top of a
 * ContourFill to give the filled silhouette a visible edge.
 * Requires at least 2 points; returns null otherwise.
 *
 * Style: stroke, strokeWidth, opacity.
 *
 * Used by: line_length_contour, fracture_map.
 */
import type { TopologyTraceData, LayerStyle } from "../../types"

interface Props {
    data: TopologyTraceData
    style: LayerStyle
    width: number
    height: number
}

export function TopologyTrace({ data, style, width, height }: Props) {
    if (data.points.length < 2) return null
    const pts = data.points
        .map((p) => `${p.x * width},${p.y * height}`)
        .join(" ")
    return (
        <polyline
            points={pts}
            fill="none"
            stroke={style.stroke ?? "currentColor"}
            strokeWidth={style.strokeWidth ?? 1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={style.opacity ?? 1}
        />
    )
}
