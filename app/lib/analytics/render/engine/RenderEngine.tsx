/**
 * Render Engine — generic SVG compositor.
 *
 * Applies margin, dispatches each LayerSpec to the correct primitive,
 * renders y-axis (left) and x-axis (bottom) from the spec's axis data.
 * Knows nothing about poetry, analytics, or vis types.
 */

import type { RenderSpec, LayerSpec, AxisSpec, Margin, LegendItem, LegendSpec } from "../types";
import { DEFAULT_RENDER_MARGIN, RENDER_CHROME } from "../theme";
import { BarSeries }                from "./primitives/BarSeries";
import { VerticalBarSeries }        from "./primitives/VerticalBarSeries";
import { TopologyTrace }            from "./primitives/TopologyTrace";
import { ContourFill }              from "./primitives/ContourFill";
import { DensityField }             from "./primitives/DensityField";
import { InterruptionEventPlot }    from "./primitives/InterruptionEventPlot";
import { InterruptionDensitySummary } from "./primitives/InterruptionDensitySummary";
import { SegmentationBand }         from "./primitives/SegmentationBand";
import { MarkerOverlay }            from "./primitives/MarkerOverlay";
import { EventStrip }               from "./primitives/EventStrip";
import { InterruptionEventStrip }   from "./primitives/InterruptionEventStrip";
import type {
  BarSeriesData,
  VerticalBarSeriesData,
  TopologyTraceData,
  ContourFillData,
  DensityFieldData,
  InterruptionEventPlotData,
  InterruptionDensitySummaryData,
  SegmentationBandData,
  MarkerOverlayData,
  EventStripData,
  InterruptionEventStripData,
} from "../types";

interface PrimitiveProps {
  layer: LayerSpec;
  width: number;
  height: number;
}

function Primitive({ layer, width, height }: PrimitiveProps) {
  const { primitive, data, style } = layer;
  const props = { style, width, height };

  switch (primitive) {
    case "bar_series":
      return <BarSeries data={data as BarSeriesData} {...props} />;
    case "vertical_bar_series":
      return <VerticalBarSeries data={data as VerticalBarSeriesData} {...props} />;
    case "topology_trace":
      return <TopologyTrace data={data as TopologyTraceData} {...props} />;
    case "contour_fill":
      return <ContourFill data={data as ContourFillData} {...props} />;
    case "density_field":
      return <DensityField data={data as DensityFieldData} {...props} />;
    case "interruption_event_plot":
      return <InterruptionEventPlot data={data as InterruptionEventPlotData} {...props} />;
    case "interruption_density_summary":
      return <InterruptionDensitySummary data={data as InterruptionDensitySummaryData} {...props} />;
    case "segmentation_band":
      return <SegmentationBand data={data as SegmentationBandData} {...props} />;
    case "marker_overlay":
      return <MarkerOverlay data={data as MarkerOverlayData} {...props} />;
    case "event_strip":
      return <EventStrip data={data as EventStripData} {...props} />;
    case "interruption_event_strip":
      return <InterruptionEventStrip data={data as InterruptionEventStripData} {...props} />;
    default:
      return null;
  }
}

