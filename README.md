# JoJo.Poetry

A small, curated collection of poems by JoJo, presented as a literary
publication rather than a web app. The site shows the poems, lets the
author pin, edit, create, and delete them, and offers both a simple
keyword search and a field-specific advanced search.

Complete end-to-end: data model, backend API, typography-first frontend,
Docker configuration, and a test suite.

## Architecture

Two services, one flat JSON data source:

```
┌─────────────────┐ HTTP/JSON ┌──────────────────────┐
│ Next.js 16 │ ───────────▶ │ FastAPI │
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
  component that owns search, sort, editing, and deletion. A
  dedicated `/poems/new` page handles creation; `/poems/[id]`
  renders the detail view with inline editing.
- **Data source** (`database/Poems.json`): a single flat JSON array
  of poem objects. It is the only persistent store; there is no
  database server.

## Repository layout

```
.
├── server/
│   ├── app.py                        # FastAPI factory, CORS, lifespan load + similarity init; load_dotenv() for OPENAI_API_KEY
│   ├── api.py                        # All routes (read, search, POST/PATCH/DELETE, similarity, cluster, features vocabulary)
│   ├── config.py                     # Settings (POEMS_DATABASE, READ_ONLY) + controlled-vocabulary constants (THEME_FEATURES, MOOD_FEATURES, POETIC_FORM_FEATURES, TECHNIQUE_FEATURES, TONE_VOICE_FEATURES)
│   ├── repository.py                 # In-memory, file-backed PoemRepository
│   ├── clustering/
│   │   ├── router.py                 # FastAPI router: POST /api/poems/cluster
│   │   ├── types.py                  # ClusterRequest / Cluster / ClusterResponse Pydantic models
│   │   └── engine.py                 # Feature matrix, auto-k, Ward clustering, lift labels
│   ├── similarity/
│   │   ├── types.py                  # NormalisedPoemFeatures, score breakdowns, NeighbourResult
│   │   ├── normalise.py              # Poem → NormalisedPoemFeatures (lowercase, dedup, synonyms)
│   │   ├── structured.py             # Jaccard similarity over tag sets; StructuredScoreBreakdown
│   │   ├── semantic.py               # SemanticSimilarityIndex: TF-IDF on project/form/image text
│   │   ├── fusion.py                 # Weighted blend of structured + semantic; axis weights
│   │   └── service.py                # PoemSimilarityService; module-level init/rebuild helpers
│   ├── instagram/
│   │   ├── router.py                 # FastAPI router: generate, update, regenerate, filters, fonts, image-serving endpoints; in-memory image store
│   │   ├── instagram.py              # OpenAI pipeline: excerpt + prompt selection (Responses API) → image generation (images API) → text overlay (Pillow); TESTING flag uses gpt-5-mini + test.png
│   │   ├── filters.py                # Pillow-based filter library: none, aden, clarendon, crema, gingham, juno, lark, ludwig, moon, perpetua, reyes, slumber
│   │   ├── parsing.py                # LLM JSON output extraction utilities
│   │   ├── prompts.py                # GENERATE_PROMPT and GENERATE_IMAGE string templates
│   │   └── fonts/                    # TTF font files served by /api/instagram/fonts
│   └── Dockerfile                    # Python 3.11-slim image
├── requirements.txt                  # Production Python deps
├── requirements-dev.txt              # Adds pytest, httpx, jsonschema
├── tests/server/                     # pytest suite
├── app/
│   ├── page.tsx                      # Landing: listing + search/sort + recent poems aside
│   ├── awards/page.tsx               # Awards server entry: fetches awarded poems and renders AwardsPageClient
│   ├── clusters/page.tsx             # Clustering server entry: fetches initial/recent data and renders ClustersPageClient
│   ├── poems/[id]/page.tsx           # Detail + inline editing + similar poems panel
│   ├── poems/new/page.tsx            # Dedicated create page
│   ├── layout.tsx, globals.css
│   ├── components/
│   │   ├── instagram/
│   │   │   ├── InstagramButton.tsx   # Icon button (Instagram icon) that mounts InstagramDialog
│   │   │   ├── InstagramDialog.tsx   # Native <dialog> owner: loads fonts + filters in parallel, runs generate on mount, owns all state (excerpt, prompt, placement, textStyle, filter, dirty flags)
│   │   │   ├── ImagePreview.tsx      # Displays the generated image; shows CSS spinner while loading
│   │   │   ├── ImagePromptInput.tsx  # Textarea for the image prompt; UPDATE button (enabled when dirtyPrompt && prompt not empty); CLEAR button (enabled when prompt not empty)
│   │   │   ├── ExcerptEditor.tsx     # Textarea for the poem excerpt; UPDATE button (enabled when dirtyExcerpt)
│   │   │   ├── FilterSelector.tsx    # Loads filter list from /api/instagram/filters; 2-col (sm) / 3-col (md+) button grid; title-cases filter names
│   │   │   ├── TextPlacementGrid.tsx # 3×3 button grid for 9 text placement positions; re-exports Placement type
│   │   │   ├── TextStyleControls.tsx # Colour picker (white/black/custom) + font dropdown (MRU optgroup / All Fonts optgroup) + font-size stepper
│   │   │   └── InstagramActions.tsx  # REGENERATE IMAGE and POST TO INSTAGRAM action buttons
│   │   ├── AppConfig.tsx             # React context provider for runtime config (readOnly)
│   │   ├── Page.tsx                  # Two-column flex wrapper (full-width, centred)
│   │   ├── LColumn.tsx               # Left column shell: fixed lg flex-basis (62%) + inner max-w-prose
│   │   ├── RColumn.tsx               # Right aside shell: hidden <lg, fixed lg flex-basis (38%), 106px top padding
│   │   ├── Header.tsx                # Site header; Home link uses /?reset to clear all search state; Clusters/Awards links; optional New poem link in RW mode
│   │   ├── AwardsPageClient.tsx      # Layout shell for the awards page (no client state; composes AwardsList + AwardedPoems)
│   │   ├── ClustersPageClient.tsx    # Client owner of cluster checkbox state, fetchClusters calls, and aside switching logic
│   │   ├── ClusteringUI.tsx          # Presentational clustered/list renderer (receives selected/loading/error/result props)
│   │   ├── TopClusteredPoems.tsx     # Aside panel: one top-ranked poem (first in server-sorted list) per cluster
│   │   ├── RecentPoems.tsx           # Recent poems aside: k most recent by date, rendered via PoemSummary (abridged)
│   │   ├── HorizontalRule.tsx        # Shared rule divider; margin prop (Tailwind spacing scale integer, default 5) applied via inline style
│   │   ├── AdvancedSearchDialog.tsx  # Native <dialog>-backed modal (title/body/project/notes/themes/year/month/medals); TextField local helper collapses identical text-input rows
│   │   ├── ThemeAutocomplete.tsx     # Autocomplete-with-chips theme selector backed by /api/features/themes; used in AdvancedSearchDialog
│   │   ├── CopyButton.tsx            # Copy-to-clipboard icon button; variant="outline"|"filled" selects icon set
│   │   ├── PinToggle.tsx             # Pin/unpin stored in localStorage; client-only, no server round-trip, visible in RO mode
│   │   ├── ErrorMessage.tsx
│   │   ├── awards/
│   │   │   ├── AwardEntry.tsx        # Two grid-rows per award: medal-label+date row, then medal-icon+poem-title+contest-title row
│   │   │   ├── AwardedPoems.tsx      # Aside list of awarded poems ranked by cumulative medal score (Gold=4 … HM=1)
│   │   │   ├── AwardsList.tsx        # Client: flattens poem×award pairs, sortable by date/medal/poem/contest; 3-col grid
│   │   │   └── AwardsSortBar.tsx     # Sort controls for AwardsList (date default, medal, poem title, contest title)
│   │   ├── cluster/
│   │   │   ├── ClusterCheckboxes.tsx # Category checkbox controls used by ClusteringUI
│   │   │   ├── ClusterHeader.tsx     # Cluster summary line (categories used, cluster/poem counts, excluded count)
│   │   │   ├── ClusterLabel.tsx      # Per-cluster heading and poem count
│   │   │   └── ClusterFeatures.tsx   # Per-cluster feature chips/labels
│   │   └── poem/
│   │       ├── PoemListing.tsx       # Client: fetch, search/sort controls, row edit/delete; useSearchParams drives theme navigation (same-page URL changes → chips → refetch); /?reset clears all state
│   │       ├── PoemList.tsx          # Shared list renderer (<ol> of PoemRow); accepts PoemSummaryData[], loadedPoems map
│   │       ├── PoemRow.tsx           # Single poem row: PoemSummary + PoemBody toggle + edit/delete buttons
│   │       ├── PoemSummary.tsx       # Shared list item: title + stats + project + features; showAwards prop adds medal tooltip row
│   │       ├── PoemContestTooltip.tsx# CSS-only group-hover tooltip on a medal icon: medal tier, contest title (linked), closed date
│   │       ├── PoemSearchBar.tsx     # q + submit + Advanced modal trigger
│   │       ├── PoemSortBar.tsx       # Client-side sort buttons (title/date/lines/words/rating/medals)
│   │       ├── PoemStatistics.tsx    # Shared metadata line (date · lines · words · medals · rating)
│   │       ├── PoemTitle.tsx         # Client title block: h2/h4 by context, optional link/pin toggle, id-driven copy buttons
│   │       ├── PoemProject.tsx       # Italic project statement, null-safe, optional two-line clamp
│   │       ├── PoemAuthor.tsx        # pen_name + (full_name) span
│   │       ├── PoemAwards.tsx        # List of awards; each row: medal icon · medal label · optional truncated award link
│   │       ├── PoemFeatures.tsx      # Sorted, deduplicated tag values joined by " · "; strings starting with /?  rendered as Next.js Links (enables theme navigation)
│   │       ├── PoemGroup.tsx         # Metadata group label span (eyebrow style)
│   │       ├── PoemNotes.tsx         # Unordered list of per-poem notes
│   │       ├── PoemSocial.tsx        # Social URL rendered as hostname link (non-Instagram)
│   │       ├── InstagramEmbed        # Dynamically imported (ssr: false) from react-social-media-embed; toggled via Show/Hide socials; width and captioned toggles
│   │       ├── PoemEditor.tsx        # Inline editor; receives full Poem loaded on demand
│   │       ├── PoemDetail.tsx        # Reading view + Edit toggle
│   │       ├── PoemCreateForm.tsx    # Dedicated POST form with defaults + guards
│   │       ├── FeaturesEditor.tsx    # Multi-select for controlled-vocabulary groups (themes/moods/poetic_forms/techniques/tones_voices); fetches options from /api/features/{group}
│   │       ├── PoemMetadataEditor.tsx# Shared rating/date/url grid; FeaturesEditor for the five controlled-vocab fields; FeatureInput for free-text fields (key_images, contest_fit, socials)
│   │       ├── SimilarPoems.tsx      # Similar poems aside: all 5 axes (overall/theme/form/emotion/imagery) grouped
│   │       └── PoemBody.tsx          # Toggle show/hide; showBody prop auto-fetches and expands on mount
│   └── lib/
│       ├── api.ts                    # Typed fetch wrappers for poems, similarity, clustering, features, and Instagram endpoints (instagramGenerate, instagramUpdate, instagramRegenerate, instagramFonts, instagramFilters)
│       ├── cluster.ts                # Cluster feature/group label helpers for cluster UI rendering
│       ├── types.ts                  # PoemSummaryData / ClusterPoem / Poem type hierarchy; Award / SearchState / SimilarityBundle / ClusterResponse / InstagramData / TextSpecification / FontOption / Placement / …
│       ├── editable.ts               # Canonical editable-field contract
│       └── format.ts                 # body ↔ plaintext, date formatting, cleanPoetryUrl, poemToMarkdown, medalColor
├── database/
│   ├── Poems.json                    # Canonical collection
│   ├── <Title>.json                  # Per-poem mirror files (reference only)
│   └── schemas/
│       ├── poem.schema.json          # JSON Schema (Draft 2020-12)
│       ├── poem.py                   # Pydantic PoemSummaryData / Poem / Award / Author
│       └── similarity.py             # Re-exports similarity response types for API use
├── Dockerfile                        # Combined multi-stage base image (Node 22 + Python 3.13, Debian bookworm-slim, no CMD)
├── Dockerfile.backend                # Backend-only image used by docker-compose
├── Dockerfile.frontend               # Frontend-only image used by docker-compose
├── Dockerfile-gcloud                 # Single-container Cloud Run image (FastAPI + Next.js, CMD with startup health poll)
└── docker-compose.yml                # Orchestrates backend + frontend (local/self-hosted)
```

## Poem data model

The authoritative schema is `database/schemas/poem.schema.json`;
`database/schemas/poem.py` is its Pydantic mirror.

| Field                                                                                   | Type                       | Required                     | Editable            | Searchable                    | Notes                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------- | ---------------------------- | ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                  | UUID v4 string             | yes                          | **immutable** | no                            | Sole identifier used everywhere.                                                                   |
| `title`                                                                               | string                     | yes                          | yes                 | yes                           |                                                                                                    |
| `url`                                                                                 | URI                        | yes                          | yes                 | no                            | Canonical external link.                                                                           |
| `body`                                                                                | string (plain text)        | yes                          | yes                 | yes                            | Stored and edited as plain text; newline and indentation are preserved on render. |
| `awards`                                                                              | `[{url, medal, title, closed}]` | yes (may be empty)           | yes (API)           | via `medals` filter         | `medal` is surfaced to search; `title` is the contest name; `closed` is an ISO 8601 datetime string recording when the contest closed.          |
| `date`                                                                                | ISO 8601 datetime          | yes                          | yes                 | year/month in advanced search | Timezone-aware; UTC in existing data.                                                              |
| `themes`, `moods`, `poetic_forms`, `techniques`, `tones_voices`, `key_images`, `contest_fit` | `string[]`               | yes (may be empty)           | yes                 | yes                           | Free-vocabulary tags. `moods`: tonal/affective; `poetic_forms`: metrical/structural forms; `techniques`: devices and techniques; `tones_voices`: voice/stance. |
| `project`                                                                             | string                     | yes                          | yes                 | yes                           | One-sentence authorial statement.                                                                  |
| `rating`                                                                              | int 0–100                 | yes                          | yes                 | min/max band                  | Authorial self-rating.                                                                             |
| `lines`, `words`                                                                    | int ≥ 0                   | yes                          | **derived**   | no                            | Recomputed from `body` on every write.                                                           |
| `socials`                                                                             | `string[]`               | optional (default `[]`)    | yes                 | no                            | Social media URLs. All entries rendered as hostname links; Instagram URLs additionally rendered as embedded posts via `react-social-media-embed` (toggled, width-adjustable, caption-toggleable). |
| `notes`                                                                               | `string[]`               | optional (default `[]`)    | yes                 | yes                           | One string per note; edited via multi-line textbox (one line = one note).                          |
| `author`                                                                              | `{pen_name, full_name}`  | optional (default `null`)  | yes (API)           | no                            | Author identity. Displayed on the detail page; no inline editor (structured object).               |

Strictness: `extra="forbid"` on the Pydantic model and
`additionalProperties: false` on the JSON Schema. Unknown fields are
rejected on every read and every write.

### The `body` field — text fidelity

- **Stored verbatim** as plain text; no HTML is required.
- **Displayed** by a safe inline renderer in `PoemBody.tsx` that supports
  `*italic*`, `**bold**`, and `[text](url)` links while preserving authored
  line breaks via `white-space: pre-wrap`.
- **Legacy compatibility:** historical `<br>` tags are normalised to `\n`
  during render so older content still displays correctly.
- **Search and derived metrics** (`lines`, `words`) operate on plain text.

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
- **`poem.py`** — Pydantic models (`PoemSummaryData`, `Poem`, `Award`, `Author`).
  `PoemSummaryData` is the base class containing the fields returned by the list
  endpoints (`id`, `title`, `project`, `rating`, `lines`, `words`, `date`,
  `awards`, `themes`). `Poem` extends it with the full field set. Used at runtime
  for load-time validation, PATCH-merge validation, and response shaping. Applies
  the documented defaults (`socials=[]`, `notes=[]`, `author=null`)
  when optional fields are absent.

## Configuration

### Backend

| Variable           | Default                                         | Purpose                                                                                                                            |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POEMS_DATABASE` | `<repo>/database/Poems.json`                  | Path to the poems JSON file. Absolute paths used verbatim; relative paths resolved against the**current working directory**. |
| `CORS_ORIGINS`   | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed origins for browser calls.                                                                         |
| `READ_ONLY`      | `true`                                        | When `true`, all mutation endpoints (POST/PATCH/DELETE) return `405 Method Not Allowed`.                                       |
| `OPENAI_API_KEY` | —                                             | Required for Instagram image generation. Loaded from `.env` via `python-dotenv` at startup. Instagram endpoints return errors if absent. |

