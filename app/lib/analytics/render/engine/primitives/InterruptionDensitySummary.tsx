import type { InterruptionDensitySummaryData, LayerStyle } from "../../types";
import { INTERRUPTION_DENSITY_CHROME, RENDER_CHROME } from "../../theme";

interface Props {
  data: InterruptionDensitySummaryData;
  style: LayerStyle;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function InterruptionDensitySummary({ data, width, height }: Props) {
  const summaryX = width * INTERRUPTION_DENSITY_CHROME.summaryStart;
  const summaryWidth = width * INTERRUPTION_DENSITY_CHROME.summaryWidth;

  return (
    <g>
      <text
        x={summaryX + summaryWidth / 2}
        y={-10}
        textAnchor="middle"
        fontSize={INTERRUPTION_DENSITY_CHROME.summaryLabelSize}
        fill={RENDER_CHROME.labelColor}
      >
        {INTERRUPTION_DENSITY_CHROME.summaryLabel}
      </text>
      {data.lines.map((line) => {
        const y0 = line.y * height;
        const rowHeight = Math.max(line.height * height - 1, 1);
        const centerY = y0 + rowHeight / 2;
        const barHeight = Math.max(
          rowHeight * INTERRUPTION_DENSITY_CHROME.summaryBarHeightFactor,
          1,
        );
        const summaryBarWidth = summaryWidth * clamp01(line.score);

        return (
          <rect
            key={line.lineIndex}
            x={summaryX}
            y={centerY - barHeight / 2}
            width={summaryBarWidth}
            height={barHeight}
            fill={INTERRUPTION_DENSITY_CHROME.summaryColor}
            opacity={INTERRUPTION_DENSITY_CHROME.summaryOpacity}
          />
        );
      })}
    </g>
  );
}