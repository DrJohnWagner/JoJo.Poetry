"use client";

import { useMemo } from "react";
import { RenderEngine } from "@/lib/analytics/render/engine/RenderEngine";
import { extractVisData } from "@/lib/analytics/render/data";
import { buildVisSpec } from "@/lib/analytics/render/spec";
import { applyOverlay } from "@/lib/analytics/render/overlay";
import { DEFAULT_THEME } from "@/lib/analytics/render/theme";
import { VIS_TITLES } from "@/lib/analytics/render/types";
import type {
  PerLineData,
  AnalyticsSummary,
  VisType,
} from "@/lib/analytics/render/types";

interface OverlayAttachment {
  overlay_type: string;
  host_visualisation: string;
}

interface VisCandidate {
  type: string;
  explanation?: string;
}

interface RenderPlan {
  primary: VisCandidate | null;
  secondary: VisCandidate[];
  supporting: VisCandidate[];
  overlays: OverlayAttachment[];
}

interface VisComposerProps {
  summary: AnalyticsSummary;
  perLine: PerLineData;
  renderPlan: RenderPlan;
  primaryWidth?: number;
  primaryHeight?: number;
  secondaryHeight?: number;
}

function AnalyticsChart({
  vis,
  summary,
  perLine,
  attachedOverlayTypes,
  width,
  height,
}: {
  vis: VisCandidate;
  summary: AnalyticsSummary;
  perLine: PerLineData;
  attachedOverlayTypes: string[];
  width: number;
  height: number;
}) {
  const visType = vis.type as VisType;

  const spec = useMemo(() => {
    const cfg = { width, height, theme: DEFAULT_THEME };
    const data = extractVisData(visType, perLine, summary);
    let s = buildVisSpec(data, cfg);

    for (const overlayType of attachedOverlayTypes) {
      const overlayData = extractVisData(overlayType as VisType, perLine, summary);
      s = applyOverlay({
        overlayType,
        hostVisType: visType,
        hostData: data,
        overlayData,
        hostSpec: s,
        cfg,
      });
    }

    return s;
  }, [visType, summary, perLine, attachedOverlayTypes, width, height]);

  const title = VIS_TITLES[visType] ?? visType;

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-600 mb-1 uppercase">
        {title}
      </p>
      {vis.explanation && (
        <p className="text-xs text-slate-500 mb-2 leading-snug">
          {vis.explanation}
        </p>
      )}
      <div className="rounded overflow-hidden">
        <RenderEngine spec={spec} width={width} height={height} />
      </div>
    </div>
  );
}

export function VisComposer({
  summary,
  perLine,
  renderPlan,
  primaryWidth    = 640,
  primaryHeight   = 320,
  secondaryHeight = 160,
}: VisComposerProps) {
  const overlaysByHost = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const o of renderPlan.overlays) {
      (map[o.host_visualisation] ??= []).push(o.overlay_type);
    }
    return map;
  }, [renderPlan.overlays]);

  const secondaryWidth = Math.round(
    primaryWidth / Math.max(renderPlan.secondary.length, 1),
  );

  return (
    <div className="flex flex-col gap-6">
      {renderPlan.primary && (
        <AnalyticsChart
          vis={renderPlan.primary}
          summary={summary}
          perLine={perLine}
          attachedOverlayTypes={overlaysByHost[renderPlan.primary.type] ?? []}
          width={primaryWidth}
          height={primaryHeight}
        />
      )}

      {renderPlan.secondary.length > 0 && (
        <div className="flex gap-4">
          {renderPlan.secondary.map((vis) => (
            <AnalyticsChart
              key={vis.type}
              vis={vis}
              summary={summary}
              perLine={perLine}
              attachedOverlayTypes={overlaysByHost[vis.type] ?? []}
              width={secondaryWidth}
              height={secondaryHeight}
            />
          ))}
        </div>
      )}

      {renderPlan.supporting.length > 0 && (
        <div className="flex gap-4">
          {renderPlan.supporting.map((vis) => {
            const supportingWidth = Math.round(
              primaryWidth / Math.max(renderPlan.supporting.length, 1),
            );
            return (
              <AnalyticsChart
                key={vis.type}
                vis={vis}
                summary={summary}
                perLine={perLine}
                attachedOverlayTypes={overlaysByHost[vis.type] ?? []}
                width={supportingWidth}
                height={secondaryHeight}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
