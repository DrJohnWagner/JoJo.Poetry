# JoJo.Poetry

A small, curated collection of poems by JoJo, presented as a literary
publication rather than a web app. The site shows the poems, lets the
author pin, edit, create, and delete them, and offers both a simple
keyword search and a field-specific advanced search.

This first draft is complete end-to-end: data model, backend API,
typography-first frontend, Docker configuration, and a test suite.

## Architecture

Two services, one flat JSON data source:

```
┌─────────────────┐ HTTP/JSON ┌──────────────────────┐
│ Next.js 15 │ ───────────▶ │ FastAPI │
│ React 19 / TS │ │ Pydantic v2 │
│ Tailwind 3 │ ◀─────────── │ │
└─────────────────┘ └──────────┬───────────┘
 │ atomic fs write
 ▼
 database/Poems.json (source of truth)
 database/schemas/
 poem.schema.json (JSON Schema)
 poem.py (Pydantic models)
```

- **Backend** (`server/`): FastAPI app that loads `Poems.json` into
  memory at startup, serves read/search endpoints, and persists
  mutations back to the JSON file atomically. All validation goes
  through the Pydantic `Poem` model generated alongside the JSON
  Schema.
- **Frontend** (`app/` with `app/components/` and `app/lib/`): Next.js App Router project. A
  server-rendered landing page hands off to a client listing
  component that owns search, pagination, editing, and deletion. A
  dedicated `/poems/new` page handles creation; `/poems/[id]`
  renders the detail view with inline editing.
- **Data source** (`database/Poems.json`): a single flat JSON array
  of poem objects. It is the only persistent store; there is no
  database server.

## Repository layout

```
.
├── server/
│   ├── app.py                        # FastAPI factory, CORS, lifespan load + similarity init
│   ├── api.py                        # All routes (read, search, POST/PATCH/DELETE, similarity)
│   ├── config.py                     # Settings: POEMS_DATABASE, .env, paths
│   ├── repository.py                 # In-memory, file-backed PoemRepository
│   ├── similarity/
│   │   ├── types.py                  # NormalisedPoemFeatures, score breakdowns, NeighbourResult
│   │   ├── normalise.py              # Poem → NormalisedPoemFeatures (lowercase, dedup, synonyms)
│   │   ├── structured.py             # Jaccard similarity over tag sets; StructuredScoreBreakdown
│   │   ├── semantic.py               # SemanticSimilarityIndex: TF-IDF on project/form/image text
│   │   ├── fusion.py                 # Weighted blend of structured + semantic; axis weights
│   │   └── service.py                # PoemSimilarityService; module-level init/rebuild helpers
│   └── Dockerfile                    # Python 3.11-slim image
├── requirements.txt                  # Production Python deps
├── requirements-dev.txt              # Adds pytest, httpx, jsonschema
├── tests/server/                     # pytest suite (187 tests)
├── app/
│   ├── page.tsx                      # Landing: listing + search + incremental load + recent poems aside
│   ├── poems/[id]/page.tsx           # Detail + inline editing + similar poems panel
│   ├── poems/new/page.tsx            # Dedicated create page
│   ├── layout.tsx, globals.css
│   ├── components/
│   │   ├── AppConfig.tsx             # React context provider for runtime config (readOnly)
│   │   ├── Page.tsx                  # Two-column grid wrapper (lg: auto + clamp(20rem,…,30rem), centred)
│   │   ├── LColumn.tsx               # Left column: max-w-prose, mx-auto on narrow / mx-0 in grid
│   │   ├── RColumn.tsx               # Right aside: sticky, 106px top padding in grid mode
│   │   ├── Header.tsx                # Site header (title + "New poem" link); imported by each page
│   │   ├── PoemListing.tsx           # Client: fetch, infinite scroll, row edit/delete
│   │   ├── PoemEditorForm.tsx        # Shared editor (list row + detail)
│   │   ├── PoemRowEditor.tsx         # Thin wrapper around PoemEditorForm for rows
│   │   ├── PoemCreateForm.tsx        # Dedicated POST form with defaults + guards
│   │   ├── PoemDetail.tsx            # Reading view + Edit toggle
│   │   ├── SimilarPoems.tsx          # Similar poems aside: all 5 axes (overall/theme/form/emotion/imagery) grouped
│   │   ├── RecentPoems.tsx           # Recent poems aside: k most recent by date, title + project
│   │   ├── PoemSummary.tsx           # Shared list item: title link + project line; used in both asides
│   │   ├── SearchBar.tsx             # q + submit + Advanced modal trigger
│   │   ├── SortBar.tsx               # Client-side sort buttons (title/date/lines/words/rating/medals)
│   │   ├── AdvancedSearchDialog.tsx  # Native <dialog>-backed modal (title/body/project/notes/year/month/medals/tags)
│   │   ├── PoemRow.tsx               # Single poem row (title, meta, collapsible body)
│   │   ├── CopyButton.tsx            # Copy-to-clipboard icon button; variant="outline"|"filled" selects icon set
│   │   ├── PoemTitle.tsx             # Shared <h2> with optional Link wrapper + two copy buttons (partial / full markdown)
│   │   ├── PoemStatistics.tsx        # Shared metadata line (date · rating · lines · words · medals)
│   │   ├── PoemProject.tsx           # Italic project statement, null-safe
│   │   ├── PoemAward.tsx             # Medal icon + medal label + optional award link
│   │   ├── PoemSocial.tsx            # Social URL rendered as hostname link
│   │   ├── PoemMetadataEditor.tsx    # Shared rating/date/url grid + all six TagInput fields
│   │   ├── PinToggle.tsx             # Server-confirmed pin/unpin
│   │   ├── DeleteButton.tsx          # Two-step confirmation control
│   │   ├── NotesEditor.tsx           # Multi-line textarea for author's notes (one line = one note)
│   │   ├── HorizontalRule.tsx        # Shared <div class="rule my-5" /> divider
│   │   └── PoemBody.tsx              # Body rendered as HTML: <br/> line breaks + anchor links
│   └── lib/
│       ├── api.ts                    # Typed fetch wrappers (fetchPoems, fetchSimilarPoems → SimilarityBundle, fetchRecentPoems)
│       ├── types.ts                  # Author / Poem / SearchState / NeighbourListResult / SimilarityBundle / RecentList
│       ├── editable.ts               # Canonical editable-field contract
│       └── format.ts                 # body ↔ plaintext, date formatting, cleanPoetryUrl, poemToMarkdown(full)
├── database/
│   ├── Poems.json                    # Canonical collection
│   ├── <Title>.json                  # Per-poem mirror files (reference only)
│   └── schemas/
│       ├── poem.schema.json          # JSON Schema (Draft 2020-12)
│       ├── poem.py                   # Pydantic Poem / Contest / Author
│       └── similarity.py             # Re-exports similarity response types for API use
├── Dockerfile                        # Combined multi-stage image (Node 22 + Python 3.11, Debian bookworm-slim, no CMD)
└── docker-compose.yml                # Orchestrates backend + frontend
```

