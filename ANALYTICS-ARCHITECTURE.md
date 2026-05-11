# Analytics Architecture

JoJo.Poetry formal telemetry engine — structural analysis of poems, scored against the corpus, rendered as deterministic SVG.

---

## System boundary

The analytics system has two distinct halves:

**Analytics pipeline** (Python, `server/analytics/`) — computes telemetry, scores metrics against the corpus, selects and plans visualisations. This half is complete. Do not modify it unless you are changing scoring logic or adding metrics.

**Render subsystem** (TypeScript, `app/lib/analytics/render/`) — consumes the analytics API response and produces SVG. This document covers the render subsystem.

---

## Render architecture: four layers

Each layer has a single responsibility and is ignorant of every layer below it.

```
PerLineData + AnalyticsSummary
        │
        ▼ Layer 1: Render Data
   typed drawable data (coordinates, densities, event lists)
        │
        ▼ Layer 2: Render Spec
   declarative layer list (normalised [0,1] coordinates)
        │
        ▼ Layer 3: Render Engine
   generic SVG primitives
        │
        ▼ Layer 4: Presentation
   React layout, sizing, interaction
```

---

## Layer 1 — Render Data

**Location:** `app/lib/analytics/render/data/index.ts`

**Responsibility:** convert `PerLineData` + `AnalyticsSummary` into typed, drawable data for each visualisation type.

**Constraints:** no SVG, no React, no side effects. Pure functions only.

**Dispatcher:**
```typescript
extractVisData(type: VisType, perLine: PerLineData, summary: AnalyticsSummary): VisData
```

Each vis type has one extractor. The extractor knows the domain mapping — e.g. that `momentum` is the inverse of normalised interruption score, that `fracture_map` blends interruption score with hard-punctuation density anchored by `syntax_fracture_density`.

**Output types** (`VisData` discriminated union):

| VisType | Data shape |
|---|---|
| `indentation_map` | `IndentationMapData` — per-line `{lineIndex, depth, text}`, `maxDepth` |
| `line_length_contour` | `LineLengthContourData` — per-line `{lineIndex, length}`, `maxLength` |
| `interruption_density_profile` | `InterruptionDensityData` — per-line `{lineIndex, score}`, `maxScore` |
| `momentum_profile` | `MomentumProfileData` — per-line `{lineIndex, momentum}` (inverted interruption) |
| `stanza_architecture` | `StanzaArchitectureData` — per-stanza `{startLineIndex, endLineIndex, lineLengths}` |
| `punctuation_pressure_strip` | `PunctuationPressureData` — per-line event lists by type |
| `fracture_map` | `FractureMapData` — per-line `{lineIndex, value}` in `[0,1]` |
| `semantic_pressure_overlay` | `SemanticPressureData` — per-line `{lineIndex, pressure}` from negation detection + `repetition_pressure` |

**Adding a new vis type:** add one extractor function and register it in the `EXTRACTORS` map.

---

## Layer 2 — Render Spec

**Location:** `app/lib/analytics/render/spec/index.ts`, `app/lib/analytics/render/spec/scales.ts`

**Responsibility:** convert `VisData` into a `RenderSpec` — an ordered list of `LayerSpec` objects with normalised `[0, 1]` coordinates. This is the only layer that applies scales.

**Constraints:** no SVG, no React. Coordinates are always normalised; the engine scales to pixels.

**Dispatcher:**
```typescript
buildVisSpec(data: VisData, cfg: VisConfig): RenderSpec
```

For overlays, a separate function returns `LayerSpec[]` rather than a full `RenderSpec`:
```typescript
buildSemanticPressureOverlayLayers(data: SemanticPressureData, cfg: VisConfig): LayerSpec[]
```

Overlay layers are merged onto a host spec by the compositor:
```typescript
composeSpec(host: RenderSpec, overlayLayers: LayerSpec[]): RenderSpec
// → { layers: [...host.layers, ...overlayLayers] }
```

**Spec structure:**
```typescript
interface RenderSpec {
  layers: LayerSpec[];
}

interface LayerSpec {
  id: string;
  primitive: PrimitiveType;
  data: PrimitiveData;   // normalised [0,1] coordinates
  style: LayerStyle;     // fill, stroke, opacity
}
```

**Scale utility:**
```typescript
linearScale(domain: [number, number], range: [number, number]): (v: number) => number
```

