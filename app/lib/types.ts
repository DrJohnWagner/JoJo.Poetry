export type UUID = string

export interface Contest {
    url: string
    award: string
}

export interface Note {
    body: string
    created_at?: string | null
    author?: string | null
}

export interface PoemSummary {
    id: UUID
    title: string
    url: string
    date: string
    rating: number
    lines: number
    words: number
    pinned: boolean
    themes: string[]
    emotional_register: string[]
    form_and_craft: string[]
    contest_fit: string[]
    has_contests: boolean
    project: string
}

export interface Poem extends Omit<PoemSummary, "has_contests"> {
    body: string
    copyright: string
    contests: Contest[]
    key_images: string[]
    authors_notes: Note[]
    notes: Note[]
}

export interface Pagination {
    total: number
    offset: number
    limit: number
    has_more: boolean
}

export interface PoemList {
    items: PoemSummary[]
    pagination: Pagination
}

/** Filters that drive BOTH the simple and the advanced search calls. */
export interface SearchState {
    q: string
    year: number | null
    month: number | null
    awards: string[] // Gold | Silver | Bronze | Honorable Mention | None
}

export const AWARDS = [
    "Gold",
    "Silver",
    "Bronze",
    "Honorable Mention",
    "None",
] as const

export function hasAdvanced(s: SearchState): boolean {
    return s.year !== null || s.month !== null || s.awards.length > 0
}

export function isEmptySearch(s: SearchState): boolean {
    return !s.q.trim() && !hasAdvanced(s)
}
