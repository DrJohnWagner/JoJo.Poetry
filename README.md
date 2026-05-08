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
│ Next.js 16      │ ─────────▶│ FastAPI               │
│ React 19 / TS   │           │ Pydantic v2           │
│ Tailwind 3      │ ◀──────── │                       │
└─────────────────┘           └──────────┬────────────┘
                                         │ atomic fs write
                                         ▼
                              database/Poems.json (source of truth)
                              database/schemas/
                                poem.schema.json (JSON Schema)
```

- **Backend** (`server/`): FastAPI app that loads `Poems.json` into
  memory at startup, serves read/search endpoints, and persists
  mutations back to the JSON file atomically. All validation goes
  through the Pydantic `Poem` model defined in `server/types.py`.
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
│   ├── api.py                        # All routes (read, search, POST/PATCH/DELETE, features vocabulary, awards, recent)
│   ├── types.py                      # Core poem schema: Author, Award, PoemSummaryData, Poem; poem-endpoint API types: HealthResponse, PoemSummaryDataList, PoemCreate, PoemPatch
│   ├── config.py                     # Settings (POEMS_DATABASE, READ_ONLY) + controlled-vocabulary constants (THEME_FEATURES, MOOD_FEATURES, POETIC_FORM_FEATURES, TECHNIQUE_FEATURES, TONE_VOICE_FEATURES) + FEATURE_GROUPS dict
│   ├── repository.py                 # In-memory, file-backed PoemRepository
│   ├── clustering/
│   │   ├── router.py                 # FastAPI router: POST /api/poems/cluster
│   │   ├── types.py                  # ClusterRequest / Cluster / ClusterResponse Pydantic models + VALID_CATEGORIES / CATEGORY_FIELD_MAP constants
│   │   └── engine.py                 # Feature matrix, auto-k, Ward clustering, lift labels
│   ├── similarity/
│   │   ├── router.py                 # FastAPI router: GET /api/poems/{id}/similar and five single-axis endpoints
│   │   ├── types.py                  # NormalisedPoemFeatures, score breakdowns, NeighbourResult, NeighbourListResult, SimilarityBundle
│   │   ├── normalise.py              # Poem → NormalisedPoemFeatures (lowercase, dedup, synonyms)
│   │   ├── structured.py             # Jaccard similarity over tag sets; StructuredScoreBreakdown
│   │   ├── semantic.py               # SemanticSimilarityIndex: TF-IDF on project/form/image text
│   │   ├── fusion.py                 # Weighted blend of structured + semantic; axis weights
│   │   └── service.py                # PoemSimilarityService; module-level init/rebuild helpers
│   ├── fonts/
│   │   ├── router.py                 # FastAPI router: GET /api/fonts; font label parsing (CamelCase + underscore → human name)
│   │   └── <Family>/                 # TTF font files (Alegreya Sans, Cormorant, EB Garamond, IBM Plex Sans, Inter, Libre Baskerville, Playfair Display, Source Sans 3, Source Serif 4, Work Sans)
│   ├── pdf/
│   │   ├── router.py                 # FastAPI router: POST /api/pdf/{poem_id} → PDF bytes; POST /{poem_id}/post → PNG + multi-platform publish; body_to_stanzas splits on blank lines, inserts empty stanza for 3+ blank lines
│   │   ├── pipeline.py               # png_from_source (Typst → first-page PNG at 150 PPI) + pdf_caption
│   │   ├── types.py                  # PDFRequest (paper, margin, font, font_size, colour, columns, gutter, leading, spacing) + PDFPostResponse
│   │   └── poem.typ                  # Jinja2 + Typst template: paper, margin, font, font_size, colour, columns, gutter, title, author, stanzas
│   └── social/
│       ├── router.py                 # FastAPI router: /api/socials/* endpoints; in-memory image store
│       ├── types.py                  # Social API Pydantic models: GenerateRequest/Response, UpdateRequest, ImageResponse, RegenerateRequest, PostRequest/Response, TextSpecification
│       ├── pipeline.py               # OpenAI pipeline: excerpt + image prompt via text model → image generation → text overlay (Pillow); instagram_caption, threads_caption, bsky_caption with platform truncation
│       ├── costs.py                  # Pricing table (gpt-5, gpt-image-1/1.5) + usage extraction + cost_estimate + add_estimates
│       ├── filters.py                # Pillow-based filter library: none, aden, clarendon, crema, gingham, juno, lark, ludwig, moon, perpetua, reyes, slumber
│       ├── cloud.py                  # Cloudinary upload/delete helpers; returns public image URL
│       ├── posting.py                # post_to_instagram (Graph API) + post_to_threads (Threads API); returns post URLs
│       ├── bsky.py                   # post_to_bsky (AT Protocol / Bluesky); returns post URL
│       ├── parsing.py                # LLM JSON output extraction utilities
│       └── prompts.py                # GENERATE_PROMPT and GENERATE_IMAGE string templates
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
│   │   ├── pdf/
│   │   │   ├── PDFDialog.tsx             # Native <dialog>: fetches and renders PDF via react-pdf (pdfjs); loading overlay with spinner; worker configured via import.meta.url (no CDN)
│   │   │   ├── PDFControls.tsx           # PDF layout controls: paper, margin, font, size, colour, columns, gutter, leading, spacing
│   │   │   └── PDFActions.tsx            # Download (Downloaded flash), Save (File System Access API), Copy (first page → PNG → clipboard), Publish; all with idle/loading/done state feedback
│   │   ├── social/
│   │   │   ├── SocialPostDialog.tsx      # Native <dialog>: loads fonts + filters, runs generate on mount, owns all state (excerpt, prompt, placement, textStyle, filter, dirty flags, loading message); single loading overlay on content div
│   │   │   ├── SocialPostActions.tsx     # Regenerate, Copy (3-state), Publish action buttons; Publish enabled only when no dirty flags
│   │   │   ├── UpdateRevertEditor.tsx    # Shared textarea with UPDATE/REVERT buttons; wordWrap prop (default true; false disables wrapping); used for excerpt (wordWrap=false), prompt, and alt text tabs
│   │   │   ├── ImagePreview.tsx          # Generated image preview; shows "No image yet" when src absent
│   │   │   ├── ImagePromptInput.tsx      # Prompt textarea; UPDATE (dirty) + REVERT (dirty) buttons
│   │   │   ├── ExcerptEditor.tsx         # Excerpt textarea; UPDATE (dirty) + REVERT (dirty) buttons
│   │   │   ├── FilterSelector.tsx        # Filter button grid; thumbnails from /api/socials/filters
│   │   │   ├── TextPlacementGrid.tsx     # 3×3 grid for 9 text placement positions + margin stepper
│   │   │   └── TextStyleControls.tsx     # FontSelector + size stepper + colour picker + "apply filter before text" checkbox
│   │   ├── FontSelector.tsx          # Font <select> with MRU optgroup (Recent) above full alphabetical list; used by TextStyleControls and PDFControls
│   │   ├── StepperInput.tsx          # Reusable ±stepper with configurable smallStep / largeStep / decimals (int or float)
│   │   ├── PDFButton.tsx             # Icon button (self-contained): owns open state, mounts PDFDialog on click; shows FaEllipsis while dialog is open; dynamically imported with ssr:false to avoid pdfjs DOMMatrix error
│   │   ├── SocialPostButton.tsx      # Icon button that mounts SocialPostDialog; shows FaEllipsis while dialog is open
│   │   ├── SocialPostSuccessDialog.tsx # Post-success modal: lists created post URLs as links; dismissed with OK
│   │   ├── DialogTitle.tsx           # Shared dialog header: title + subtitle + Close button
│   │   ├── Tabs.tsx                  # Tab bar: button-tab / button-tab-active / button-tab-inactive styling
│   │   ├── Tab.tsx                   # Tab panel: renders children only when tab === value
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
│   │       ├── PoemTitle.tsx         # Client title block: h2/h4 by context, optional link/pin toggle, id-driven copy buttons, social post button (RW mode)
│   │       ├── PoemProject.tsx       # Italic project statement, null-safe, optional two-line clamp
│   │       ├── PoemAuthor.tsx        # pen_name + (full_name) span
│   │       ├── PoemAwards.tsx        # List of awards; each row: medal icon · medal label · optional truncated award link
│   │       ├── PoemFeatures.tsx      # Sorted, deduplicated tag values joined by " · "; strings starting with /?  rendered as Next.js Links (enables theme navigation)
│   │       ├── PoemGroup.tsx         # Metadata group label span (eyebrow style)
│   │       ├── PoemNotes.tsx         # Unordered list of per-poem notes
│   │       ├── PoemSocial.tsx        # Social URL rendered as hostname link
│   │       ├── InstagramEmbed        # Dynamically imported (ssr: false) from react-social-media-embed; toggled via Show/Hide socials; width and captioned toggles
│   │       ├── PoemMechanismEditor.tsx # Multi-line textarea for the mechanism field; one paragraph per line
│   │       ├── PoemEditor.tsx        # Inline editor; receives full Poem loaded on demand
│   │       ├── PoemDetail.tsx        # Reading view + Edit toggle; mechanism field shown with 5-line clamp and SHOW MORE / SHOW LESS toggle
│   │       ├── PoemCreateForm.tsx    # Dedicated POST form with defaults + guards
│   │       ├── FeaturesEditor.tsx    # Multi-select for controlled-vocabulary groups (themes/moods/poetic_forms/techniques/tones_voices); fetches options from /api/features/{group}
│   │       ├── PoemMetadataEditor.tsx# Shared rating/date/url grid; FeaturesEditor for the five controlled-vocab fields; FeatureInput for free-text fields (key_images, contest_fit, socials)
│   │       ├── SimilarPoems.tsx      # Similar poems aside: all 5 axes (overall/theme/form/emotion/imagery) grouped
│   │       └── PoemBody.tsx          # Toggle show/hide; showBody prop auto-fetches and expands on mount; numbered prop adds 3-char right-aligned line numbers
│   └── lib/
│       ├── api.ts                    # Typed fetch wrappers for poems, similarity, clustering, features, social endpoints, and fetchFonts (GET /api/fonts)
│       ├── cluster.ts                # Cluster feature/group label helpers for cluster UI rendering
│       ├── types.ts                  # PoemSummaryData / Poem type hierarchy; Award / SearchState / SimilarityBundle / ClusterResponse; social request/response types (SocialGenerateRequest, SocialPostResponse, etc.); FontOption / TextSpecification / Placement
│       ├── editable.ts               # Canonical editable-field contract
│       └── format.ts                 # body ↔ plaintext, date formatting, cleanPoetryUrl, poemToMarkdown, medalColor
├── database/
│   ├── Poems.json                    # Canonical dev fixture collection
│   ├── <Title>.json                  # Per-poem mirror files (reference only)
│   └── schemas/
│       └── poem.schema.json          # JSON Schema (Draft 2020-12)
├── Dockerfile                        # Combined multi-stage base image (Node 22 + Python 3.13, Debian bookworm-slim, no CMD)
├── Dockerfile.backend                # Backend-only image used by docker-compose
├── Dockerfile.frontend               # Frontend-only image used by docker-compose
├── Dockerfile-gcloud                 # Single-container Cloud Run image (FastAPI + Next.js, CMD with startup health poll)
└── docker-compose.yml                # Orchestrates backend + frontend (local/self-hosted)
```