A `.env` file in the current working directory is auto-loaded (via
`pydantic-settings`). Settings are exposed through `server.config.Settings`, stored on
`app.state.settings` at startup, and read from there by all request
handlers — including `require_write_access`. Tests pass overrides
directly to `create_app`.

### Frontend

| Variable                     | Default | Purpose                                                                                                                              |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | `""` (empty — same-origin relative paths) | Origin prefix the browser prepends to every `/api/…` path. Inlined at build time. Empty string is correct for Cloud Run (Next.js rewrites `/api/:path*` to the internal FastAPI). Set to `http://localhost:8000` only if running the frontend against a separately-exposed backend. |
| `READ_ONLY`                | `true`  | When `true`, hides all editing controls (pin, edit, delete, new poem). Read at server-component render time; not inlined at build. |

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

## Google Cloud Run

`Dockerfile-gcloud` is a self-contained single-container image: Next.js standalone server on `$PORT` (8080) and FastAPI on `127.0.0.1:8000`, both in the same container. Only port 8080 is exposed. Browser requests to `/api/…` are proxied by Next.js rewrites to the internal FastAPI — the browser never reaches port 8000 directly.

**Production data:** `database/Poems-JoJo.json` (gitignored) is copied over `database/Poems.json` during the Docker build. Refresh it before deploying:

