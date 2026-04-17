/** Canonical editable-field contract shared by every editing surface.
 *
 *  The same set is exposed on the home-page row editor and the
 *  single-poem page. The UI packaging differs (compact inline form vs.
 *  click-to-edit-per-field) but the fields themselves do not.
 */

import type { Poem } from "./types"

/** Inline-editable on both views. */
export const EDITABLE_FIELDS = [
    "title",
    "project",
    "body",
    "rating",
    "pinned",
    "date",
    "url",
    "themes",
    "emotional_register",
    "form_and_craft",
    "key_images",
    "contest_fit",
    "socials",
    "notes",
] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]

/** Immutable in the API and therefore unreachable by any UI. */
export const IMMUTABLE_FIELDS = ["id", "lines", "words"] as const

/** Backend accepts edits via PATCH but no inline UI ships for them in
 *  this first draft (they are structured object arrays and need a
 *  dedicated editor). */
export const NOT_INLINE_EDITABLE = ["contests"] as const

/** Working draft used by editors: every inline-editable field is a
 *  string input except pinned (boolean) and rating (number). Tag lists
 *  are edited as comma-separated strings and parsed on save. */
export interface PoemDraft {
    title: string
    project: string
    body: string // plaintext with real \n newlines (round-tripped via format.ts)
    rating: number
    pinned: boolean
    date: string // ISO 8601
    url: string
    themes: string // comma-separated
    emotional_register: string
    form_and_craft: string
    key_images: string
    contest_fit: string
    socials: string // comma-separated
    notes: string // newline-separated
}

export function draftFromPoem(p: Poem, plainBody: string): PoemDraft {
    return {
        title: p.title,
        project: p.project,
        body: plainBody,
        rating: p.rating,
        pinned: p.pinned,
        date: p.date,
        url: p.url,
        themes: p.themes.join(", "),
        emotional_register: p.emotional_register.join(", "),
        form_and_craft: p.form_and_craft.join(", "),
        key_images: p.key_images.join(", "),
        contest_fit: p.contest_fit.join(", "),
        socials: p.socials.join(", "),
        notes: p.notes.join("\n"),
    }
}

function splitTags(s: string): string[] {
    return s
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
}

/** Build a PATCH payload containing only fields that differ from `base`.
 *  `toStoredBody` converts the plaintext body back to the stored
 *  <br/>-delimited form. */
export function diffDraft(
    base: Poem,
    plainBase: string,
    draft: PoemDraft,
    toStoredBody: (s: string) => string
): Partial<Poem> {
    const out: Partial<Poem> = {}
    if (draft.title !== base.title) out.title = draft.title
    if (draft.project !== base.project) out.project = draft.project
    if (draft.body !== plainBase) out.body = toStoredBody(draft.body)
    if (draft.rating !== base.rating) out.rating = draft.rating
    if (draft.pinned !== base.pinned) out.pinned = draft.pinned
    if (draft.date !== base.date) out.date = draft.date
    if (draft.url !== base.url) out.url = draft.url

    const tagFields: (keyof PoemDraft & keyof Poem)[] = [
        "themes",
        "emotional_register",
        "form_and_craft",
        "key_images",
        "contest_fit",
        "socials",
    ]
    for (const k of tagFields) {
        const next = splitTags(draft[k] as string)
        const prev = base[k] as string[]
        if (next.length !== prev.length || next.some((v, i) => v !== prev[i])) {
            ;(out as Record<string, unknown>)[k] = next
        }
    }
    const nextNotes = draft.notes
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    if (
        nextNotes.length !== base.notes.length ||
        nextNotes.some((v, i) => v !== base.notes[i])
    ) {
        out.notes = nextNotes
    }
    return out
}

export function isDirty(
    base: Poem,
    plainBase: string,
    draft: PoemDraft,
    toStoredBody: (s: string) => string
): boolean {
    return (
        Object.keys(diffDraft(base, plainBase, draft, toStoredBody)).length > 0
    )
}
