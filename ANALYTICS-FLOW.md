# Analytics Flow: Endpoint Response -> Divs and Canvases

This document describes the actual runtime path in this repository.

## 1. Backend builds the analytics payload

1. FastAPI app mounts the analytics router in `server/app.py` via:
   - `from server.analytics.router import router as analytics_router`
   - `app.include_router(analytics_router)`

2. Endpoint `GET /api/analytics/{poem_id}` is implemented in `server/analytics/router.py` (`get_analytics`).

3. `get_analytics` computes:
   - `summary_data` from `summary(body)`
   - `indent_data` from `indentation_data(body)`
   - `line_data` from `line_length_distribution(body)`
   - `inter_data` from `interruption_density(body)`
   - `punct_data` from `punctuation_pressure_data(body)`
   - `stanza_data` from `stanza_length_data(body)`

4. It packs typed `PerLineData` and returns `AnalyticsResponse`:
   - `poem_id`
   - `summary`
   - `scoring`
   - `render_plan`
   - `per_line`

5. Response schema is defined in `server/analytics/types.py`:
   - `class AnalyticsResponse(BaseModel)`
   - `summary: AnalyticsSummary`
   - `render_plan: FinalRenderPlan | None`
   - `per_line: PerLineData | None`

## 2. Browser request path

1. Frontend fetch happens in `app/components/analytics/PoemAnalytics.tsx`:
   - `fetch(`/api/analytics/${poemId}`)`

2. Next.js rewrite in `next.config.mjs` forwards that path to backend:
   - `/api/:path*` -> `http://127.0.0.1:8000/api/:path*`

## 3. Where analytics enters the page DOM

1. `app/components/poem/PoemDetail.tsx` renders analytics section when expanded:
   - `<section aria-label="Analytics" ...>`
   - `<div className="mt-4">`
   - `<PoemAnalytics poemId={poem.id} width={600} />`

2. `PoemAnalytics.tsx` controls request lifecycle:
   - loading state: `<p className="text-sm text-slate-500">Loading analytics…</p>`
   - error state: `<p className="text-sm text-red-400">Analytics unavailable.</p>`
   - success path: renders `<VisComposer ... />`

## 4. Render-plan to chart components (div layer)

1. `app/components/analytics/VisComposer.tsx` receives:
   - `summary`
   - `perLine`
   - `renderPlan`

2. It groups overlays by host visualisation (`overlaysByHost`).

3. It renders chart containers in pure React/HTML:
   - outer wrapper: `<div className="flex flex-col gap-6">`
   - primary row: one `AnalyticsChart`
   - secondary row: `<div className="flex gap-4">` with mapped charts
   - supporting row: `<div className="flex gap-4">` with mapped charts

4. Each `AnalyticsChart` renders:
   - title `<p ...>`
   - optional explanation `<p ...>`
   - canvas host wrapper `<div className="flex flex-col overflow-hidden rounded">`
   - `<RenderEngine spec={spec} visType={visType} width={width} height={height} />`

This is the point where endpoint data has become page divs.

## 5. Per-chart data extraction from endpoint payload

1. In `VisComposer.tsx`, each chart computes `spec` in `useMemo`:
   - `data = extractVisData(visType, perLine, summary)`
   - `s = buildVisSpec(data, cfg)`
   - apply each attached overlay with `applyOverlay(...)`

2. `extractVisData` lives in `app/lib/analytics/render/data/index.ts`.
   - Converts `PerLineData + AnalyticsSummary` into typed render data (`VisData`)
   - Example output kinds: `indentation_map`, `punctuation_pressure_strip`, `fracture_map`

3. `buildVisSpec` lives in `app/lib/analytics/render/spec/index.ts`.
   - Dispatches to chart-specific spec builders in `app/lib/analytics/render/charts/*.ts`
   - Produces declarative `RenderSpec`:
     - `layers`
     - optional `xAxis` / `yAxis`
     - optional `margin`
     - optional `legend`

4. Overlay composition is in `app/lib/analytics/render/overlay/index.ts`.
   - Policies choose additive vs transform behavior per host chart
   - Returns updated `RenderSpec`

## 6. RenderSpec to canvas nodes

