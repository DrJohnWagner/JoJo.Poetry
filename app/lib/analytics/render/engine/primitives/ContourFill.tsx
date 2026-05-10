/**
 * ContourFill — filled polygon tracing a sequence of (x, y) points back to a vertical baseline.
 *
 * Traces the data points top-to-bottom, then closes the shape by dropping to baselineX
 * at the last y, rising back to baselineX at the first y. Produces a silhouette fill.
 * Requires at least 2 points; returns null otherwise.
 *
 * Style: fill, opacity.
 *
 * Used by: line_length_contour.
 */
import type { ContourFillData, LayerStyle } from "../../types";

interface Props {
  data: ContourFillData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function ContourFill({ data, style, width, height }: Props) {
  if (data.points.length < 2) return null;

  // Trace along data points, then close back along baseline (x=baselineX).
  const first = data.points[0];
  const last  = data.points[data.points.length - 1];
  const bx    = data.baselineX * width;

  const d = [
    `M ${first.x * width},${first.y * height}`,
    ...data.points.slice(1).map((p) => `L ${p.x * width},${p.y * height}`),
    `L ${bx},${last.y * height}`,
    `L ${bx},${first.y * height}`,
    "Z",
  ].join(" ");

  return (
    <path
      d={d}
      fill={style.fill ?? "currentColor"}
      fillOpacity={style.opacity ?? 0.3}
      stroke="none"
    />
  );
}
