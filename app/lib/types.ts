export type UUID = string

export interface Author {
    pen_name: string
    full_name: string
}

export interface Award {
    url: string
    medal: string
    title?: string
}

export interface ClusterPoem {
    id: UUID
    title: string
    pinned: boolean
    project: string
    themes: string[]
    emotional_registers: string[]
    formal_modes: string[]
    craft_features: string[]
    stylistic_postures: string[]
}

export interface Poem extends ClusterPoem {
    url: string
    date: string
    rating: number
    lines: number
    words: number
    contest_fit: string[]
    body: string
    awards: Award[]
    key_images: string[]
    notes: string[]
    socials: string[]
    author?: Author
}

export interface Pagination {
    total: number
    offset: number
    limit: number
    has_more: boolean
}

export interface PoemList {
    items: Poem[]
    pagination: Pagination
}

/** Filters that drive BOTH the simple and the advanced search calls. */
export interface SearchState {
    q: string
    year: number | null
    month: number | null
    medals: string[] // Gold | Silver | Bronze | Honorable Mention | None
    title: string
    body: string
    project: string
    notes: string
}

export const MEDALS = [
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
        s.medals.length > 0 ||
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
    items: Poem[]
}

export interface SimilarityBundle {
    overall: NeighbourListResult
    theme: NeighbourListResult
    form: NeighbourListResult
    emotion: NeighbourListResult
    imagery: NeighbourListResult
}

export interface ClusterItem {
    label: string
    size: number
    features: string[]
    poems: ClusterPoem[]
}

export interface ClusterExcluded {
    id: UUID
    title: string
    reason: string
}

export interface ClusterResponse {
    clusters: ClusterItem[]
    excluded: ClusterExcluded[]
    k_used: number
    categories_used: string[]
}