```bash
cp /path/to/production/Poems.json database/Poems-JoJo.json
```

**First-time setup** (creates the Artifact Registry repo, enables Cloud Run/build APIs):

```bash
make gcloud-login    # browser auth + configure Docker credential helper
make gcloud-deploy   # enable services, create repo, build, push, deploy
```

**Routine updates:**

```bash
make gcloud-update   # --no-cache build, verify Python/sklearn, push (timestamped + latest tags), deploy
```

**Logs and traffic:**

```bash
make gcloud-logs     # traffic table + last 100 log lines (10-minute window)
```

The deployed service runs `READ_ONLY=true`. The startup CMD polls `/api/author` before handing off to Next.js, so the first Cloud Run health check never races a cold FastAPI start.

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

One button is always active (Date descending by default). Clicking the active button toggles direction; clicking an inactive button selects it at its default direction. The sort is re-applied automatically whenever the search state changes and a fresh set of items is fetched.

## CSS typography system

All typographic styles are defined in `app/globals.css` under `@layer components` as a flat `text-*` namespace. Layout is always inline Tailwind; `globals.css` is for typography only.

| Class | Role | Key properties |
| ----- | ---- | -------------- |
| `text-display` | Site-level h1 | `font-display`, `text-3xl`, `leading-none`, `tracking-tight` |
| `text-title` | Poem/section titles | `font-display`, `leading-snug`, `tracking-tight` |
| `text-title-lg` / `text-title-sm` | Size modifiers, applied alongside `text-title` | `text-xl` / `text-base` |
| `text-title-link` | Link variant of a title | `text-ink`, `no-underline`, `hover:text-accent` |
| `text-label` | Small all-caps sans label | `font-sans`, `0.76 rem`, `uppercase`, `tracking-wider2`, `text-muted` |
| `text-meta` | Small sans secondary text | `font-sans`, `0.78 rem`, `text-ink/80` |
| `text-entry` | Slightly larger sans for data rows | `font-sans`, `0.9 rem`, `text-ink/80` |
| `text-project` | Italic serif project statement | `font-serif`, `italic`, `leading-normal`, `text-ink/90` |
| `text-cluster-heading` | Cluster section headings | `font-serif`, `semibold`, `uppercase`, `leading-tight` |
| `text-body` | Poem body prose | `font-serif`, `text-lg`, `leading-tight` |
| `text-body-poem` | Rendering layer on top of `text-body` | `whitespace-pre-wrap`, no hyphens, oldstyle numerals; link styles |

