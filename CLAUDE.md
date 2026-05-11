# JoJo.Poetry — Claude context

## Maintaining this file

Update this file whenever you learn something that would be useful context for
future sessions: architectural decisions, naming conventions, gotchas, workflow
preferences, field semantics, or anything that would otherwise need to be
re-explained. Commit the update as part of the relevant change, or on its own
if it is context-only. Do not ask permission and do not ask whether to update
it — just do it.

---

## Git workflow

Commit after significant work. Do **not** merge branches or delete branches
unless explicitly instructed — leave that to John.

---

## Repo purpose

Full-stack poetry portfolio app. FastAPI backend + Next.js frontend. The owner
(John Wagner) edits and annotates his poems locally and deploys a read-only
view publicly.

---

## Running tests

Always use `make test`, not raw `pytest`:

```
make test   # sets READ_ONLY=false, which the mutation/create/ordering tests require
```

Raw `pytest` runs without `READ_ONLY=false` and produces 41 spurious failures in
`test_create`, `test_mutations`, and `test_ordering` — all 405s from the write
endpoints being disabled. Those failures are not regressions; they disappear
under the correct env.

---

## RO / RW deployment model

The app runs in two modes via a single env flag:

| Mode | Flag | Used for |
|------|------|----------|
| Read-write | `READ_ONLY=false` | Local development — full create/edit/delete UI |
| Read-only | `READ_ONLY=true` | Public web deployment — portfolio view, no mutations |

Same binary, same database, same API — behaviour gated by the flag.

---

## Database architecture

`database/` contains **development fixtures only** — a small representative
sample of poems for local dev and tests.

The authoritative database is maintained by a **separate codebase** that:
- Downloads poems from AllPoetry.com
- Annotates them with themes, register, form, imagery, etc.
- Saves them as JSON files

When running the app for real, the server is pointed at that external database.

**Implication for schema changes:** any field rename or structural change to the
poem schema must be applied in both this repo and the upstream scraper/annotator
repo. John updates the fixture JSON files in `database/` manually after making
the same change upstream. When fixture files change independently of
server/frontend code, it is intentional upstream sync — not an error.

---

## Field naming: contest_fit vs. awards

The poem schema has two distinct contest-related fields that must never be
conflated:

| Field | Type | Purpose |
|-------|------|---------|
| `awards` | `Award[]` | Structured records of contests the poem was entered in, each with a `medal` tier, `url`, and optional `title` |
| `contest_fit` | `string[]` | Free-vocabulary tags used to match the poem to future contests — searchable, editable inline |

`contest_fit` is a tag array like `themes` or `form_and_craft`. It has nothing
to do with `awards` and must be left untouched whenever `awards` is renamed or
restructured.

---

## PoemSummaryData field additions — known gotcha

`NeighbourResult` (in `server/similarity/service.py`) extends `PoemSummaryData`
but is constructed field-by-field. Whenever a new field is added to
`PoemSummaryData`, grep for every `NeighbourResult(` constructor call and add
the field there too — it will not error at runtime (Pydantic uses the field
default), it will just silently return empty/zero data to the frontend.

---

## Key schema types

```
Award  { url: str, medal: str, title?: str }
Poem.awards: Award[]          # contest entries (read-only in UI for now)
Poem.contest_fit: str[]       # matching tags (inline-editable)
```

`medal` values: `Gold`, `Silver`, `Bronze`, `Honorable Mention`, `None` (sentinel for no contests).

---

## Analytics render module boundaries

`app/lib/analytics/render/theme.ts` is now palette-only. It should only hold:
- `COLOURMAP`
- `ColourValue`/`ColourmapEntry` types
- `lighter()` / `darker()` / `darken`

Base chart defaults and shared render chrome live in:
- `app/lib/analytics/render/base/BaseChart.ts`

Chart-specific settings live in chart modules:
- `app/lib/analytics/render/charts/interruptionDensity.ts`
- `app/lib/analytics/render/charts/punctuationPressure.ts`
- `app/lib/analytics/render/charts/overlays.ts`

`app/lib/analytics/render/interruptionEvents.ts` was removed; consumers should
import interruption event types/config directly from
`app/lib/analytics/render/charts/interruptionDensity.ts`.

Dashboard-level migration away from the render-spec engine has started:
- `app/lib/analytics/render/layout/DashboardComposer.tsx` now instantiates chart objects.
- `app/lib/analytics/render/charts/BaseChart.tsx` is the new chart-owned boundary.
- `app/lib/analytics/render/charts/PunctuationPressureChart.tsx` renders directly with Konva and does not use `render/data`, `render/spec`, `render/overlay`, or `render/engine`.
- `app/lib/analytics/render/charts/LegacySpecChart.tsx` is a temporary adapter for charts still on the old spec/engine pipeline.
- `app/components/analytics/PoemAnalytics.tsx` now enters the renderer through `DashboardComposer`, not `VisComposer`.

Plotly-first analytics renderer has replaced the old render stack:
- Active path is now `AnalyticsResponse -> app/components/analytics/PoemAnalytics.tsx -> app/lib/analytics/layout/DashboardComposer.tsx -> app/lib/analytics/charts/*.ts -> app/lib/analytics/plotly/PlotlyRenderer.tsx`.
- Legacy `app/lib/analytics/render/` and `app/components/analytics/VisComposer.tsx` were removed.
- New chart modules build Plotly figures directly. The dashboard owns grouping/layout; Plotly owns chart rendering/layout internals.

Spec helpers/builders were split so `spec/index.ts` is now a dispatcher:
- Shared axis factories are in `app/lib/analytics/render/base/Axis.ts`.
- Per-visualisation spec builders are in `app/lib/analytics/render/charts/*.ts`:
	`IndentationMap.ts`, `LineLengthMap.ts`, `LineLengthDistribution.ts`,
	`InterruptionDensityProfile.ts`, `MomentumProfile.ts`,
	`StanzaArchitecture.ts`, `PunctuationPressureSpec.ts`, `FractureMap.ts`,
	and semantic overlay builder in `SemanticPressure.ts`.
