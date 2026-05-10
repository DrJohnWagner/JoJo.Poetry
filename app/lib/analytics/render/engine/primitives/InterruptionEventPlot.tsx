import type { InterruptionEventPlotData, LayerStyle } from "../../types";
import { INTERRUPTION_DENSITY_CHROME, RENDER_CHROME } from "../../theme";

interface Props {
  data: InterruptionEventPlotData;
  style: LayerStyle;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function InterruptionEventPlot({ data, width, height }: Props) {
  const plotWidth = width * INTERRUPTION_DENSITY_CHROME.plotEnd;
  const inset = plotWidth * INTERRUPTION_DENSITY_CHROME.plotInset;
  const legendY = height + 40;
  const eventLegendX = inset + 8;
  const glowLegendX = Math.max(plotWidth * 0.44, eventLegendX + 220);

  function plotX(normX: number): number {
    return inset + clamp01(normX) * Math.max(plotWidth - inset * 2, 0);
  }

  return (
    <g>
      {data.lines.map((line) => {
        const lineNumber = line.lineIndex + 1;
        const showGuide = lineNumber % 5 === 0;
        const y0 = line.y * height;
        const rowHeight = Math.max(line.height * height - 1, 1);
        const centerY = y0 + rowHeight / 2;
        const guideY = Math.round(centerY) + 0.5
        const tickHalf = (rowHeight * INTERRUPTION_DENSITY_CHROME.eventHeightFactor) / 2;
        const glowHeight = rowHeight * INTERRUPTION_DENSITY_CHROME.glowHeightFactor;
        const positionedEvents = line.events.filter(
          (event) => event.type !== "indent_shift" && event.type !== "short_line"
        );

        return (
            <g key={line.lineIndex}>
                {showGuide ? (
                  <line
                    x1={inset}
                    y1={guideY}
                    x2={plotWidth - inset}
                    y2={guideY}
                    stroke={INTERRUPTION_DENSITY_CHROME.guideColor}
                    strokeWidth={INTERRUPTION_DENSITY_CHROME.guideStrokeWidth}
                    strokeLinecap="butt"
                    shapeRendering="crisp-edges"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {positionedEvents.flatMap((event, eventIndex) => {
                    const x = plotX(event.x)
                    return INTERRUPTION_DENSITY_CHROME.glowWidths.map(
                        (glowWidth, glowIndex) => (
                            <rect
                                key={`${line.lineIndex}-${eventIndex}-glow-${glowIndex}`}
                                x={x - (glowWidth * plotWidth) / 2}
                                y={centerY - glowHeight / 2}
                                width={glowWidth * plotWidth}
                                height={glowHeight}
                                rx={glowHeight / 2}
                                fill={INTERRUPTION_DENSITY_CHROME.glowColor}
                                opacity={
                                    INTERRUPTION_DENSITY_CHROME.glowOpacity /
                                    (glowIndex + 1)
                                }
                            />
                        )
                    )
                })}
                {positionedEvents.map((event, eventIndex) => {
                    const x = plotX(event.x)
                    return (
                        <line
                            key={`${line.lineIndex}-${eventIndex}`}
                            x1={x}
                            y1={centerY - tickHalf}
                            x2={x}
                            y2={centerY + tickHalf}
                            stroke={INTERRUPTION_DENSITY_CHROME.eventColor}
                            strokeWidth={
                                INTERRUPTION_DENSITY_CHROME.eventStrokeWidth
                            }
                            opacity={INTERRUPTION_DENSITY_CHROME.eventOpacity}
                        />
                    )
                })}
            </g>
        )
      })}
      <g>
        <line
          x1={eventLegendX}
          y1={legendY - 8}
          x2={eventLegendX}
          y2={legendY + 8}
          stroke={INTERRUPTION_DENSITY_CHROME.eventColor}
          strokeWidth={INTERRUPTION_DENSITY_CHROME.eventStrokeWidth}
          opacity={INTERRUPTION_DENSITY_CHROME.eventOpacity}
        />
        <text
          x={eventLegendX + 14}
          y={legendY}
          dominantBaseline="middle"
          fontSize={RENDER_CHROME.tickLabelSize}
          fill={RENDER_CHROME.labelColor}
        >
          Interruption event (any type)
        </text>

        {[9, 6, 3].map((r, i) => (
          <circle
            key={r}
            cx={glowLegendX}
            cy={legendY}
            r={r}
            fill={INTERRUPTION_DENSITY_CHROME.glowColor}
            opacity={INTERRUPTION_DENSITY_CHROME.glowOpacity / (i + 1)}
          />
        ))}
        <text
          x={glowLegendX + 14}
          y={legendY}
          dominantBaseline="middle"
          fontSize={RENDER_CHROME.tickLabelSize}
          fill={RENDER_CHROME.labelColor}
        >
          Local accumulation (high density)
        </text>
      </g>
    </g>
  );
}