## Poem data model

The authoritative schema is `database/schemas/poem.schema.json`.
The runtime Pydantic mirror is `server/types.py`.

| Field                                                                                   | Type                            | Required                   | Editable          | Searchable                    | Notes                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------- | -------------------------- | ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                                    | UUID v4 string                  | yes                        | **immutable**     | no                            | Sole identifier used everywhere.                                                                   |
| `title`                                                                                 | string                          | yes                        | yes               | yes                           |                                                                                                    |
| `url`                                                                                   | URI                             | yes                        | yes               | no                            | Canonical external link.                                                                           |
| `body`                                                                                  | string (plain text)             | yes                        | yes               | yes                           | Stored and edited as plain text; newline and indentation are preserved on render.                  |
| `awards`                                                                                | `[{url, medal, title, closed}]` | yes (may be empty)         | yes (API)         | via `medals` filter           | `medal` is surfaced to search; `title` is the contest name; `closed` is an ISO 8601 datetime string recording when the contest closed. |
| `date`                                                                                  | ISO 8601 datetime               | yes                        | yes               | year/month in advanced search | Timezone-aware; UTC in existing data.                                                              |
| `themes`, `moods`, `poetic_forms`, `techniques`, `tones_voices`, `key_images`, `contest_fit` | `string[]`               | yes (may be empty)         | yes               | yes                           | Free-vocabulary tags. `moods`: tonal/affective; `poetic_forms`: metrical/structural forms; `techniques`: devices and techniques; `tones_voices`: voice/stance. |
| `project`                                                                               | string                          | yes                        | yes               | yes                           | One-sentence authorial statement.                                                                  |
| `rating`                                                                                | int 0–100                       | yes                        | yes               | min/max band                  | Authorial self-rating.                                                                             |
| `lines`, `words`                                                                        | int ≥ 0                         | yes                        | **derived**       | no                            | Recomputed from `body` on every write.                                                             |
| `socials`                                                                               | `string[]`                      | optional (default `[]`)    | yes               | no                            | Social media post URLs. Appended automatically when a post is published. All entries rendered as hostname links; Instagram URLs additionally rendered as embedded posts via `react-social-media-embed`. |
| `notes`                                                                                 | `string[]`                      | optional (default `[]`)    | yes               | yes                           | One string per note; edited via multi-line textbox (one line = one note).                          |
| `mechanism`                                                                             | `string[]`                      | optional (default `[]`)    | yes               | no                            | Authorial description of the poem's mechanisms; one string per paragraph. Displayed on the detail page with a 5-line clamp and SHOW MORE / SHOW LESS toggle; edited via multi-line textbox (one paragraph per line). |
| `author`                                                                                | `{pen_name, full_name}`         | optional (default `null`)  | yes (API)         | no                            | Author identity. Displayed on the detail page; no inline editor (structured object).               |

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
overwritten.