No D3. Single linear interpolation. Sufficient for all current vis types.

**Primitive data shapes** (`PrimitiveData` discriminated union):

| Primitive | Data |
|---|---|
| `bar_series` | `bars: [{index, y, height, width}]` — all normalised |
| `topology_trace` | `points: [{x, y}]` |
| `contour_fill` | `points: [{x, y}]` + `baselineX` — closes polygon at baseline |
| `density_field` | `cells: [{index, y, height, value}]` — `value` in `[0,1]` drives opacity |
| `segmentation_band` | `segments: [{stanzaIndex, startFrac, endFrac}]` — alternating fills |
| `marker_overlay` | `markers: [{lineIndex, y, height, value}]` — `value` modulates opacity |
| `event_strip` | `lines: [{lineIndex, y, height, events: [{type, x}]}]` |

**Vis → primitives mapping:**

| VisType | Primitives used |
|---|---|
| `indentation_map` | `bar_series` |
| `line_length_contour` | `contour_fill` + `topology_trace` |
| `interruption_density_profile` | `density_field` |
| `momentum_profile` | `contour_fill` + `topology_trace` |
| `stanza_architecture` | `segmentation_band` + `topology_trace` |
| `punctuation_pressure_strip` | `event_strip` |
| `fracture_map` | `density_field` |
| `semantic_pressure_overlay` | `marker_overlay` |

7 primitives, 8 vis types. `interruption_density_profile` and `fracture_map` share `density_field`. `line_length_contour` and `momentum_profile` share `contour_fill` + `topology_trace`.

**Adding a new vis type:** add one builder function, register in `BUILDERS`. If the geometry matches an existing primitive, no new primitive needed.

---

## Layer 3 — Render Engine

**Location:** `app/lib/analytics/render/engine/`

**Responsibility:** read a `RenderSpec`, dispatch each `LayerSpec` to the correct primitive component, render SVG.

**Constraints:** knows nothing about poetry, vis types, or analytics. Operates only on `RenderSpec` data.

**Compositor:**
```tsx
<RenderEngine spec={spec} width={w} height={h} />
// → <svg> with one component per LayerSpec
```

**Primitive components:**

| File | Component | SVG output |
|---|---|---|
| `BarSeries.tsx` | `<BarSeries>` | `<rect>` per bar |
| `TopologyTrace.tsx` | `<TopologyTrace>` | `<polyline>` |
| `ContourFill.tsx` | `<ContourFill>` | `<path>` closed to baseline |
| `DensityField.tsx` | `<DensityField>` | `<rect>` per cell, opacity = value |
| `SegmentationBand.tsx` | `<SegmentationBand>` | `<rect>` per stanza, alternating fill |
| `MarkerOverlay.tsx` | `<MarkerOverlay>` | `<rect>` per line, opacity = pressure |
| `EventStrip.tsx` | `<EventStrip>` | `<circle>` per punctuation event, colour by type |

All primitives receive pixel dimensions (`width`, `height`) and scale their normalised coordinates at render time. This means a `RenderSpec` can be reused at different sizes without recomputation.

**Adding a new primitive:** add a component file, add a case to the switch in `RenderEngine.tsx`, add the type to `PrimitiveType` in `types.ts`.

---

## Layer 4 — Presentation

**Location:** `app/components/analytics/`

**Responsibility:** fetch the analytics API response, orchestrate the render pipeline for the full render plan, handle sizing and layout.

**Constraints:** no analytics logic, no metric computation.

**`PoemAnalytics`** — fetches `/api/analytics/{poem_id}`, passes response to `VisComposer`.

**`VisComposer`** — for each vis in `render_plan.primary`, `render_plan.secondary`:
1. Calls `extractVisData()` (Layer 1)
2. Calls `buildVisSpec()` (Layer 2), merging attached overlay layers via `composeSpec()`
3. Renders via `<RenderEngine>` (Layer 3)

Overlay attachment is driven by `render_plan.overlays[].host_visualisation`. The compositor builds a lookup `host → [overlay_types]` and merges overlay layers onto the matching host spec.

**Sizing:** primary vis = `width × 0.5` height. Secondary vis = `width × 0.25` height. All ratios are arguments to `VisComposer` and can be overridden.

**Usage:**
```tsx
<PoemAnalytics poemId={poem.id} width={640} />
```

