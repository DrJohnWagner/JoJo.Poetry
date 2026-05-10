import type { LayerStyle, PunctuationPressureSummaryData } from "../../types";
import {
  INTERRUPTION_DENSITY_CHROME,
  PUNCTUATION_PRESSURE_CHROME,
  RENDER_CHROME,
} from "../../theme";

interface Props {
  data: PunctuationPressureSummaryData;
  style: LayerStyle;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function PunctuationPressureSummary({ data, width, height }: Props) {
  const summaryX = width * INTERRUPTION_DENSITY_CHROME.summaryStart;
  const summaryWidth = width * INTERRUPTION_DENSITY_CHROME.summaryWidth;

  return (
    <g>
      <text
        x={summaryX + summaryWidth / 2}
        y={-10}
        textAnchor="middle"
        fontSize={PUNCTUATION_PRESSURE_CHROME.summaryLabelSize}
        fill={RENDER_CHROME.labelColor}
      >
        {PUNCTUATION_PRESSURE_CHROME.summaryLabel}
      </text>

      {data.lines.map((line) => {
        const y0 = line.y * height;
        const rowHeight = Math.max(line.height * height - 1, 1);
        const centerY = y0 + rowHeight / 2;
        const score = clamp01(line.score);
        const maxW = summaryWidth * score;
        const offsets = [-0.36, -0.2, -0.05, 0.1, 0.25, 0.4];

        return (
          <g key={line.lineIndex}>
            {offsets.map((offset, idx) => {
              const widthScale = 1 - Math.min(Math.abs(offset) * 1.25, 0.68);
              const ridgeW = maxW * widthScale;
              if (ridgeW <= 0) return null;

              return (
                <line
                  key={`${line.lineIndex}-${idx}`}
                  x1={summaryX}
                  y1={centerY + offset * rowHeight}
                  x2={summaryX + ridgeW}
                  y2={centerY + offset * rowHeight}
                  stroke={PUNCTUATION_PRESSURE_CHROME.summaryColor}
                  strokeWidth={PUNCTUATION_PRESSURE_CHROME.summaryStrokeWidth}
                  strokeLinecap="round"
                  opacity={PUNCTUATION_PRESSURE_CHROME.summaryOpacity}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
