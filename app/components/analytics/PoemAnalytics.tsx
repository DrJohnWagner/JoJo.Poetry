/**
 * Top-level analytics display component.
 *
 * Fetches the analytics response for a poem and renders the full
 * visualisation plan via VisComposer. Handles loading and missing-data states.
 * Contains no analytics logic.
 */

"use client";

import { useEffect, useState } from "react";
import { VisComposer } from "./VisComposer";
import type { PerLineData, AnalyticsSummary } from "@/lib/analytics/render/types";

// Full analytics API response shape.
interface AnalyticsResponse {
  poem_id: string;
  summary: AnalyticsSummary;
  per_line: PerLineData;
  render_plan: {
    primary: { type: string; explanation?: string } | null;
    secondary: { type: string; explanation?: string }[];
    supporting: { type: string; explanation?: string }[];
    overlays: { overlay_type: string; host_visualisation: string }[];
  } | null;
}

interface PoemAnalyticsProps {
  poemId: string;
  width?: number;
}

export function PoemAnalytics({ poemId, width = 640 }: PoemAnalyticsProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setData(null);
    setError(null);

    fetch(`/api/analytics/${poemId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<AnalyticsResponse>;
      })
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(String(e));
      });

    return () => controller.abort();
  }, [poemId]);

  if (error) return <p className="text-sm text-red-400">Analytics unavailable.</p>;
  if (!data)  return <p className="text-sm text-slate-500">Loading analytics…</p>;
  if (!data.render_plan || !data.per_line) return null;

  return (
    <VisComposer
      summary={data.summary}
      perLine={data.per_line}
      renderPlan={data.render_plan}
      primaryWidth={width}
      primaryHeight={Math.round(width * 0.5)}
      secondaryHeight={Math.round(width * 0.25)}
    />
  );
}