## Poem data model

The authoritative schema is `database/schemas/poem.schema.json`;
`database/schemas/poem.py` is its Pydantic mirror.

| Field                                                                                   | Type                       | Required                     | Editable            | Searchable                    | Notes                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------- | ---------------------------- | ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                  | UUID v4 string             | yes                          | **immutable** | no                            | Sole identifier used everywhere.                                                                   |
| `title`                                                                               | string                     | yes                          | yes                 | yes                           |                                                                                                    |
| `url`                                                                                 | URI                        | yes                          | yes                 | no                            | Canonical external link.                                                                           |
| `body`                                                                                | string (HTML fragment)     | yes                          | yes                 | yes\*                         | `` line breaks + literal whitespace for indentation. \*Search hits a plain-text projection. |
| `awards`                                                                              | `[{url, medal, title?}]` | yes (may be empty)           | yes (API)           | via `medals` filter         | `medal` is surfaced to search; `title` is an optional award name displayed in the UI.          |
| `date`                                                                                | ISO 8601 datetime          | yes                          | yes                 | year/month in advanced search | Timezone-aware; UTC in existing data.                                                              |
| `themes`, `emotional_register`, `form_and_craft`, `key_images`, `contest_fit` | `string[]`               | yes (may be empty)           | yes                 | yes                           | Free-vocabulary tags.                                                                              |
| `project`                                                                             | string                     | yes                          | yes                 | yes                           | One-sentence authorial statement.                                                                  |
| `rating`                                                                              | int 0–100                 | yes                          | yes                 | min/max band                  | Authorial self-rating.                                                                             |
| `lines`, `words`                                                                    | int ≥ 0                   | yes                          | **derived**   | no                            | Recomputed from `body` on every write.                                                           |
| `pinned`                                                                              | bool                       | optional (default `false`) | yes                 | no                            | Pinned poems lead listings.                                                                        |
| `socials`                                                                             | `string[]`               | optional (default `[]`)    | yes                 | no                            | Social media URLs; displayed as links on the detail page.                                          |
| `notes`                                                                               | `string[]`               | optional (default `[]`)    | yes                 | yes                           | One string per note; edited via multi-line textbox (one line = one note).                          |
| `author`                                                                              | `{pen_name, full_name}`  | optional (default `null`)  | yes (API)           | no                            | Author identity. Displayed on the detail page; no inline editor (structured object).               |

