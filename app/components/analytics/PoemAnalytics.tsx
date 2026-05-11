/**
 * Top-level analytics display component.
 *
 * Fetches the analytics response for a poem and renders the full
 * visualisation plan via DashboardComposer. Handles loading and missing-data states.
 * Contains no analytics logic.
 */

"use client";

import { useEffect, useState } from "react";
import { DashboardComposer } from "@/lib/analytics/layout/DashboardComposer"
import type {
    PerLineData,
    AnalyticsSummary,
    RenderPlan,
} from "@/lib/analytics/types"

// Full analytics API response shape.
interface AnalyticsResponse {
    poem_id: string
    summary: AnalyticsSummary
    per_line: PerLineData
    render_plan: RenderPlan | null
}

interface PoemAnalyticsProps {
  poemId: string;
  width?: number;
}

export function PoemAnalytics({ poemId, width = 640 }: PoemAnalyticsProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<{
      poemId: string
      message: string
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/analytics/${poemId}`, { signal: controller.signal })
        .then((r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            return r.json() as Promise<AnalyticsResponse>
        })
        .then((next) => {
            setData(next)
            setError(null)
        })
        .catch((e: unknown) => {
            if (e instanceof DOMException && e.name === "AbortError") return
            setError({ poemId, message: String(e) })
        })

    return () => controller.abort();
  }, [poemId]);

  if (error?.poemId === poemId)
      return <p className="text-sm text-red-400">Analytics unavailable.</p>
  if (!data || data.poem_id !== poemId)
      return <p className="text-sm text-slate-500">Loading analytics…</p>
  if (!data.render_plan || !data.per_line) return null;

  return (
      <DashboardComposer
          summary={data.summary}
          perLine={data.per_line}
          renderPlan={data.render_plan}
          primaryWidth={width}
          primaryHeight={Math.round(width * 0.5) + 50}
          secondaryHeight={Math.round(width * 0.25) + 50}
      />
  )
}
