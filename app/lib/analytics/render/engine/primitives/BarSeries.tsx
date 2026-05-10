/**
 * BarSeries — horizontal bars anchored at x=0, width encodes a normalised value.
 *
 * Each bar occupies a fixed vertical band (y, height); width is the data value.
 * A 1px gap between rows is enforced via Math.max(…- 1, 1).
 *
 * Style: fill, stroke, strokeWidth, opacity.
 *
 * Used by: indentation_map, stanza_architecture.
 */
import type { BarSeriesData, LayerStyle } from "../../types";

interface Props {
  data: BarSeriesData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function BarSeries({ data, style, width, height }: Props) {
  return (
    <g>
      {data.bars.map((bar) => (
        <rect
          key={bar.index}
          x={0}
          y={bar.y * height}
          width={bar.width * width}
          height={Math.max(bar.height * height - 1, 1)}
          fill={style.fill ?? "currentColor"}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          fillOpacity={style.opacity ?? 1}
        />
      ))}
    </g>
  );
}