Strictness: `extra="forbid"` on the Pydantic model and
`additionalProperties: false` on the JSON Schema. Unknown fields are
rejected on every read and every write.

### The `body` field — text fidelity

- **Stored verbatim** as an HTML fragment: `<br/>` line breaks and
  literal leading whitespace for indentation. No normalisation on
  write.
- **Projected** for search, `lines`/`words` derivation, display, and
  editing by one shared regex (`<br\s*/?>\n?` → `\n`) on both
  backend (`_body_to_plaintext`) and frontend (`bodyToPlainText`).
- **Displayed** as HTML via `dangerouslySetInnerHTML` inside
  `white-space: pre-wrap`, so authored newlines **and** leading-whitespace
  indentation survive byte-for-byte. Anchor tags (`<a href="...">`) are
  normalised on render: the href and text are extracted and the tag is
  rewritten as `<a href="…" target="_blank" rel="noreferrer">text ↗</a>`,
  opening in a new tab with a visual indicator.
- **Edited** as the same plaintext projection — writers edit what
  they read. `plainTextToBody` rewrites each newline as `<br/>\n`
  when saving, reproducing the canonical stored form.

## The role of `database/Poems.json`

`database/Poems.json` is a single JSON array of poem objects. It is
the only persistent data store. The backend loads it at startup,
validates every record against the Pydantic model, and serves reads
from memory. Every mutation (POST, PATCH, DELETE) writes the full
array back atomically (temp file + `fsync` + `os.replace`) **before**
swapping the new state into memory, so a failed disk write leaves
memory and disk identically untouched.

**External edits are picked up automatically.** Every GET endpoint
runs a lightweight `os.stat()` check; if the file's mtime has changed
since the last load or write, the file is reloaded and the similarity
index is rebuilt before the response is served. Mutations additionally
re-check the mtime under the write lock *before* computing the next
state, so an external edit is merged in rather than silently
overwritten. After each successful write the stored mtime is refreshed
from the newly written file, preventing the server's own writes from
triggering a spurious reload on the next GET.

The per-title files in `database/` (e.g. `Not a Metaphor.json`) are
historical mirror files kept for convenience; the backend does not
read or write them.

## Schema artefacts in `database/schemas`

- **`poem.schema.json`** — JSON Schema (Draft 2020-12). Usable
  outside the runtime for editor autocomplete, external validators,
  and CI checks. Rejects unknown fields and enforces UUID-v4 `id`,
  bounded rating, and required-vs-optional structure.
- **`poem.py`** — Pydantic models (`Poem`, `Contest`, `Author`). Used
  by the backend at runtime for load-time validation, PATCH-merge
  validation, and response shaping. Applies the documented defaults
  (`pinned=false`, `socials=[]`, `notes=[]`, `author=null`) when optional fields are absent.

## Configuration

### Backend

| Variable           | Default                                         | Purpose                                                                                                                            |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POEMS_DATABASE` | `<repo>/database/Poems.json`                  | Path to the poems JSON file. Absolute paths used verbatim; relative paths resolved against the**current working directory**. |
| `CORS_ORIGINS`   | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed origins for browser calls.                                                                         |
| `READ_ONLY`      | `true`                                        | When `true`, all mutation endpoints (POST/PATCH/DELETE) return `405 Method Not Allowed`.                                       |

A `.env` file in the current working directory is auto-loaded (via
`pydantic-settings`). Settings are exposed through
`server.config.Settings`; tests pass overrides directly.

### Frontend

| Variable                     | Default                   | Purpose                                                                                                                              |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Origin the browser calls. Inlined at build time.                                                                                     |
| `READ_ONLY`                | `true`                  | When `true`, hides all editing controls (pin, edit, delete, new poem). Read at server-component render time; not inlined at build. |

Both services default to read-only. Pass `READ_ONLY=false` to enable
editing (see Local development and Docker sections below).

Copy `.env.example` to `.env.local` to override frontend env vars.

## Local development

Use `make setup` once to install all dependencies, then the `dev-ro` /
`dev-rw` targets to start both services in parallel:

```bash
make setup          # create venv, uv sync, npm install (one-time)