The per-title files in `database/` (e.g. `Not a Metaphor.json`) are
historical mirror files kept for convenience; the backend does not
read or write them.

## Configuration

### Backend

| Variable                | Default                                         | Purpose                                                                                                                                   |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POEMS_DATABASE`        | `<repo>/database/Poems.json`                    | Path to the poems JSON file. Absolute paths used verbatim; relative paths resolved against the **current working directory**.             |
| `CORS_ORIGINS`          | `http://localhost:3000,http://127.0.0.1:3000`   | Comma-separated list of allowed origins for browser calls.                                                                                |
| `READ_ONLY`             | `true`                                          | When `true`, all mutation endpoints (POST/PATCH/DELETE) return `405 Method Not Allowed`.                                                  |
| `OPENAI_API_KEY`        | —                                               | Required for social post image generation. Loaded from `.env` via `python-dotenv` at startup.                                            |
| `CLOUDINARY_CLOUD_NAME` | —                                               | Cloudinary credentials for hosting composed images before posting to social platforms.                                                    |
| `CLOUDINARY_API_KEY`    | —                                               |                                                                                                                                           |
| `CLOUDINARY_API_SECRET` | —                                               |                                                                                                                                           |
| `INSTAGRAM_USER_ID`     | —                                               | Instagram Graph API credentials for publishing posts.                                                                                     |
| `INSTAGRAM_ACCESS_TOKEN`| —                                               |                                                                                                                                           |
| `THREADS_USER_ID`       | —                                               | Threads API credentials for publishing posts.                                                                                             |
| `THREADS_ACCESS_TOKEN`  | —                                               |                                                                                                                                           |
| `BSKY_HANDLE`           | —                                               | Bluesky AT Protocol credentials for publishing posts.                                                                                     |
| `BSKY_APP_PASSWORD`     | —                                               |                                                                                                                                           |

