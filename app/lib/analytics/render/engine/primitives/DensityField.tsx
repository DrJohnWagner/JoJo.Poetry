/**
 * DensityField — full-width rows with opacity proportional to a normalised score.
 *
 * Each cell spans the full draw width; opacity maps [0, 1] → [0.05, 1.0], keeping
 * zero-score rows faintly visible as a baseline. Intended as a background haze layer
 * beneath a foreground event primitive.
 *
 * Style: fill, (opacity is overridden by per-cell value).
 *
 * Used by: interruption_density_profile (background layer).
 */
import type { DensityFieldData, LayerStyle } from "../../types";

interface Props {
  data: DensityFieldData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function DensityField({ data, style, width, height }: Props) {
  return (
    <g>
      {data.cells.map((cell) => (
        <rect
          key={cell.index}
          x={0}
          y={cell.y * height}
          width={width}
          height={Math.max(cell.height * height - 1, 1)}
          fill={style.fill ?? "currentColor"}
          // Min opacity 0.05 so zero-score lines remain visible as baseline.
          fillOpacity={0.05 + cell.value * 0.95}
        />
      ))}
    </g>
  );
}