make dev-ro         # read-only  — backend + frontend, parallel
make dev-rw         # read-write — backend + frontend, parallel
```

Or run backend and frontend separately:

```bash
make dev-server-ro  # READ_ONLY=true  uvicorn --reload  (port 8000)
make dev-server-rw  # READ_ONLY=false uvicorn --reload  (port 8000)

make dev-web-ro     # READ_ONLY=true  npm run dev       (port 3000)
make dev-web-rw     # READ_ONLY=false npm run dev       (port 3000)
```

Or manually, without Make:

```bash
# Backend
uv venv .venv && source .venv/bin/activate
uv sync --group dev
READ_ONLY=false uv run uvicorn server.app:app --reload   # http://localhost:8000

# Frontend (separate terminal)
npm install
READ_ONLY=false npm run dev                              # http://localhost:3000
```

The frontend calls the backend at `NEXT_PUBLIC_API_BASE_URL`; the
backend's default CORS allows `http://localhost:3000`.

## Docker

A two-service `docker-compose.yml` runs the whole stack. By default,
the frontend is published on **host port `3005`** (container port 3000
internally); the backend is published on `8000`. Both services default
to `READ_ONLY=true`.

```bash
make docker-up-build-ro   # build + start, read-only  → http://localhost:3005
make docker-up-build-rw   # build + start, read-write → http://localhost:3005
```

Or without Make:

```bash
READ_ONLY=false docker compose up --build
```

Other useful targets:

```bash
make docker-up-ro           # start (no build) read-only
make docker-up-rw           # start (no build) read-write
make docker-up-detached-ro  # detached, read-only
make docker-up-detached-rw  # detached, read-write
make docker-down            # stop and remove containers
make docker-logs            # stream logs
make docker-ps              # service status
make docker-shell-server    # shell into running server container
make docker-shell-web       # shell into running web container
```

The combined `Dockerfile` is a three-stage Debian bookworm-slim build (no `CMD`) that can be used as a base or composed into custom orchestrations. The `docker-compose.yml` builds on top of it.

Details:

- `Dockerfile` builds the Next.js standalone output (stage 1), installs Python deps (stage 2), and produces a combined runtime image with Node 22 + Python 3.11 (stage 3). No `CMD` — use as a base or supply one in `docker-compose.yml`.
- The compose file's backend service copies `requirements.txt`, `server/`, and
  `database/` into the image; default `POEMS_DATABASE` resolves to
  `/app/database/Poems.json`.
- The compose file **bind-mounts** `./database/` into the backend
  container so edits made through the UI persist back to the host's
  checked-in JSON file. Drop the volume to get an ephemeral container.
- The backend service publishes `${API_PORT:-8000}:8000`, so the browser can reach
  `http://localhost:8000` directly from the host.
- The frontend image is a multi-stage Next.js build; the API base URL
  is inlined at build time via `NEXT_PUBLIC_API_BASE_URL` build-arg,
  and defaults to `http://localhost:8000`.
- `CORS_ORIGINS` in the backend service is set to
  `http://localhost:3005` (and `127.0.0.1`) so the browser can talk to
  the backend from the host-published frontend.

Override host ports without editing files:

```bash
WEB_PORT=3006 docker compose up --build
API_PORT=8001 WEB_PORT=3006 docker compose up --build
```

## Client-side sorting

The listing page applies a second, client-side sort layer on top of the server's authoritative ordering. Poems already fetched (across all loaded pages) are re-sorted in the browser without a network round-trip:

| Button | Default direction | Sort key                      |
| ------ | ----------------- | ----------------------------- |
| Title  | A → Z            | `title` (locale-aware)      |
| Date   | newest first      | `date` (ISO 8601 timestamp) |
| Lines  | most first        | `lines` (integer)           |
| Words  | most first        | `words` (integer)           |
| Rating | highest first     | `rating` (integer)          |
| Awards | most first        | `awards.length` (integer)   |

One button is always active (Date descending by default). Clicking the active button toggles direction; clicking an inactive button selects it at its default direction. The sort is re-applied automatically as new pages are loaded via infinite scroll.

## The search system

Two endpoints, intentionally distinct.

### Simple keyword search — `GET /api/poems?q=…`

