/**
 * EventStrip — circles plotted at categorical x positions within each line band.
 *
 * Punctuation events (period, comma, dash, semicolon, other) are placed at fixed
 * normalised x positions defined by the spec builder (PUNCT_X map). Circle radius
 * scales with row height. Each type has its own fill color defined in TYPE_COLORS.
 *
 * Style: opacity (fill is overridden by TYPE_COLORS per event type).
 *
 * Used by: punctuation_pressure_strip.
 */
import type { EventStripData, LayerStyle } from "../../types";
import { EVENT_STRIP_TYPE_COLORS, RENDER_CHROME } from "../../theme";

interface Props {
  data: EventStripData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function EventStrip({ data, style, width, height }: Props) {
  const r = Math.max(
    (height / data.lines.length) * RENDER_CHROME.eventStripRadiusFactor,
    RENDER_CHROME.eventStripMinRadius,
  );

  return (
    <g>
      {data.lines.flatMap((line) =>
        line.events.map((event, i) => (
          <circle
            key={`${line.lineIndex}-${i}`}
            cx={event.x * width}
            cy={(line.y + line.height / 2) * height}
            r={r}
            fill={EVENT_STRIP_TYPE_COLORS[event.type] ?? (style.fill ?? "currentColor")}
            fillOpacity={style.opacity ?? 0.85}
          />
        ))
      )}
    </g>
  );
}