function YAxis({
  axis,
  drawH,
  m,
}: {
  axis: AxisSpec;
  drawH: number;
  m: Margin;
}) {
  const x0 = m.left;
  const y0 = m.top;
  const y1 = m.top + drawH;
  const topHorizontalLabel = axis.labelPlacement === "top-horizontal";

  return (
    <g>
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke={RENDER_CHROME.axisColor} strokeWidth={RENDER_CHROME.axisStrokeWidth} />
      {topHorizontalLabel ? (
        <text
          x={x0 - RENDER_CHROME.tickSize - RENDER_CHROME.yAxisTickLabelGap - 2}
          y={y0 - 10}
          textAnchor="end"
          fontSize={RENDER_CHROME.axisLabelSize}
          fill={RENDER_CHROME.labelColor}
        >
          {axis.label}
        </text>
      ) : (
        <text
          transform={`translate(${RENDER_CHROME.yAxisLabelTranslateX}, ${y0 + drawH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={RENDER_CHROME.axisLabelSize}
          fill={RENDER_CHROME.labelColor}
        >
          {axis.label}
        </text>
      )}
      {axis.ticks.map((tick, i) => {
        const y = y0 + tick.normPos * drawH;
        return (
          <g key={i}>
            <line
              x1={x0 - RENDER_CHROME.tickSize} y1={y}
              x2={x0}             y2={y}
              stroke={RENDER_CHROME.axisColor} strokeWidth={RENDER_CHROME.axisStrokeWidth}
            />
            <text
              x={x0 - RENDER_CHROME.tickSize - RENDER_CHROME.yAxisTickLabelGap}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={RENDER_CHROME.tickLabelSize}
              fill={RENDER_CHROME.labelColor}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XAxis({
  axis,
  drawW,
  m,
  totalH,
}: {
  axis: AxisSpec;
  drawW: number;
  m: Margin;
  totalH: number;
}) {
  const baseY = m.top + (totalH - m.top - m.bottom);
  const x0    = m.left;
  const startNorm = axis.startNorm ?? 0;
  const endNorm = axis.endNorm ?? 1;
  const axisW = drawW * (endNorm - startNorm);
  const axisX0 = x0 + drawW * startNorm;

  return (
    <g>
      <line
        x1={axisX0} y1={baseY}
        x2={axisX0 + axisW} y2={baseY}
        stroke={RENDER_CHROME.axisColor} strokeWidth={RENDER_CHROME.axisStrokeWidth}
      />
      <text
        x={axisX0 + axisW / 2}
        y={baseY + (axis.labelOffset ?? (m.bottom - RENDER_CHROME.xAxisLabelBottomOffset))}
        textAnchor="middle"
        fontSize={RENDER_CHROME.axisLabelSize}
        fill={RENDER_CHROME.labelColor}
      >
        {axis.label}
      </text>
      {axis.ticks.map((tick, i) => {
        const x = axisX0 + tick.normPos * axisW;
        return (
          <g key={i}>
            <line
              x1={x} y1={baseY}
              x2={x} y2={baseY + RENDER_CHROME.tickSize}
              stroke={RENDER_CHROME.axisColor} strokeWidth={RENDER_CHROME.axisStrokeWidth}
            />
            <text
              x={x}
              y={baseY + RENDER_CHROME.tickSize + RENDER_CHROME.xAxisTickLabelOffset}
              textAnchor="middle"
              fontSize={RENDER_CHROME.tickLabelSize}
              fill={RENDER_CHROME.labelColor}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function LegendSymbol({ item, cx, cy }: { item: LegendItem; cx: number; cy: number }) {
  return (
    <text
      x={cx} y={cy}
      textAnchor="middle" dominantBaseline="middle"
      fontSize={item.fontSize ?? 12} fontWeight="bold"
      fill={item.color}
    >
      {item.glyph}
    </text>
  );
}

function Legend({ legend, m, totalW }: { legend: LegendSpec; m: Margin; totalW: number }) {
  const drawW      = totalW - m.left - m.right;
  const perRow     = legend.columns ?? 3;
  const colW       = drawW / perRow;
  const rowH       = RENDER_CHROME.legendRowHeight;
  const symbolPad  = RENDER_CHROME.legendSymbolPad;
  const textOffset = RENDER_CHROME.legendTextOffset;

  return (
    <g transform={`translate(${m.left}, ${RENDER_CHROME.legendTranslateY})`}>
      {legend.items.map((item, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const x   = col * colW;
        const y   = row * rowH + rowH / 2;
        return (
          <g key={item.label}>
            <LegendSymbol item={item} cx={x + symbolPad} cy={y} />
            <text
              x={x + textOffset}
              y={y}
              dominantBaseline="middle"
              fontSize={RENDER_CHROME.legendTextSize}
              fill={RENDER_CHROME.labelColor}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface RenderEngineProps {
  spec: RenderSpec;
  width: number;
  height: number;
  className?: string;
}

export function RenderEngine({ spec, width, height, className }: RenderEngineProps) {
  const m     = spec.margin ?? DEFAULT_RENDER_MARGIN;
  const drawW = width  - m.left - m.right;
  const drawH = height - m.top  - m.bottom;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <g transform={`translate(${m.left}, ${m.top})`}>
        {spec.layers.map((layer) => (
          <Primitive key={layer.id} layer={layer} width={drawW} height={drawH} />
        ))}
      </g>
      {spec.legend && <Legend legend={spec.legend} m={m} totalW={width} />}
      {spec.yAxis && <YAxis axis={spec.yAxis} drawH={drawH} m={m} />}
      {spec.xAxis && <XAxis axis={spec.xAxis} drawW={drawW} m={m} totalH={height} />}
    </svg>
  );
}