Case-insensitive substring match over a curated set of fields: `title`,
body plain-text projection, `project`, all tag arrays, and the `notes`
array. Excluded: URLs, `id`, numeric and boolean fields. `q` combines conjunctively with the same
endpoint's tag and numeric filters (`themes=…`, `min_rating=…`, etc.).

### Advanced field search — `GET /api/poems/search`

Field-specific matching with **OR across populated fields**. A poem
matches if it satisfies **any** populated field. Empty advanced query
returns empty (use the simple listing to browse everything).

If `q` is also supplied, it is applied first as the same free-text
match used by `GET /api/poems`, so advanced search can further narrow
an already filtered collection.

Populated fields: `title`, `body`, `project`, `notes`
(all case-insensitive substring); tag arrays
(OR within field, case-insensitive exact-entry equality); `year`,
`month` (integer equality on `date`); rating band (`min_rating` +
`max_rating` together = one populated field); `medals`.

`medals` values: `Gold`, `Silver`, `Bronze`, `Honorable Mention`,
`None`. `None` matches poems whose `awards` array is empty; selecting
multiple medals is OR (e.g. `medals=Gold&medals=None`). Unknown medals
→ 422.

Both endpoints return the same `PoemList` wrapper (full `Poem` objects)
and apply the same ordering and pagination.

## The similarity system

The similarity system runs entirely in memory — nothing is persisted and
the `Poem` schema is not modified. It is built from `repo.list()` at
startup and rebuilt in full after every mutation (POST, PATCH, DELETE).

### Architecture

```
repo.list()
    │
    ▼
normalise.py  ──  Poem → NormalisedPoemFeatures
    │              (lowercase, dedup, synonym expansion)
    ├── structured.py  ──  Jaccard over tag sets (themes, emotion,
    │                       form, imagery, fit)  → StructuredScoreBreakdown
    └── semantic.py    ──  TF-IDF cosine on separate text fields
                            (project, form_text, image_text)  → SemanticScoreBreakdown
                │
                ▼
            fusion.py  ──  weighted blend → FusedScoreBreakdown
                │
                ▼
            service.py ──  PoemSimilarityService.get_*_similar()
                            → NeighbourListResult
```

### Scoring

Similarity is **multi-axis**. Each axis has a named score in [0, 1]:

| Axis       | Structured input    | Semantic input  | Structured weight | Semantic weight |
| ---------- | ------------------- | --------------- | ----------------- | --------------- |
| theme      | `themes` Jaccard    | —               | 1.0               | 0.0             |
| form       | `form_and_craft` J. | `form_text`     | 0.8               | 0.2             |
| emotion    | `emotional_register`| —               | 1.0               | 0.0             |
| imagery    | `key_images` J.     | `image_text`    | 0.8               | 0.2             |

The **overall score** is a weighted average across all axes plus `fit`
(structured only) and `project` (semantic only):

| Component   | Weight |
| ----------- | ------ |
| theme       | 0.30   |
| form        | 0.20   |
| emotion     | 0.15   |
| imagery     | 0.15   |
| fit         | 0.10   |
| project     | 0.10   |

Structured metadata dominates; TF-IDF fills in where tag overlap is
thin. Fields excluded from scoring: `rating`, `lines`, `words`, `date`.
No generative model is used.

### Normalisation and synonyms

Before scoring, each `Poem` is converted to `NormalisedPoemFeatures`:
tag lists are lowercased, whitespace-stripped, deduplicated, and
(optionally) expanded through a one-to-one / one-to-many synonym table
in `server/similarity/normalise.py`. The table is empty by default;
add entries as the vocabulary grows.

`form_text` and `image_text` are the sorted, space-joined
`form_and_craft` and `key_images` sets respectively, used as TF-IDF
inputs. `project_text` is the lowercased project statement.

### Determinism

Results are ordered **score descending, `id` ascending** as a tiebreaker —
identical inputs always produce identical output across restarts.

### API endpoints

All similarity endpoints return `404` for an unknown `id`, `422` for a
malformed `id` or an out-of-range `k`. They work in read-only mode. The
query poem is always excluded from its own results.