Button classes (`button-primary`, `button-sort`, `button-text*`) are also in `globals.css` but carry layout (border, padding, transition) in addition to typography. They are kept as a distinct group pending a separate refactor.

## The search system

Two endpoints, intentionally distinct.

### Simple keyword search — `GET /api/poems?q=…`

Case-insensitive substring match over a curated set of fields: `title`,
body plain-text projection, `project`, all tag arrays, and the `notes`
array. Excluded: URLs, `id`, numeric and boolean fields. `q` combines conjunctively with the same
endpoint's tag and numeric filters (`themes=…`, `min_rating=…`, etc.).

### Advanced field search — `GET /api/poems/search`

Field-specific matching. If `q` is supplied it is applied first as the
same free-text pre-filter used by `GET /api/poems`. The remaining
filters combine as follows:

- **`themes`** — AND pre-filter: every supplied theme must be present on
  the poem. Applied before OR matching. If themes are the only populated
  field, all theme-matching poems are returned directly.
- **`title`, `body`, `project`, `notes`** — OR across fields;
  case-insensitive substring.
- **Other tag fields** (`moods`, `poetic_forms`, `techniques`,
  `tones_voices`, `key_images`, `contest_fit`) — OR across fields;
  case-insensitive exact-entry equality.
- **`year` + `month`** — AND with each other (both must match when both
  are supplied); count together as one OR condition against other fields.
