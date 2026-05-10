/**
 * SegmentationBand — alternating full-width bands, one per stanza.
 *
 * Even-indexed stanzas use style.fill; odd-indexed use style.fillAlt. Intended as a
 * background segmentation layer to visually separate stanza regions.
 *
 * Style: fill (even stanzas), fillAlt (odd stanzas), opacity.
 *
 * Currently unused — stanza_architecture was redesigned as a BarSeries chart.
 */
import type { SegmentationBandData, LayerStyle } from "../../types";
import { RENDER_CHROME } from "../../theme";

interface Props {
  data: SegmentationBandData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function SegmentationBand({ data, style, width, height }: Props) {
  return (
    <g>
      {data.segments.map((seg) => (
        <rect
          key={seg.stanzaIndex}
          x={0}
          y={seg.startFrac * height}
          width={width}
          height={(seg.endFrac - seg.startFrac) * height}
          fill={
            seg.stanzaIndex % 2 === 0
              ? (style.fill ?? RENDER_CHROME.segmentationBandEven)
              : (style.fillAlt ?? RENDER_CHROME.segmentationBandOdd)
          }
          fillOpacity={style.opacity ?? 1}
        />
      ))}
    </g>
  );
}