| Method | Path | `k` params | Returns | Description |
| ------ | ---- | ---------- | ------- | ----------- |
| GET | `/api/poems/{id}/similar` | `k_overall=5`, `k_theme=3`, `k_form=3`, `k_emotion=3`, `k_imagery=3` | `SimilarityBundle` | All 5 axes in one response |
| GET | `/api/poems/{id}/similar/overall` | `k=5` | `NeighbourListResult` | Overall weighted score |
| GET | `/api/poems/{id}/similar/theme` | `k=5` | `NeighbourListResult` | Theme axis only |
| GET | `/api/poems/{id}/similar/form` | `k=5` | `NeighbourListResult` | Form axis only |
| GET | `/api/poems/{id}/similar/emotion` | `k=5` | `NeighbourListResult` | Emotion axis only |
| GET | `/api/poems/{id}/similar/imagery` | `k=5` | `NeighbourListResult` | Imagery axis only |

Each per-category `k` in `/similar` is independently bounded `1 ≤ k ≤ 50`.
The single-axis endpoints share a single `k` (`1 ≤ k ≤ 50`, default 5).

### Response shape

`NeighbourListResult` (returned by the single-axis endpoints and `/similar/overall`):

```jsonc
{
  "query_id": "<uuid>",
  "neighbours": [
    {
      "id": "<uuid>",
      "title": "...",
      "project": "...",
      "score": 0.72,
      "breakdown": {
        "overall_score": 0.72,
        "theme_score": 0.80,
        "form_score": 0.65,
        "emotion_score": 0.50,
        "imagery_score": 0.60,
        "structured": { "theme_sim": 0.80, "theme_overlap": ["nature"], ... },
        "semantic":   { "project_tfidf_sim": 0.30, ... }
      }
    }
  ]
}
```

`SimilarityBundle` (returned by `/similar`):

```jsonc
{
  "overall":  { "query_id": "<uuid>", "neighbours": [ ... ] },
  "theme":    { "query_id": "<uuid>", "neighbours": [ ... ] },
  "form":     { "query_id": "<uuid>", "neighbours": [ ... ] },
  "emotion":  { "query_id": "<uuid>", "neighbours": [ ... ] },
  "imagery":  { "query_id": "<uuid>", "neighbours": [ ... ] }
}
```

Each value is a full `NeighbourListResult` with its own `k`.

### Frontend panels

Both the listing page and the single-poem page use a two-column layout
built from three shared components: `Page` (the grid wrapper),
`LColumn` (left: `max-w-prose`, centred on narrow viewports), and
`RColumn` (right aside: sticky, `20rem` wide, `106px` top padding in
grid mode). The `Header` component (title + optional "New poem" link)
sits at the top of the left column on every page.

**Single-poem page** (`/poems/[id]`): the aside shows all five similarity
axes via `SimilarPoems`. The page calls `GET /api/poems/{id}/similar`
(default per-category `k` values) and groups results under **Overall**,
**Theme**, **Form & Craft**, **Emotion**, and **Imagery** headings.
Empty axes are silently omitted. If the entire call fails, the aside is
omitted and the page renders normally. Each result shows only the poem
title as a link; scores and breakdowns are not exposed.

**Listing page** (`/`): the aside shows the 12 most recent poems via
`RecentPoems`, fetched server-side with `GET /api/poems/recent?k=12`.
Each item shows the title (link) and project statement.

Both asides use the shared `PoemSummary` component (title link + project
line) and the same card styling.

- **Wide viewport** (≥ `lg`): aside is sticky alongside the main column.
- **Narrow viewport**: aside appears below the main column, capped at
  `max-w-prose`.

## Recent poems endpoint

`GET /api/poems/recent?k=12`

Returns the `k` most recent poems ordered by `date` descending (most
recent first), with `id` ascending as a tiebreaker. No pin-first bias —
pinned status has no effect on this ordering.

| Parameter | Default | Constraints |
| --------- | ------- | ----------- |
| `k` | `12` | `1 ≤ k ≤ 100` |

Response: `RecentList` — a flat list of full `Poem` objects, ordered by
date descending. Returns `422` for an out-of-range `k`. Works in
read-only mode.

## Ordering and pagination

Authoritative ordering (same on both list endpoints):

1. **Pinned first** — `pinned=true` before `pinned=false`.
2. **Within each group, `date` descending** (most recent first).
3. **Tiebreaker:** `id` ascending (UUID string compare). Deterministic
   and stable, so identical inputs always produce identical order.

Search filters the set; it never re-ranks. There is no relevance
scoring.

Pagination contract: `offset ≥ 0`, `1 ≤ limit ≤ 200`. Server default
`offset=0` / `limit=3`; the frontend requests `limit=5` per page.
The listing uses infinite scroll — an `IntersectionObserver` sentinel
below the list triggers the next window automatically as the user
scrolls. Response metadata: `{ total, offset, limit, has_more }`.
Ordering is applied before pagination; sequential windows never skip
or duplicate.