---

## API response

The analytics endpoint (`GET /api/analytics/{poem_id}`) returns:

```typescript
{
  poem_id: string,
  summary: AnalyticsSummary,    // 22 scalar metrics
  scoring: MetricScoring,       // per-metric scores + top_metrics
  render_plan: FinalRenderPlan, // primary, secondary, supporting, overlays
  per_line: PerLineData,        // raw per-line data for all pipeline functions
}
```

`per_line` keys:

| Key | Source function | Shape |
|---|---|---|
| `indentation` | `indentation_data()` | `IndentationLine[]` — `{line, leading_spaces, indent_level, text}` |
| `line_lengths` | `line_length_distribution()` | `LineLengthLine[]` — `{line, with_spaces, without_spaces}` |
| `interruption` | `interruption_density()` | `InterruptionLine[]` — `{line, score, dash_score, comma_score, …, text}` |
| `punctuation` | `punctuation_pressure_data()` | `PunctuationLine[]` — `{line, period_count, comma_count, dash_count, …, text}` |
| `stanzas` | `stanza_length_data()` | `StanzaData` — `{stanza_lengths[], total_stanzas, total_lines, average_lines_per_stanza}` |

---

## Theme

`DEFAULT_THEME` in `types.ts` defines the colour palette used by spec builders. All style properties flow through `LayerStyle` (`fill`, `fillAlt`, `stroke`, `strokeWidth`, `opacity`) — no colours are hardcoded in primitives except `EventStrip`, which maps punctuation type to a fixed colour table.

To theme the system: override `DEFAULT_THEME` and pass a `VisConfig` with the custom theme to `VisComposer`.

---

## Directory structure

```
server/analytics/
  pipeline.py          telemetry extraction (per-line data)
  scoring.py           metric scoring, rarity modes, corpus distributions
  render.py            visualisation selection, role assignment, overlay attachment
  resonance.py         structural resonance groups (score boosts)
  visualisation.py     VISUALISATION_META — all vis type configuration
  types.py             Pydantic models: ScoredMetric, FinalRenderPlan, PerLineData, …
  router.py            GET /api/analytics/{poem_id}

app/lib/analytics/render/
  types.ts             all shared types (API shapes, VisData, PrimitiveData, RenderSpec, Theme)
  data/
    index.ts           extractors: PerLineData + AnalyticsSummary → VisData
  spec/
    scales.ts          linearScale, clamp
    index.ts           spec builders: VisData + VisConfig → RenderSpec
  engine/
    RenderEngine.tsx   compositor: RenderSpec → <svg>
    primitives/
      BarSeries.tsx
      TopologyTrace.tsx
      ContourFill.tsx
      DensityField.tsx
      SegmentationBand.tsx
      MarkerOverlay.tsx
      EventStrip.tsx

app/components/analytics/
  PoemAnalytics.tsx    top-level component — fetches API, entry point
  VisComposer.tsx      pipeline orchestration: extract → spec → compose → render
```

---

## Extending the system

**New metric:** add to `METRIC_META` in `scoring.py` with appropriate `family`, weights, and `rarity_mode`. No frontend changes required unless a new vis type is warranted.

**New vis type:**
1. Add `VisType` to the union in `types.ts`
2. Add a `VisData` interface in `types.ts`
3. Add one extractor to `data/index.ts`, register in `EXTRACTORS`
4. Add one spec builder to `spec/index.ts`, register in `BUILDERS`
5. Add entry to `VISUALISATION_META` in `server/analytics/visualisation.py`

**New primitive:** add component to `engine/primitives/`, add case to `RenderEngine.tsx`, add `PrimitiveData` variant to `types.ts`.

**New overlay:** implement as a spec function returning `LayerSpec[]`, register its type string in `OVERLAY_BUILDERS` in `VisComposer.tsx`.

---

## Design invariants

- Coordinates in `RenderSpec` are always normalised `[0, 1]`. The engine is the only place that multiplies by `width`/`height`.
- Primitives have no knowledge of poetry, metrics, or vis types.
- Data extractors have no knowledge of SVG or React.
- Spec builders are the only place that applies `linearScale`.
- Overlay layers share the coordinate space of their host — they assume `y` maps to line index, `x` spans `[0, 1]`.
- The analytics pipeline (Python) is not modified for render concerns. The render system consumes what the API returns.
