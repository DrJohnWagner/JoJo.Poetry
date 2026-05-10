/**
 * MarkerOverlay — lightweight row-level annotation primitive.
 *
 * Mechanically simple by design: this draws per-row highlight strips whose
 * opacity is proportional to marker.value.
 *
 * This primitive does not encode semantic regions or structural partitions;
 * it is for literal positional annotations only.
 *
 * Style: fill, opacity (base multiplier; final = opacity * marker.value).
 */
import type { MarkerOverlayData, LayerStyle } from "../../types";

interface Props {
  data: MarkerOverlayData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function MarkerOverlay({ data, style, width, height }: Props) {
  return (
    <g>
      {data.markers.map((m) => (
        <rect
          key={m.lineIndex}
          x={0}
          y={m.y * height}
          width={width}
          height={Math.max(m.height * height - 1, 1)}
          fill={style.fill ?? "currentColor"}
          fillOpacity={(style.opacity ?? 0.2) * m.value}
        />
      ))}
    </g>
  );
}