- **Rating band** (`min_rating` + `max_rating`) — AND with each other;
  one OR condition against other fields.
- **`medals`** — OR within field. `None` matches poems with an empty
  `awards` array.

If no fields other than `themes` are populated, OR matching is skipped.
An entirely empty query (no fields, no `q`) returns empty — use
`GET /api/poems` to browse everything.

`medals` values: `Gold`, `Silver`, `Bronze`, `Honorable Mention`,
`None`. Unknown medals → 422.

Both endpoints return the same `PoemSummaryDataList` wrapper (`{ items: PoemSummaryData[] }`)
and apply the same ordering. Items contain summary fields only (`id`, `title`, `project`,
`rating`, `lines`, `words`, `date`, `awards`, `themes`) — not `body`, other tags, or notes.
Use `GET /api/poems/{id}` to retrieve a full `Poem` record.

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
| form       | `poetic_forms` + `techniques` + `tones_voices` J. | `form_text` | 0.8 | 0.2 |
| emotion    | `moods` J. | —          | 1.0               | 0.0             |
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
union of `poetic_forms`, `techniques`, `tones_voices` and `key_images` sets respectively, used as TF-IDF
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

All pages use the same two-column layout shell: `Page` (full-width flex
wrapper), `LColumn` (content shell with an `lg` fixed basis of 62% and an
inner `max-w-prose` measure), and `RColumn` (hidden below `lg`; fixed 38%
basis with `106px` top padding at `lg+`). `Header` (title + "Clusters" +
"Awards" links + optional "New poem" link in RW mode) sits at the top of
the left column on every page.

**Listing page** (`/`): left column has the full poem listing with search
and sort. The entire matching set is fetched in one request —
`GET /api/poems` (or `/api/poems/search` for advanced queries) — and
re-sorted client-side without additional round-trips. Each row shows the
summary metadata; poem body loads lazily when the user expands it. The
aside shows the 12 most recent poems via `RecentPoems`, fetched
server-side with `GET /api/poems/recent?k=12`.

**Awards page** (`/awards`): `awards/page.tsx` fetches `GET /api/poems/awards`
server-side and renders `AwardsPageClient`. The left column shows `AwardsList`
— a flat list of every (poem, award) pair sorted by closed date descending by
default, with `AwardsSortBar` controls to re-sort by medal tier, poem title, or
contest title. Each entry occupies two grid rows: medal label + date in the
first row; coloured medal icon + poem title (linked) + contest title (linked)
in the second. The right column shows `AwardedPoems`, a ranked list of
awarded poems ordered by cumulative medal score (Gold=4, Silver=3, Bronze=2,
Honorable Mention=1). The shared `PoemSummary` component accepts a
`showAwards` prop that renders a horizontal row of `PoemContestTooltip` icons
below the feature line; each icon shows a CSS-only group-hover tooltip with
the medal tier, contest title (linked to the contest URL), and closed date.

