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
│   ├── app.py                        # FastAPI factory, CORS, lifespan load
│   ├── api.py                        # All routes (read, search, POST/PATCH/DELETE)
│   ├── config.py                     # Settings: POEMS_DATABASE, .env, paths
│   ├── repository.py                 # In-memory, file-backed PoemRepository
│   └── Dockerfile                    # Python 3.12-slim image
├── requirements.txt                  # Production Python deps
├── requirements-dev.txt              # Adds pytest, httpx, jsonschema
├── tests/server/                     # pytest suite (81 tests)
├── app/
│   ├── page.tsx                      # Landing: listing + search + incremental load
│   ├── poems/[id]/page.tsx           # Detail + inline editing
│   ├── poems/new/page.tsx            # Dedicated create page
│   ├── layout.tsx, globals.css
│   ├── components/
│   │   ├── AppConfig.tsx             # React context provider for runtime config (readOnly)
│   │   ├── PoemListing.tsx           # Client: fetch, infinite scroll, row edit/delete
│   │   ├── PoemEditorForm.tsx        # Shared editor (list row + detail)
│   │   ├── PoemRowEditor.tsx         # Thin wrapper around PoemEditorForm for rows
│   │   ├── PoemCreateForm.tsx        # Dedicated POST form with defaults + guards
│   │   ├── PoemDetail.tsx            # Reading view + Edit toggle
│   │   ├── SearchBar.tsx             # q + submit + Advanced modal trigger
│   │   ├── AdvancedSearchDialog.tsx  # Native <dialog>-backed modal
│   │   ├── PoemRow.tsx               # Single poem row (title, meta, collapsible body)
│   │   ├── PinToggle.tsx             # Server-confirmed pin/unpin
│   │   ├── DeleteButton.tsx          # Two-step confirmation control
│   │   └── PoemBody.tsx              # Body -> plaintext projection display
│   └── lib/
│       ├── api.ts                    # Typed fetch wrappers
│       ├── types.ts                  # Poem / PoemSummary / SearchState
│       ├── editable.ts               # Canonical editable-field contract
│       └── format.ts                 # body <-> plaintext, date formatting
├── database/
│   ├── Poems.json                    # Canonical collection
│   ├── <Title>.json                  # Per-poem mirror files (reference only)
│   └── schemas/
│       ├── poem.schema.json          # JSON Schema (Draft 2020-12)
│       └── poem.py                   # Pydantic Poem / Contest / Note
└── docker-compose.yml                # Orchestrates backend + frontend
```

## Poem data model

The authoritative schema is `database/schemas/poem.schema.json`;
`database/schemas/poem.py` is its Pydantic mirror.

| Field                                                                         | Type                             | Required                   | Editable      | Searchable                      | Notes                                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------- | -------------------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                                                                          | UUID v4 string                   | yes                        | **immutable** | no                              | Sole identifier used everywhere.                                                                 |
| `title`                                                                       | string                           | yes                        | yes           | yes                             |                                                                                                  |
| `url`                                                                         | URI                              | yes                        | yes           | no                              | Canonical external link.                                                                         |
| `body`                                                                        | string (HTML fragment)           | yes                        | yes           | yes\*                           | `<br/>` line breaks + literal whitespace for indentation. \*Search hits a plain-text projection. |
| `contests`                                                                    | `[{url, award, title?}]`         | yes (may be empty)         | yes (API)     | via `awards` filter             | `award` is surfaced to search; `title` is an optional contest name displayed in the UI.          |
| `date`                                                                        | ISO 8601 datetime                | yes                        | yes           | year/month in advanced search   | Timezone-aware; UTC in existing data.                                                            |
| `themes`, `emotional_register`, `form_and_craft`, `key_images`, `contest_fit` | `string[]`                       | yes (may be empty)         | yes           | yes                             | Free-vocabulary tags.                                                                            |
| `project`                                                                     | string                           | yes                        | yes           | yes                             | One-sentence authorial statement.                                                                |
| `rating`                                                                      | int 0–100                        | yes                        | yes           | min/max band                    | Authorial self-rating.                                                                           |
| `lines`, `words`                                                              | int ≥ 0                          | yes                        | **derived**   | no                              | Recomputed from `body` on every write.                                                           |
| `pinned`                                                                      | bool                             | optional (default `false`) | yes           | no                              | Pinned poems lead listings.                                                                      |
| `socials`                                                                     | `string[]`                       | optional (default `[]`)    | yes           | no                              | Social media URLs; displayed as links on the detail page.                                        |
| `notes`                                                                       | `[{body, created_at?, author?}]` | optional (default `[]`)    | yes (API)     | via simple/advanced text search | No inline UI yet.                                                                                |

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
- **Displayed** inside `white-space: pre-wrap`, so authored newlines
  **and** leading-whitespace indentation survive byte-for-byte.
- **Edited** as the same plaintext projection — writers edit what
  they read. `plainTextToBody` rewrites each newline as `<br/>\n`
  when saving, reproducing the canonical stored form.

## The role of `database/Poems.json`

`database/Poems.json` is a single JSON array of poem objects. It is
the only persistent data store. The backend loads it once at startup,
validates every record against the Pydantic model, and serves reads
from memory. Every mutation (POST, PATCH, DELETE) writes the full
array back atomically (temp file + `fsync` + `os.replace`) **before**
swapping the new state into memory, so a failed disk write leaves
memory and disk identically untouched.

The per-title files in `database/` (e.g. `Not a Metaphor.json`) are
historical mirror files kept for convenience; the backend does not
read or write them.

## Schema artefacts in `database/schemas`

- **`poem.schema.json`** — JSON Schema (Draft 2020-12). Usable
  outside the runtime for editor autocomplete, external validators,
  and CI checks. Rejects unknown fields and enforces UUID-v4 `id`,
  bounded rating, and required-vs-optional structure.
- **`poem.py`** — Pydantic models (`Poem`, `Contest`, `Note`). Used
  by the backend at runtime for load-time validation, PATCH-merge
  validation, and response shaping. Applies the documented defaults
  (`pinned=false`, `socials=[]`, `notes=[]`) when
  optional fields are absent.

## Configuration

### Backend

| Variable         | Default                                       | Purpose                                                                                                                       |
| ---------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POEMS_DATABASE` | `<repo>/database/Poems.json`                  | Path to the poems JSON file. Absolute paths used verbatim; relative paths resolved against the **current working directory**. |
| `CORS_ORIGINS`   | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed origins for browser calls.                                                                    |
| `READ_ONLY`      | `true`                                        | When `true`, all mutation endpoints (POST/PATCH/DELETE) return `405 Method Not Allowed`.                                      |

