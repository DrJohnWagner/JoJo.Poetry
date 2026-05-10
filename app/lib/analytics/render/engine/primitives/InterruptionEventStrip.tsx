/**
 * InterruptionEventStrip — Unicode text glyphs placed at each event's character position.
 *
 * Glyph, color, and font size come from INTERRUPTION_EVENTS (single source of truth).
 * Font size scales with row height. Two special cases:
 *   indent_shift — directional arrows (▶ positive, ◀ negative), one per 4 spaces of shift,
 *                  left-anchored at x=2.
 *   short_line   — glyph repeated twice, left-anchored at x=2.
 * All other events are centred at their character x position within the line.
 *
 * Style: (unused — all display config comes from INTERRUPTION_EVENTS).
 *
 * Used by: interruption_density_profile (foreground events layer).
 */
import type { InterruptionEventStripData, LayerStyle } from "../../types";
import { INTERRUPTION_EVENTS, RENDER_CHROME } from "../../theme";

interface Props {
  data: InterruptionEventStripData;
  style: LayerStyle;
  width: number;
  height: number;
}

export function InterruptionEventStrip({ data, width, height }: Props) {
  return (
    <g>
      {data.lines.map((line) => {
        const ry   = (line.y + line.height / 2) * height;
        const rowH = line.height * height;

        return (
          <g key={line.lineIndex}>
            {line.events.map((e, i) => {
              const cfg      = INTERRUPTION_EVENTS[e.type];
            //   const fontSize = Math.min(cfg.fontSize, rowH * 0.8)
              const shared   = {
                dominantBaseline: "middle" as const,
                fontWeight: "bold",
                fontSize: cfg.fontSize * rowH / RENDER_CHROME.interruptionGlyphScaleDivisor,
                fill: cfg.color,
              };

              if (e.type === "indent_shift") {
                const count = Math.max(1, Math.round(Math.abs(e.value)));
                const arrow = e.value > 0 ? "▶" : "◀";
                return (
                  <text key={`${e.type}-${i}`} x={2} y={ry} textAnchor="start" {...shared}>
                    {arrow.repeat(count)}
                  </text>
                );
              }

              if (e.type === "short_line") {
                return (
                    <text
                        key={`${e.type}-${i}`}
                        x={2}
                        y={ry}
                        textAnchor="start"
                        {...shared}
                    >
                        {cfg.glyph}
                        {cfg.glyph}
                    </text>
                )
              }

              return (
                <text key={`${e.type}-${i}`} x={e.x * width} y={ry} textAnchor="middle" {...shared}>
                  {cfg.glyph}
                </text>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
