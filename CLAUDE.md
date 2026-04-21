# JoJo.Poetry — Claude context

## Maintaining this file

Update this file whenever you learn something that would be useful context for
future sessions: architectural decisions, naming conventions, gotchas, workflow
preferences, field semantics, or anything that would otherwise need to be
re-explained. Commit the update as part of the relevant change, or on its own
if it is context-only.

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

## Key schema types

```
Award  { url: str, medal: str, title?: str }
Poem.awards: Award[]          # contest entries (read-only in UI for now)
Poem.contest_fit: str[]       # matching tags (inline-editable)
```

`medal` values: `Gold`, `Silver`, `Bronze`, `Honorable Mention`, `None` (sentinel for no contests).