A `.env` file in the current working directory is auto-loaded (via
`pydantic-settings`). Settings are exposed through
`server.config.Settings`; tests pass overrides directly.

### Frontend

| Variable                   | Default                 | Purpose                                                                       |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Origin the browser calls. Inlined at build time.                              |
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

Details:

- `Dockerfile.backend` copies `requirements.txt`, `server/`, and
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
`max_rating` together = one populated field); `awards`.

`awards` values: `Gold`, `Silver`, `Bronze`, `Honorable Mention`,
`None`. `None` matches poems whose `contests` array is empty; selecting
multiple awards is OR (e.g. `awards=Gold&awards=None`). Unknown awards
→ 422.

Both endpoints return the same `PoemList` wrapper and apply the same
ordering and pagination.

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
  `contest_fit`, `socials`. PATCH sends only the diff; local
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
READ_ONLY=false uv run pytest tests/server   # ~81 tests, ~4 s
npx tsc --noEmit                             # TypeScript type-check
npx next build                               # production build
```

`READ_ONLY=false` is required because several test fixtures exercise
mutation endpoints that return `405` when `READ_ONLY=true`.

Test files:

- `tests/server/test_repository.py` — configuration resolution; load/validate;
  duplicate-id and invalid-UUID rejection; immutability; atomic
  persistence; alternate-file configurability.
- `tests/server/test_read_api.py` — `/health`; summary shape; pagination; search;
  pinned-first ordering; 422 malformed id; 404 unknown id.
- `tests/server/test_mutations.py` — PATCH partial semantics; derived recompute;
  unknown-field/id rejection; DELETE; **persistence-failure
  atomicity** (injected `OSError` keeps memory and disk consistent).
- `tests/server/test_search.py` — OR across populated fields; within-field OR on
  tags; year/month; Gold / None / multiple awards; pinned-first
  preserved; pagination applies to search.
- `tests/server/test_ordering.py` — date-desc default; pinned-first with internal
  date-desc; id-ascending tiebreaker; sequential pages neither skip
  nor duplicate; pin / date / delete mutations reorder correctly.
- `tests/server/test_create.py` — valid creation; server-generated UUID v4;
  defaults for omitted optionals; rejection of client-supplied
  `id`/`lines`/`words`; required-field-missing rejection; ordering
  visibility after create; failed-persistence atomicity; body
  round-trip.

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
- **External edits aren't picked up live.** Editing `Poems.json` by
  hand while the server runs will be overwritten by the next
  mutation; restart to pick up manual changes.
- **No schema versioning field.** Additive changes work; breaking
  changes will need a `schema_version` and a one-shot migration.
- **No relevance ranking.** Search filters but does not rank; order
  is always authoritative (pinned → date-desc → id-asc).
- **`contests` and `notes` have no inline UI yet.**
  They are object arrays; the backend accepts PATCH, but the UI
  surfaces contests as read-only and has no editor for the notes array.
- **Browser-native modals** are used for discard/confirm prompts
  (`window.confirm`, `beforeunload`). Fine for a first draft; a
  styled in-page prompt would match the literary aesthetic better.
- **No end-to-end UI tests.** Frontend is validated via `tsc` and
  `next build`; interactive flows are exercised manually.

## Sensible next steps

1. **Object-array editors** for `contests` and `notes` in both the
   create and edit surfaces.
2. **Optimistic concurrency** via `ETag` / `If-Match` headers so a
   stale-client PATCH fails with `409` instead of silently winning.
3. **Schema versioning** (`schema_version` on each record) plus a
   one-shot migration harness, preparing for the first breaking
   change.
4. **Background file-watch** that safely reloads `Poems.json` when
   touched externally, with a cooperative lock file.
5. **Styled in-page confirm dialogs** replacing `window.confirm` and
   `beforeunload`, keeping the aesthetic coherent with the rest of
   the site.
6. **Authentication + authorisation** (even a single shared-secret
   bearer) before exposing mutation endpoints beyond a trusted
   network.
7. **Search improvements**: stemming / diacritic folding, and a
   NOT modifier on the advanced endpoint for exclusion filters.
8. **End-to-end tests** (Playwright) covering the edit, pin, delete,
   and create flows against a disposable backend.