1. `RenderEngine` (`app/lib/analytics/render/engine/RenderEngine.tsx`) maps spec to layout wrappers.

2. Default path (most charts):
   - `<div className="flex flex-col">`
   - chart area `<div style={{ height: `${height}px`, flexShrink: 0 }}>`
   - `<KonvaScene ... />`
   - `<HtmlLegend ... />` (legend as HTML divs/spans)

3. Special path for `punctuation_pressure_strip`:
   - `PunctuationSplitCanvas` creates a split row of two canvases
   - left canvas gets event layers + axes
   - right canvas gets summary layers only
   - both are still rendered through `KonvaScene`

## 7. Inside KonvaScene (actual canvas assembly)

1. `KonvaScene` is in `app/lib/analytics/render/engine/konva/scene.tsx`.

2. It builds topology and layout:
   - `resolveHostTopology(visType, spec)`
   - `layout = topology.createSpatialPolicy({ width, height }).resolve()`

3. It renders Konva root:
   - `<Stage width={width} height={height}>`
   - ordered `<Layer>` buckets: background, host, overlay, annotation, interaction

4. Each pass renders groups:
   - host layers through `KonvaPrimitiveRenderer`
   - axes through `YAxis` and `XAxis`
   - legend through Konva `Text`/`Group` (for scene legend pass)

## 8. Primitive-level drawing (shapes)

`KonvaPrimitiveRenderer` in `app/lib/analytics/render/engine/konva/KonvaPrimitiveRenderer.tsx` maps each `layer.primitive` to concrete Konva nodes:

- `bar_series` -> `Rect`
- `vertical_bar_series` -> `Rect`
- `topology_trace` -> `Line`
- `contour_fill` -> closed `Line`
- `density_field` -> repeated `Rect`
- `marker_overlay` -> repeated `Rect`
- `event_strip` -> `Circle`
- `interruption_event_strip` -> `Text`
- `interruption_event_plot` / `interruption_density_summary` -> split-pane chart classes
- `punctuation_event_plot` / `punctuation_pressure_summary` -> split-pane chart classes

Split-pane chart implementations are in `app/lib/analytics/render/engine/konva/splitPaneCharts.tsx` and output `Group`, `Line`, `Rect`, `Circle`, and `Text`.

## 9. One concrete end-to-end example

For `punctuation_pressure_strip`:

1. Endpoint returns `per_line.punctuation` and `summary`.
2. `PoemAnalytics` fetches JSON and passes to `VisComposer`.
3. `extractVisData("punctuation_pressure_strip", perLine, summary)` builds punctuation events per line.
4. `buildPunctuationPressureSpec(...)` creates two layer types:
   - `punctuation_event_plot`
   - `punctuation_pressure_summary`
5. `RenderEngine` detects `visType === "punctuation_pressure_strip"` and uses split rendering.
6. Left `<KonvaScene>` renders event plot + axes; right `<KonvaScene>` renders summary bars.
7. `KonvaPrimitiveRenderer` delegates to split-pane chart classes, which emit final Konva shapes.

Result: the API response has been transformed into:
- HTML structure (section, rows, chart wrappers, legend containers)
- one or more Konva canvases (`Stage`) with layered vector primitives.

## 10. Practical ownership map

- API payload shape: `server/analytics/types.py`
- Analytics computation: `server/analytics/pipeline.py`
- Endpoint assembly: `server/analytics/router.py`
- Frontend fetch + load/error UI: `app/components/analytics/PoemAnalytics.tsx`
- Chart row/column div layout: `app/components/analytics/VisComposer.tsx`
- Data -> visual data: `app/lib/analytics/render/data/index.ts`
- Visual data -> render spec: `app/lib/analytics/render/spec/index.ts` + `charts/*.ts`
- Overlay policy/composition: `app/lib/analytics/render/overlay/index.ts`
- Spec -> canvas layout: `app/lib/analytics/render/engine/RenderEngine.tsx`
- Scene graph + pass system: `app/lib/analytics/render/engine/konva/scene.tsx`
- Primitive drawing: `app/lib/analytics/render/engine/konva/KonvaPrimitiveRenderer.tsx`
- Split-pane chart drawing: `app/lib/analytics/render/engine/konva/splitPaneCharts.tsx`