**Clustering page** (`/clusters`): `clusters/page.tsx` fetches the full
poem listing and recent poems server-side (both as `PoemSummaryDataList`),
then renders `ClustersPageClient`. `ClustersPageClient` owns
`ClusterCheckboxes` toggles, clustered response state, loading/error state,
and `fetchClusters` calls. With no categories selected, it shows the initial
poem listing (summary rows in date-desc order; no search/sort controls). Selecting one or more categories triggers
`POST /api/poems/cluster` automatically and renders clusters as a vertical list
with labels, feature tags, and poem rows (title link, italic project statement,
then only tags from the selected checkbox groups joined inline). Excluded poems
appear below.

At `lg+`, the clustering aside is conditional:
- While showing the default list view (no cluster result), it shows
  `RecentPoems`.
- While showing clustered results, it shows `TopClusteredPoems`, listing each
  cluster label and its top-ranked poem (the first poem in that cluster's
  server-ordered list).

**Single-poem page** (`/poems/[id]`): the aside shows all five similarity
axes via `SimilarPoems`. The page calls `GET /api/poems/{id}/similar`
(default per-category `k` values) and groups results under **Overall**,
**Theme**, **Form & Craft**, **Emotion**, and **Imagery** headings.
Empty axes are silently omitted. If the entire call fails, the aside is
omitted and the page renders normally. Each result is rendered with the
shared summary view (title + abridged stats/project). Scores and
breakdowns are not exposed in the UI.

All listing and aside contexts use the shared `PoemSummary` component
(title link + optional two-line-clamped project line).

- **Wide viewport** (≥ `lg`): aside is shown in the right column and scrolls
  with the page.
- **Narrow viewport**: aside is hidden.

## The clustering system

`POST /api/poems/cluster` partitions the full corpus into groups based on
shared metadata tags. The endpoint is read-safe (available in
`READ_ONLY=true`) and purely in-memory — nothing is persisted.

### Request

```jsonc
{
  "categories": ["themes", "poetic_forms"],  // required; 1+ from the list below
  "k": 4,            // optional; omit for auto-k selection
  "min_cluster_size": 2   // optional; default 2
}
```

`categories` must be a non-empty subset of: `themes`, `moods`,
`poetic_forms`, `techniques`, `tones_voices`. Unknown values return `422`.

### Algorithm

1. **Feature matrix** — binary `(n_poems × n_features)` matrix. Each
   selected category contributes one column per distinct tag in that
   category across the corpus. Feature names are `"{category}:{tag}"`.
   The matrix is L2-normalised **per category block** row-wise so
   categories of different vocabulary size contribute equally.

2. **Auto-k** — when `k` is omitted, silhouette score is evaluated for
   `k ∈ range(2, min(n−1, max(3, n//3), 10) + 1)` using Ward linkage;
   the `k` with the highest score is used. For `n < 3` or an empty
   feature space, the corpus is returned as a single cluster.

3. **Clustering** — `AgglomerativeClustering(linkage="ward")` from
   scikit-learn. Deterministic — no random state.

4. **Feature ranking** — lift = `cluster_freq / (global_freq + ε)`.
  The top 3 features by lift are returned per cluster
  (features with zero presence in the cluster are omitted).

5. **Cluster label** — up to 3 features with frequency ≥ 0.5 in the
   cluster, ranked by lift, joined with ` / `. Falls back to the
   top-lift feature if none meets the 0.5 threshold.

6. **Exclusion** — poems in clusters with fewer than `min_cluster_size`
   members are moved to `excluded` with `reason: "cluster too small"`.

### Ordering

- Clusters: size descending, label ascending.
- Poems within a cluster: rating descending, date descending, id ascending.
- Excluded poems: id ascending.

### Response

```jsonc
{
  "clusters": [
    {
      "label": "nature / sonnet",
      "size": 12,
      "features": ["themes:nature", "poetic_forms:sonnet", "themes:loss"],
      "poems": [
        {
          "id": "<uuid>",
          "title": "...",
          "project": "A poem about loss in the natural world.",
          "themes": ["nature", "loss"],
          "moods": ["elegiac"],
          "poetic_forms": ["sonnet"],
          "techniques": ["enjambment"],
          "tones_voices": ["lyric"]
        }
      ]
    }
  ],
  "excluded": [
    {
      "id": "<uuid>",
      "title": "...",
      "project": "...",
      "rating": 42,
      "lines": 18,
      "words": 122,
      "date": "2024-02-01T00:00:00Z",
      "awards": [],
      "reason": "cluster too small"
    }
  ],
      "rating": 87,
      "lines": 32,
      "words": 214,
      "date": "2024-06-20T00:00:00Z",
      "awards": [
        { "url": "https://example.com/contest", "medal": "Silver" }
      ],
  "k_used": 3,
  "categories_used": ["themes", "poetic_forms"]
}
```

## Recent poems endpoint

`GET /api/poems/recent?k=12`

Returns the `k` most recent poems ordered by `date` descending (most
recent first), with `id` ascending as a tiebreaker. No pin-first bias —
pinned status has no effect on this ordering.

| Parameter | Default | Constraints |
| --------- | ------- | ----------- |
| `k` | `12` | `1 ≤ k ≤ 100` |