A `.env` file in the current working directory is auto-loaded (via
`pydantic-settings`). Settings are exposed through `server.config.Settings`, stored on
`app.state.settings` at startup, and read from there by all request
handlers. Tests pass overrides directly to `create_app`.

### Frontend

| Variable                     | Default                                          | Purpose                                                                                                                                |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`   | `""` (same-origin relative paths)                | Origin prefix the browser prepends to every `/api/…` path. Inlined at build time. Empty string is correct for Cloud Run deployments.  |
| `READ_ONLY`                  | `true`                                           | When `true`, hides all editing controls (pin, edit, delete, new poem, social post). Read at server-component render time.              |

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

## Client-side sorting

The listing page applies a second, client-side sort layer on top of the server's authoritative ordering. Poems already fetched are re-sorted in the browser without a network round-trip:

| Button | Default direction | Sort key                      |
| ------ | ----------------- | ----------------------------- |
| Title  | A → Z             | `title` (locale-aware)        |
| Date   | newest first      | `date` (ISO 8601 timestamp)   |
| Lines  | most first        | `lines` (integer)             |
| Words  | most first        | `words` (integer)             |
| Rating | highest first     | `rating` (integer)            |
| Awards | most first        | `awards.length` (integer)     |

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

Button classes (`button-primary`, `button-sort`, `button-text*`) are also in `globals.css` but carry layout (border, padding, transition) in addition to typography.

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

| Axis    | Structured input                                                | Semantic input  | Structured weight | Semantic weight |
| ------- | --------------------------------------------------------------- | --------------- | ----------------- | --------------- |
| theme   | `themes` Jaccard                                                | —               | 1.0               | 0.0             |
| form    | `poetic_forms` + `techniques` + `tones_voices` Jaccard          | `form_text`     | 0.8               | 0.2             |
| emotion | `moods` Jaccard                                                 | —               | 1.0               | 0.0             |
| imagery | `key_images` Jaccard                                            | `image_text`    | 0.8               | 0.2             |

The **overall score** is a weighted average across all axes plus `fit`
(structured only) and `project` (semantic only):

| Component | Weight |
| --------- | ------ |
| theme     | 0.30   |
| form      | 0.20   |
| emotion   | 0.15   |
| imagery   | 0.15   |
| fit       | 0.10   |
| project   | 0.10   |

### API endpoints

All similarity endpoints return `404` for an unknown `id`, `422` for a
malformed `id` or an out-of-range `k`. They work in read-only mode.

| Method | Path | `k` params | Returns | Description |
| ------ | ---- | ---------- | ------- | ----------- |
| GET | `/api/poems/{id}/similar` | `k_overall=5`, `k_theme=3`, `k_form=3`, `k_emotion=3`, `k_imagery=3` | `SimilarityBundle` | All 5 axes in one response |
| GET | `/api/poems/{id}/similar/overall` | `k=5` | `NeighbourListResult` | Overall weighted score |
| GET | `/api/poems/{id}/similar/theme` | `k=5` | `NeighbourListResult` | Theme axis only |
| GET | `/api/poems/{id}/similar/form` | `k=5` | `NeighbourListResult` | Form axis only |
| GET | `/api/poems/{id}/similar/emotion` | `k=5` | `NeighbourListResult` | Emotion axis only |
| GET | `/api/poems/{id}/similar/imagery` | `k=5` | `NeighbourListResult` | Imagery axis only |

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
   category across the corpus. The matrix is L2-normalised per category
   block so categories of different vocabulary size contribute equally.

2. **Auto-k** — when `k` is omitted, silhouette score is evaluated for
   `k ∈ range(2, min(n−1, max(3, n//3), 10) + 1)` using Ward linkage;
   the `k` with the highest score is used. For `n < 3` or an empty
   feature space, the corpus is returned as a single cluster.

3. **Clustering** — `AgglomerativeClustering(linkage="ward")` from
   scikit-learn. Deterministic — no random state.

4. **Feature ranking** — lift = `cluster_freq / (global_freq + ε)`.
   The top 3 features by lift are returned per cluster.

5. **Cluster label** — up to 3 features with frequency ≥ 0.5 in the
   cluster, ranked by lift, joined with ` / `. Falls back to the
   top-lift feature if none meets the 0.5 threshold.

6. **Exclusion** — poems in clusters with fewer than `min_cluster_size`
   members are moved to `excluded` with `reason: "cluster too small"`.

## Social post generation

The social feature creates a 1080×1080 PNG and publishes it to Instagram,
Threads, and Bluesky in a single operation. It is gated behind
`require_write_access`. The pipeline runs in four stages:

1. **Text selection** — the poem title and body are sent to an OpenAI text
   model (Responses API) which returns a short excerpt, an image prompt,
   `alt_text`, and an `is_adult` flag as JSON.
2. **Image generation** — the prompt is sent to the images API to produce a
   square PNG. Setting `TESTING` to a `Path` in `server/social/pipeline.py`
   bypasses the API and reads from that file instead.
3. **Composition** — the raw image is resized to 1080×1080 (Lanczos). Text
   overlay is applied at the requested placement and colour via Pillow, then
   the selected filter is applied. The `filter_first` flag reverses this order
   (filter before text).
4. **Publishing** — the composed image is uploaded to Cloudinary to obtain a
   public URL. It is then posted to Instagram (Graph API), Threads (Threads
   API), and Bluesky (AT Protocol) in sequence. The URLs of the created posts
   are appended to `poem.socials` and returned to the frontend.

### API endpoints

All endpoints require write access.

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/socials/generate` | Full pipeline: excerpt + prompt → image → compose → store; returns excerpt, prompt, image_url |
| POST | `/api/socials/update` | Re-composes current excerpt + text spec + filter onto the stored raw image; no LLM call; returns image_url |
| POST | `/api/socials/regenerate` | Regenerates the image from an updated prompt; returns image_url |
| POST | `/api/socials/post` | Analyse, caption, upload to Cloudinary, post to all three platforms; appends URLs to poem.socials; returns socials list |
| GET | `/api/socials/filters` | Available filter names with preview thumbnails |
| GET | `/api/socials/image/{poem_id}` | Raw generated PNG |
| GET | `/api/socials/image/{poem_id}/{filter_name}` | Composed (overlay + filter) PNG |

### Frontend dialog

`SocialPostButton` (rendered on the poem detail page in RW mode) shows
`FaEllipsis` while the dialog is open. It opens `SocialPostDialog` — a
native `<dialog>` modal. On mount it fetches fonts (`GET /api/fonts`) and
filters in parallel, selects a default font (MRU-first), then calls
`/api/socials/generate`. While any operation is in flight the entire content
area is dimmed (`opacity-40`, `pointer-events-none`) and an
absolutely-positioned overlay shows a CSS spinner and the current loading
message.

The dialog tracks two independent dirty flags for excerpt and prompt. Each
is managed by `UpdateRevertEditor` — a shared textarea with UPDATE and REVERT
buttons. UPDATE calls the relevant endpoint; REVERT snaps back to the last
clean value. Any change to filter, placement, style, or margin immediately
calls `/api/socials/update`. PUBLISH is disabled while either flag is set.

`SocialPostActions` has three buttons: Regenerate, Copy (three-state:
idle / spinner / checkmark, copies the current image to clipboard), and
Publish.

On successful publish, the dialog closes and `SocialPostSuccessDialog`
appears, listing the created post URLs as clickable links, dismissed with OK.

Font selections are persisted via a 16-entry MRU list in `localStorage`
(`instagram_mru_fonts`). The `FontSelector` component groups recent fonts
above the full alphabetical list and is shared with the PDF controls.

### Filters

Twelve Pillow-based filters: `none`, `aden`, `clarendon`, `crema`,
`gingham`, `juno`, `lark`, `ludwig`, `moon`, `perpetua`, `reyes`,
`slumber`. Each is a pure function `apply_filter(image, filter_name) -> Image`.

### Next.js proxy timeout

`next.config.mjs` sets `experimental.proxyTimeout: 120_000` to avoid
ECONNRESET during slow OpenAI image generation calls.

## Fonts endpoint

`GET /api/fonts`

Returns all available TTF fonts as `[{ filename, label }]`. `filename`
is the path relative to `server/fonts/` without extension (e.g.
`IBM_Plex_Sans/IBMPlexSans-Regular`); `label` is the human-readable
name derived by splitting CamelCase and underscore segments. Results are
cached in memory after the first call.

The same fonts are available to the Typst PDF compiler as system fonts
(installed on the host). The font endpoint is the authoritative source
for both the social dialog and the PDF controls.

## PDF generation

`POST /api/pdf/{poem_id}`

Fetches the poem by UUID, renders `server/pdf/poem.typ` via Jinja2 with
`title`, `author` (pen name from `AUTHOR`), `stanzas`, and layout variables
(`paper`, `margin`, `font`, `font_size`, `colour`, `columns`, `gutter`,
`leading`, `spacing`), then compiles the rendered source to PDF using the
`typst` Python package (embedded Rust compiler — no external binary). Returns
the PDF bytes with `Content-Disposition: inline`.

`body_to_stanzas` splits the body on runs of two or more blank lines into a
list of Typst stanza strings. A gap of exactly `\n\n` is a plain stanza
break; a gap of `\n\n\n` or more inserts an empty-string stanza, preserving
the extra vertical spacing visible in the poem window.

`POST /api/pdf/{poem_id}/post`

Generates a PNG of the first page (via `png_from_source`, 150 PPI), uploads
it to Cloudinary, then posts to Instagram, Threads, and Bluesky. The
Instagram URL is appended to `poem.socials`. Returns `{ socials, errors }`.

The Typst template renders a two-column layout with a centred title and
author header. All layout parameters are substituted at render time.

### Frontend

`PDFButton` (rendered alongside the copy and social buttons on each poem
in RW mode) is dynamically imported with `ssr: false` to prevent the
`pdfjs-dist` module from evaluating in Node.js (where `DOMMatrix` is
undefined). It shows `FaEllipsis` while the dialog is open. On click it
mounts `PDFDialog` — a native `<dialog>` that calls `POST /api/pdf/{poemId}`
and renders the result via `react-pdf` (pdfjs v5). A loading overlay with a
CSS spinner covers the dialog body while any operation is in flight.

`PDFControls` exposes all layout parameters: paper size, margin, font (with
MRU selector), font size, colour, columns, gutter, leading, and spacing.

`PDFActions` provides four buttons, all with state feedback:
- **Download** — anchor click to browser default location; flashes "Downloaded" + checkmark for 2 s.
- **Save** — File System Access API (`showSaveFilePicker`); spinner while the picker is open.
- **Copy** — renders the first page to a canvas via pdfjs at 2× scale, writes PNG to the clipboard; three-state (idle / spinner / checkmark).
- **Publish** — calls `POST /api/pdf/{poemId}/post`; spinner while in flight.

## Recent poems endpoint

`GET /api/poems/recent?k=12`

Returns the `k` most recent poems ordered by `date` descending, with
`id` ascending as a tiebreaker. Response: `PoemSummaryDataList`.

## Awards endpoint

`GET /api/poems/awards`

Returns all poems that have at least one award, in authoritative order
(date-desc, id-asc). Each item includes the full `awards` array.
Response: `PoemSummaryDataList`.

## Features vocabulary endpoint

`GET /api/features/{group}`

Returns the controlled vocabulary for a tag group as `string[]`.

| `group`        | Config constant         | Field on `Poem`  |
| -------------- | ----------------------- | ---------------- |
| `themes`       | `THEME_FEATURES`        | `themes`         |
| `moods`        | `MOOD_FEATURES`         | `moods`          |
| `poetic_forms` | `POETIC_FORM_FEATURES`  | `poetic_forms`   |
| `techniques`   | `TECHNIQUE_FEATURES`    | `techniques`     |
| `tones_voices` | `TONE_VOICE_FEATURES`   | `tones_voices`   |

Unknown groups return `404`. Group names are case-sensitive. Works in read-only mode.

## Ordering

Authoritative ordering (applied by both list endpoints before returning):

1. **`date` descending** (most recent first).
2. **Tiebreaker:** `id` ascending (UUID string compare). Deterministic
   and stable.

Pinned-first ordering is applied client-side only. Search filters the
set; it never re-ranks. There is no relevance scoring.

Both `GET /api/poems` and `GET /api/poems/search` return the full
filtered set in a single response — no pagination.

## Pinning, editing, and hard deletion

- **Pinning** — stored in `localStorage` under `jojo:pins` as a JSON
  array of UUID strings. No server round-trip. Pins are per-browser and
  visible in read-only mode. Pinned-first ordering is enforced by the
  client-side sort layer.
- **Editing** — the full `Poem` is fetched on demand when the editor is
  opened (cached in `loadedPoems`). PATCH sends only the diff; local
  state is replaced from the server response; failure keeps edit mode
  open with an inline error.
- **Creation** — dedicated page at `/poems/new`. Required: `title`,
  `url`, `project`, `body`, `rating`. The server owns identity: UUID v4
  is generated server-side; client-supplied `id`/`lines`/`words` are
  rejected.
- **Hard deletion** — two-step confirmation (arm, then confirm within
  4 s). Returns `204`; the listing refetches from the top.

## Tests

```bash
make test           # READ_ONLY=false uv run pytest tests/server
make test-verbose   # same, with -vv output
make typecheck      # npx tsc --noEmit
make lint           # npx next lint
make check          # test + typecheck + lint
```

`READ_ONLY=false` is required because several test fixtures exercise
mutation endpoints that return `405` when `READ_ONLY=true`.

Test files:

- `tests/server/test_repository.py` — configuration resolution; load/validate;
  duplicate-id and invalid-UUID rejection; immutability; atomic
  persistence; alternate-file configurability.
- `tests/server/test_read_api.py` — `/health`; list response shape; search; ordering;
  404/422 handling; `/api/poems/recent`; `/api/poems/awards`.
- `tests/server/test_mutations.py` — PATCH partial semantics; derived recompute;
  unknown-field/id rejection; DELETE; persistence-failure atomicity.
- `tests/server/test_search.py` — themes AND pre-filter; OR across fields;
  year/month; medals; empty query behaviour.
- `tests/server/test_ordering.py` — date-desc default; id-ascending tiebreaker;
  filtered subsequence ordering; mutation reordering.
- `tests/server/test_create.py` — valid creation; server-generated UUID v4;
  defaults; rejection of client-supplied fields; ordering; atomicity.
- `tests/server/test_similarity.py` — full similarity stack: normalisation,
  Jaccard edge cases, TF-IDF index, fusion arithmetic, service behaviour,
  all API endpoints, mutation → rebuild integration.
- `tests/server/test_features_api.py` — all five vocabulary groups; 404 for
  unknown/misspelled groups; case-sensitivity.
- `tests/server/test_clustering.py` — engine unit tests (matrix, auto-k, lift,
  labels, poem ordering) and API tests (shape, partition invariant, ordering,
  exclusion, invalid categories, read-only).

## Limitations and assumptions

- **Single-writer process.** Thread-safe inside one process via
  `threading.RLock`, but no cross-process file lock. Deploy with a
  single Uvicorn worker.
- **No authentication.** The API is unauthenticated. Safe only on
  trusted networks or behind an external auth layer.
- **Last-write-wins.** No optimistic concurrency — two near-simultaneous
  PATCHes overwrite each other in arrival order.
- **In-memory image store.** Social post images are held in a
  module-level dict; cleared on server restart, not shared across workers.
- **No schema versioning field.** Additive changes work; breaking
  changes will need a `schema_version` and a one-shot migration.
- **No relevance ranking.** Search filters but does not rank.
- **`awards` has no inline editor.** The awards page displays `awards`
  read-only; the backend accepts PATCH, but there is no form UI for
  creating or modifying award records.
- **No end-to-end UI tests.** Frontend is validated via `tsc` and
  `next build`; interactive flows are exercised manually.
- **Similarity rebuilds on every mutation.** Acceptable for a small
  collection; a larger one would benefit from incremental updates.

## Sensible next steps

1. **Object-array editor** for `awards` in both the create and edit surfaces.
2. **Optimistic concurrency** via `ETag` / `If-Match` headers so a
   stale-client PATCH fails with `409` instead of silently winning.
3. **Schema versioning** (`schema_version` on each record) plus a
   one-shot migration harness.
4. **Styled in-page confirm dialogs** replacing `window.confirm` and
   `beforeunload`, keeping the aesthetic coherent.
5. **Authentication + authorisation** (even a single shared-secret
   bearer) before exposing mutation endpoints beyond a trusted network.
6. **Search improvements**: stemming / diacritic folding, and a NOT
   modifier on the advanced endpoint for exclusion filters.
7. **End-to-end tests** (Playwright) covering the edit, pin, delete,
   and create flows against a disposable backend.
8. **Similarity synonym vocabulary** — populate `SYNONYMS` in
   `server/similarity/normalise.py` as the tag vocabulary grows.
9. **Incremental similarity rebuild** — replace the full-corpus rebuild
   on mutation with a targeted update for larger collections.
10. **LLM-assisted Author's Notes** — integrate an LLM into the edit
    and new-poem forms to help draft and refine notes.
