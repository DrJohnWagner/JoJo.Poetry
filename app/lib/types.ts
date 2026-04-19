export type UUID = string

export interface Contest {
    url: string
    award: string
    title?: string
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
    contest_count: number
    project: string
}

export interface Poem extends Omit<PoemSummary, "has_contests"> {
    body: string
    contests: Contest[]
    key_images: string[]
    notes: string[]
    socials: string[]
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
    title: string
    body: string
    project: string
    notes: string
}

export const AWARDS = [
    "Gold",
    "Silver",
    "Bronze",
    "Honorable Mention",
    "None",
] as const

export function hasAdvanced(s: SearchState): boolean {
    return (
        s.year !== null ||
        s.month !== null ||
        s.awards.length > 0 ||
        !!s.title?.trim() ||
        !!s.body?.trim() ||
        !!s.project?.trim() ||
        !!s.notes?.trim()
    )
}

export function isEmptySearch(s: SearchState): boolean {
    return !s.q.trim() && !hasAdvanced(s)
}

export interface NeighbourResult {
    id: UUID
    title: string
    project: string
    score: number
}
export interface NeighbourListResult {
    query_id: UUID
    neighbours: NeighbourResult[]
}

export interface RecentList {
    items: PoemSummary[]
}

export interface SimilarityBundle {
    overall: NeighbourListResult
    theme: NeighbourListResult
    form: NeighbourListResult
    register: NeighbourListResult
    imagery: NeighbourListResult
}