Invalid dates cannot enter the store — they fail validation at load
and mutation — so the `date` sort key is always a real timezone-aware
datetime, no fallback needed.

## Pinning, editing, and hard deletion

- **Pinning** — `PATCH /api/poems/{id}` with `{"pinned": true|false}`.
  The frontend `PinToggle` flips local state **only after** the
  server confirms with `200`. Pin toggles move the poem across the
  pin boundary; the listing refetches from `offset=0` so the
  authoritative order stays in lock-step with the server.
- **Editing** — a single canonical editable field set is declared in
  `app/lib/editable.ts` and used by both the list-row editor
  (`PoemEditorForm` in compact density) and the detail page
  (comfortable density). Fields editable inline in both contexts:
  `title`, `project`, `body`, `rating`, `pinned`, `date`, `url`,
  `themes`, `emotional_register`, `form_and_craft`, `key_images`,
  `contest_fit`, `socials`, `notes`. PATCH sends only the diff; local
  state is replaced from the server response; failure keeps edit
  mode open with an inline error.
- **Creation** — dedicated page at `/poems/new`. Required inputs:
  `title`, `url`, `project`, `body`, `rating`. Everything else is
  optional; omitted optionals receive documented defaults server-side
  (`pinned=false`, tag arrays `[]`, `date=now UTC`, etc.). The
  server owns identity: UUID v4 is generated on the server and
  client-supplied `id` / `lines` / `words` are rejected. Double-submit
  is prevented via a disabled submit button + in-flight ref.
- **Hard deletion** — `DELETE /api/poems/{id}` is a confirmed
  destructive action. Both the list row and the detail page require
  a two-step confirmation (arm, then confirm within 4 s). Success
  returns `204`; the listing refetches from the top.
- **Unsaved-edit safety** — while an editor is dirty, a `beforeunload`
  listener triggers the browser's native leave prompt. In-app, a
  _"Discard unsaved changes?"_ confirm fires when the user attempts
  to open another row's editor, delete the poem, or navigate away
  from the create form. Refetches (from search changes or Load More)
  keep the editing row visible by splicing it back onto the front if
  it would otherwise fall outside the window.

## Tests

```bash
make test           # READ_ONLY=false uv run pytest tests/server
make test-verbose   # same, with -vv output
make typecheck      # npx tsc --noEmit
make lint           # npx next lint
make check          # test + typecheck + lint
```

Or manually:

```bash
READ_ONLY=false uv run pytest tests/server   # ~187 tests, ~8 s
npx tsc --noEmit                             # TypeScript type-check
npx next build                               # production build
```

`READ_ONLY=false` is required because several test fixtures exercise
mutation endpoints that return `405` when `READ_ONLY=true`.

Test files:

- `tests/server/test_repository.py` — configuration resolution; load/validate;
  duplicate-id and invalid-UUID rejection; immutability; atomic
  persistence; alternate-file configurability.
- `tests/server/test_read_api.py` — `/health`; full-poem list shape; pagination; search;
  pinned-first ordering; 422 malformed id; 404 unknown id; `/api/poems/recent`
  (200 shape, default k, k limits, date-desc ordering, no pin bias, 422 for
  out-of-range k, route not intercepted by `/{poem_id}`).
- `tests/server/test_mutations.py` — PATCH partial semantics; derived recompute;
  unknown-field/id rejection; DELETE; **persistence-failure
  atomicity** (injected `OSError` keeps memory and disk consistent).
- `tests/server/test_search.py` — OR across populated fields; within-field OR on
  tags; year/month; Gold / None / multiple medals; pinned-first
  preserved; pagination applies to search.
- `tests/server/test_ordering.py` — date-desc default; pinned-first with internal
  date-desc; id-ascending tiebreaker; sequential pages neither skip
  nor duplicate; pin / date / delete mutations reorder correctly.
- `tests/server/test_create.py` — valid creation; server-generated UUID v4;
  defaults for omitted optionals; rejection of client-supplied
  `id`/`lines`/`words`; required-field-missing rejection; ordering
  visibility after create; failed-persistence atomicity; body
  round-trip.
