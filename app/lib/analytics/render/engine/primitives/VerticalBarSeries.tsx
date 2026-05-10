/**
 * VerticalBarSeries — vertical bars growing upward from the bottom edge.
 *
 * Each bar's x position and width are normalised; y is computed as (1 - height)
 * so bars grow from the bottom. A 12% horizontal gap between bars is applied by
 * the spec builder, not here. Used for frequency distributions where the x axis
 * is categorical (bin labels) and the y axis encodes count.
 *
 * Style: fill, opacity.
 *
 * Used by: line_length_distribution.
 */
import type { VerticalBarSeriesData, LayerStyle } from "../../types";

interface Props {
  data: VerticalBarSeriesData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function VerticalBarSeries({ data, style, width, height }: Props) {
  return (
    <g>
      {data.bars.map((bar) => (
        <rect
          key={bar.index}
          x={bar.x * width}
          y={(1 - bar.height) * height}
          width={bar.width * width}
          height={bar.height * height}
          fill={style.fill ?? "currentColor"}
          fillOpacity={style.opacity ?? 0.85}
        />
      ))}
    </g>
  );
}