Response: `PoemSummaryDataList` — `{ items: PoemSummaryData[] }` ordered by
date descending. Items are summary records (no `body`, tags, or notes).
Returns `422` for an out-of-range `k`. Works in read-only mode.

## Awards endpoint

`GET /api/poems/awards`

Returns all poems that have at least one award, in authoritative order
(date-desc, id-asc). Each item is a `PoemSummaryData`
record including the full `awards` array with `url`, `medal`, `title`,
and `closed` fields. Works in read-only mode.

Response: `PoemSummaryDataList` — `{ items: PoemSummaryData[] }`.

## Features vocabulary endpoint

`GET /api/features/{group}`

Returns the controlled vocabulary for a tag group as `string[]`. Used
by `FeaturesEditor` to populate its multi-select options.

| `group` | Config constant | Field on `Poem` |
| ------- | --------------- | --------------- |
| `themes` | `THEME_FEATURES` | `themes` |
| `moods` | `MOOD_FEATURES` | `moods` |
| `poetic_forms` | `POETIC_FORM_FEATURES` | `poetic_forms` |
| `techniques` | `TECHNIQUE_FEATURES` | `techniques` |
| `tones_voices` | `TONE_VOICE_FEATURES` | `tones_voices` |

Unknown groups return `404` with a detail message listing the valid names.
Group names are case-sensitive. Works in read-only mode.

The vocabularies are defined in `server/config.py`. `THEME_FEATURES` is
derived automatically (sorted, deduplicated) from the `THEMES` group-map;
the others are explicit ordered lists.

## Ordering

Authoritative ordering (applied by both list endpoints before returning):

1. **`date` descending** (most recent first).
2. **Tiebreaker:** `id` ascending (UUID string compare). Deterministic
   and stable, so identical inputs always produce identical order.

Pinned-first ordering is applied client-side only (see Client-side sorting).

Search filters the set; it never re-ranks. There is no relevance scoring.

Both `GET /api/poems` and `GET /api/poems/search` return the full
filtered set in a single response — no pagination. The frontend applies
a client-side sort layer on top (see Client-side sorting), which
re-orders the already-fetched set without a network round-trip.

Invalid dates cannot enter the store — they fail validation at load
and mutation — so the `date` sort key is always a real timezone-aware
datetime, no fallback needed.

## Pinning, editing, and hard deletion

- **Pinning** — stored in `localStorage` under the key `jojo:pins` as a
  JSON array of UUID strings. `PinToggle` reads and writes localStorage
  directly; no server round-trip, no API call. Pins are per-browser and
  visible in read-only mode. The `fetchPoems` call merges pin state from
  localStorage into the `PoemSummaryData.pinned` field after the API
  response arrives. Pinned-first ordering is enforced by the client-side
  sort layer.