- `tests/server/test_similarity.py` — tests across the full similarity
  stack: normalisation (case-fold, dedup, synonyms), Jaccard edge
  cases, TF-IDF index (unfitted zeros, rebuild, empty corpus),
  fusion arithmetic (weight sum, axis blending, no semantic bleed),
  service (self-exclusion, k limits, score-desc + id-asc ordering,
  module globals), all API endpoints including `/similar` bundle shape
  (200/404/422, per-category k bounds, `SimilarityBundle` response,
  excluded Poem fields, read-only mode, ranking), all five single-axis
  endpoints, and mutation → rebuild integration (POST/PATCH/DELETE each
  reflected in subsequent similarity queries).

## Limitations and assumptions

- **Single-writer process.** The repository is thread-safe inside
  one process via `threading.RLock`, but has no cross-process file
  lock. Deploy with a single Uvicorn worker, or add an external
  lock (flock, a tiny lock-server, etc.) before scaling out.
- **No authentication.** The API is unauthenticated. Editing and
  deletion are open to anyone who can reach the service. Safe only
  on trusted networks or behind an external auth layer.
- **Last-write-wins.** No optimistic concurrency (`ETag` /
  `If-Match`) — two near-simultaneous PATCHes overwrite each other
  in arrival order. Acceptable for a single-author workflow.
- **External edits are safe but not instant.** Changes to `Poems.json`
  made by another process are picked up on the next GET request via an
  `os.stat()` mtime check. There is a small window between an external
  write completing and the next GET where in-flight requests see stale
  data.
- **No schema versioning field.** Additive changes work; breaking
  changes will need a `schema_version` and a one-shot migration.
- **No relevance ranking.** Search filters but does not rank; order
  is always authoritative (pinned → date-desc → id-asc).
- **`awards` has no inline UI yet.** It is an object array; the
  backend accepts PATCH, but the UI surfaces it as read-only only.
- **Browser-native modals** are used for discard/confirm prompts
  (`window.confirm`, `beforeunload`). Fine for a first draft; a
  styled in-page prompt would match the literary aesthetic better.
- **No end-to-end UI tests.** Frontend is validated via `tsc` and
  `next build`; interactive flows are exercised manually.
- **Similarity rebuilds on every mutation.** The full corpus is
  re-normalised and TF-IDF matrices are refitted after each POST,
  PATCH, or DELETE. Acceptable for a small collection; a larger one
  would benefit from incremental updates or a background rebuild queue.
- **Similarity synonyms are empty by default.** The synonym table in
  `server/similarity/normalise.py` is a stub. Tags that mean the same
  thing (`"grief"` / `"loss"`) will not be matched unless entries are
  added manually.

## Sensible next steps

1. **Object-array editor** for `awards` in both the create and edit
   surfaces.
2. **Optimistic concurrency** via `ETag` / `If-Match` headers so a
   stale-client PATCH fails with `409` instead of silently winning.
3. **Schema versioning** (`schema_version` on each record) plus a
   one-shot migration harness, preparing for the first breaking
   change.
4. **Styled in-page confirm dialogs** replacing `window.confirm` and
   `beforeunload`, keeping the aesthetic coherent with the rest of
   the site.
5. **Authentication + authorisation** (even a single shared-secret
   bearer) before exposing mutation endpoints beyond a trusted
   network.
6. **Search improvements**: stemming / diacritic folding, and a
   NOT modifier on the advanced endpoint for exclusion filters.
7. **End-to-end tests** (Playwright) covering the edit, pin, delete,
   and create flows against a disposable backend.
8. **Similarity synonym vocabulary** — populate `SYNONYMS` in
   `server/similarity/normalise.py` as the tag vocabulary grows to
   improve recall across near-synonymous terms.
9. **Incremental similarity rebuild** — for larger collections,
   replace the full-corpus rebuild on mutation with a targeted
   update that only re-scores poems whose tags changed.
10. **LLM-assisted Author's Notes** — integrate an LLM into the edit
    and new-poem forms to help draft and refine notes:
    - Generate multiple candidate notes and present them side-by-side;
      highlight diffs against the current note so the choice is obvious.
    - Expose tone sliders (e.g. concrete ↔ abstract, flat ↔ lyrical)
      that are passed directly into the prompt — dialling rather than
      regenerating blind.
    - One-click hybridise: feed two candidates back to the model with
      instructions to merge the best of each (e.g. "keep the concrete
      detail from A, the tone from B, shorter overall").
    - Save approved notes as voice fingerprints and use them as
      conditioning for future generations ("match the tone and restraint
      of this note"), converging on a consistent authorial voice over time.
