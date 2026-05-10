import type { LayerStyle, PunctuationEventPlotData } from "../../types";
import {
  INTERRUPTION_DENSITY_CHROME,
  PUNCTUATION_PRESSURE_CHROME,
  RENDER_CHROME,
} from "../../theme";

interface Props {
  data: PunctuationEventPlotData;
  style: LayerStyle;
  width: number;
  height: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function PunctuationEventPlot({ data, width, height }: Props) {
  const plotWidth = width * INTERRUPTION_DENSITY_CHROME.plotEnd;
  const inset = plotWidth * INTERRUPTION_DENSITY_CHROME.plotInset;

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
        const guideY = Math.round(centerY) + 0.5;
        const commaR = Math.max(rowHeight * 0.18, 1.6);
        const dashHalf = Math.max(rowHeight * 0.42, 3);
        const terminalW = Math.max(rowHeight * 0.5, 3);

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
                opacity={0.35}
              />
            ) : null}

            {line.events.map((event, eventIndex) => {
              const x = plotX(event.x);
              const key = `${line.lineIndex}-${eventIndex}`;

              if (event.type === "comma") {
                return (
                  <circle
                    key={key}
                    cx={x}
                    cy={centerY}
                    r={commaR}
                    fill={PUNCTUATION_PRESSURE_CHROME.commaColor}
                    opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                  />
                );
              }

              if (event.type === "em_dash") {
                return (
                  <line
                    key={key}
                    x1={x - dashHalf}
                    y1={centerY}
                    x2={x + dashHalf}
                    y2={centerY}
                    stroke={PUNCTUATION_PRESSURE_CHROME.emDashColor}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                  />
                );
              }

              if (event.type === "semicolon") {
                return (
                  <text
                    key={key}
                    x={x}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={PUNCTUATION_PRESSURE_CHROME.semicolonColor}
                    fontSize={Math.max(rowHeight * 0.95, 8)}
                    opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                  >
                    ;
                  </text>
                );
              }

              if (event.type === "colon") {
                const dotOffset = Math.max(rowHeight * 0.16, 1.2);
                const dotR = Math.max(rowHeight * 0.11, 1);
                return (
                  <g key={key}>
                    <circle
                      cx={x}
                      cy={centerY - dotOffset}
                      r={dotR}
                      fill={PUNCTUATION_PRESSURE_CHROME.colonColor}
                      opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                    />
                    <circle
                      cx={x}
                      cy={centerY + dotOffset}
                      r={dotR}
                      fill={PUNCTUATION_PRESSURE_CHROME.colonColor}
                      opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                    />
                  </g>
                );
              }

              return (
                <rect
                  key={key}
                  x={x - terminalW / 2}
                  y={centerY - terminalW / 2}
                  width={terminalW}
                  height={terminalW}
                  fill={PUNCTUATION_PRESSURE_CHROME.terminalColor}
                  opacity={PUNCTUATION_PRESSURE_CHROME.eventOpacity}
                />
              );
            })}
          </g>
        );
      })}

      <g transform={`translate(${inset}, ${height + 40})`}>
        <circle cx={0} cy={0} r={4.5} fill={PUNCTUATION_PRESSURE_CHROME.commaColor} />
        <text x={18} y={0} dominantBaseline="middle" fontSize={RENDER_CHROME.axisLabelSize} fill={RENDER_CHROME.labelColor}>
          Comma
        </text>

        <line
          x1={126}
          y1={0}
          x2={140}
          y2={0}
          stroke={PUNCTUATION_PRESSURE_CHROME.emDashColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text x={158} y={0} dominantBaseline="middle" fontSize={RENDER_CHROME.axisLabelSize} fill={RENDER_CHROME.labelColor}>
          Em-dash
        </text>

        <text
          x={272}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={PUNCTUATION_PRESSURE_CHROME.semicolonColor}
          fontSize={18}
        >
          ;
        </text>
        <text x={292} y={0} dominantBaseline="middle" fontSize={RENDER_CHROME.axisLabelSize} fill={RENDER_CHROME.labelColor}>
          Semicolon
        </text>

        <circle cx={416} cy={-3.5} r={2} fill={PUNCTUATION_PRESSURE_CHROME.colonColor} />
        <circle cx={416} cy={3.5} r={2} fill={PUNCTUATION_PRESSURE_CHROME.colonColor} />
        <text x={434} y={0} dominantBaseline="middle" fontSize={RENDER_CHROME.axisLabelSize} fill={RENDER_CHROME.labelColor}>
          Colon
        </text>

        <rect
          x={534}
          y={-4.5}
          width={9}
          height={9}
          fill={PUNCTUATION_PRESSURE_CHROME.terminalColor}
        />
        <text x={560} y={0} dominantBaseline="middle" fontSize={RENDER_CHROME.axisLabelSize} fill={RENDER_CHROME.labelColor}>
          Terminal
        </text>
      </g>
    </g>
  );
}