- **Editing** — list items are `PoemSummaryData`; the full `Poem` is
  fetched on demand when the editor is opened (cached in `loadedPoems`
  so subsequent edits don't refetch). A single canonical editable field
  set is declared in `app/lib/editable.ts` and used by both the
  list-row editor (`PoemEditorForm` in compact density) and the detail
  page (comfortable density). Fields editable inline in both contexts:
  `title`, `project`, `body`, `rating`, `date`, `url`,
  `themes`, `moods`,
  `poetic_forms`, `techniques`, `tones_voices`, `key_images`,
  `contest_fit`, `socials`, `notes`. PATCH sends only the diff; local
  state is replaced from the server response; failure keeps edit
  mode open with an inline error.
- **Creation** — dedicated page at `/poems/new`. Required inputs:
  `title`, `url`, `project`, `body`, `rating`. Everything else is
  optional; omitted optionals receive documented defaults server-side
  (tag arrays `[]`, `date=now UTC`, etc.). The
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
  from the create form.

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
READ_ONLY=false uv run pytest tests/server   # server test suite
npx tsc --noEmit                             # TypeScript type-check
npx next build                               # production build
```

`READ_ONLY=false` is required because several test fixtures exercise
mutation endpoints that return `405` when `READ_ONLY=true`.

Test files:

- `tests/server/test_repository.py` — configuration resolution; load/validate;
  duplicate-id and invalid-UUID rejection; immutability; atomic
  persistence; alternate-file configurability.
- `tests/server/test_read_api.py` — `/health`; list response shape (`{ items }` only,
  summary fields, no `body`); search; date-desc ordering; 422 malformed id;
  404 unknown id; `GET /api/poems/{id}` returns full poem including `body`;
  `/api/poems/recent` (200 shape, default k, k limits, date-desc ordering,
  date-desc ordering, 422 for out-of-range k, route not intercepted by `/{poem_id}`);
  `/api/poems/awards` (200 shape, all returned poems have at least one award,
  at least one result in the fixture).
- `tests/server/test_mutations.py` — PATCH partial semantics; derived recompute;
  unknown-field/id rejection; DELETE; **persistence-failure
  atomicity** (injected `OSError` keeps memory and disk consistent).
- `tests/server/test_search.py` — themes AND pre-filter; within-themes AND semantics;
  OR across other populated fields; year/month; Gold / None / multiple medals;
  empty advanced query returns empty; `q`-only on search endpoint returns empty.
- `tests/server/test_ordering.py` — date-desc default; id-ascending tiebreaker;
  filtered result is a correctly-ordered subsequence of the full listing;
  date / delete mutations reorder correctly.
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
- `tests/server/test_features_api.py` — `GET /api/features/{group}`: 200 for all five groups,
  `list[str]` shape, non-empty, exact match against config constants, themes sorted and
  deduplicated, no empty strings; 404 for unknown group with detail naming allowed groups;
  case-sensitivity (Themes/MOODS/Poetic_Forms all 404); trailing-slash behaviour.
- `tests/server/test_clustering.py` — engine unit tests (matrix shape,
  L2 normalisation, auto-k range, lift ranking, majority label, poem
  ordering) and API tests (200 response, response shape including new
  tag fields, partition invariant, cluster ordering, poem tag fields
  present, `min_cluster_size` exclusion, `k` override, `categories_used`
  echo, invalid category 422, empty categories 422, unknown field 422,
  read-only allowed, small-corpus single-cluster fallback).

## Instagram post generation

The Instagram feature creates a 1080×1080 PNG ready for posting, driven entirely from a poem. It is gated behind `require_write_access` (read-only deployments cannot use it). The pipeline runs in three stages:

1. **Text selection** — the poem title and body are sent to an OpenAI text model (Responses API) which returns a short excerpt and an image prompt as JSON.
2. **Image generation** — the prompt is sent to the images API to produce a square PNG. In `TESTING = True` mode (set in `server/instagram/instagram.py`), a static `test.png` is used instead and a smaller model handles text selection, avoiding API cost during development.
3. **Composition** — Pillow overlays the excerpt onto the image at the requested placement and colour, then applies the selected filter. The composed result is stored in memory and served via a dedicated image endpoint.

### API endpoints

All endpoints require write access.

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/instagram/generate` | Full pipeline: excerpt + prompt from LLM → image → text overlay → filter → stored; returns `InstagramData` with image URL |
| POST | `/api/instagram/update` | Re-overlays current excerpt + text spec + filter onto the stored raw image; no LLM call |
| POST | `/api/instagram/regenerate` | Regenerates the image using an updated prompt; full pipeline re-run |
| GET | `/api/instagram/filters` | Returns the list of available filter names as `string[]` |
| GET | `/api/instagram/fonts` | Returns available TTF fonts as `[{ filename, label }]`; scans `server/instagram/fonts/` |
| GET | `/api/instagram/image/{poem_id}` | Serves the raw generated PNG |
| GET | `/api/instagram/image/{poem_id}/{filter_name}` | Serves the composed (overlay + filter) PNG |

### Image store

Images are held in the module-level `_image_store` dict keyed by `str(poem_id)` (raw) and `"{poem_id}-{filter_name}"` (composed). The store is in-memory only — it is cleared on server restart and is not shared across workers. This is intentional for a single-author local workflow.

### Filters

Twelve Pillow-based filters in `server/instagram/filters.py`: `none`, `aden`, `clarendon`, `crema`, `gingham`, `juno`, `lark`, `ludwig`, `moon`, `perpetua`, `reyes`, `slumber`. Each is a pure function `apply_filter(image, filter_name) -> Image`. Filter names are served by the API so the frontend never hard-codes them.

### Text overlay

`overlay_text(image, text, font_stem, size, colour, location)` in `server/instagram/instagram.py` handles all nine placement positions (`top-left` through `bottom-right`). When `colour="auto"`, luminance is sampled from the text bounding-box region and black or white is chosen for contrast.

### Frontend dialog

`InstagramButton` (rendered on the poem detail page in RW mode) opens `InstagramDialog` — a native `<dialog>` modal. On mount it fetches fonts and filters in parallel, selects a default font (MRU-first), then calls `/api/instagram/generate`. While the API call is in flight the dialog dims all controls and shows a spinner in the image area.

The dialog tracks two independent dirty flags: `dirtyPrompt` (prompt textarea edited since last generate/regenerate) and `dirtyExcerpt` (excerpt textarea edited since last generate or update). Each has an inline UPDATE button that is enabled only when dirty. Any change to filter, text placement, font, or font size immediately calls `/api/instagram/update`. The REGENERATE IMAGE button resets placement and filter to defaults and re-runs the full pipeline.

Font selections are persisted across sessions via a 16-entry MRU list in `localStorage` (`instagram_mru_fonts`). The font dropdown groups recent fonts above the full alphabetical list.

### Next.js proxy timeout

The Next.js dev proxy default (30 s) is too short for OpenAI image generation. `next.config.mjs` sets `experimental.proxyTimeout: 120_000` to avoid ECONNRESET on slow calls.

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
- **No relevance ranking.** Search filters but does not rank; server order
  is always date-desc → id-asc. Pinned-first is client-side only.
- **`awards` has no inline editor.** The awards page and medal tooltips
  display `awards` read-only; the backend accepts PATCH, but there is no
  form UI for creating or modifying award records.
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

1. **Object-array editor** for `awards` in both the create and edit surfaces.
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
