export type UUID = string

export interface Author {
    pen_name: string
    full_name: string
}

export interface Award {
    url: string
    medal: string
    title: string
    closed: string // ISO datetime string
}

export interface PoemSummaryData {
    id: UUID
    title: string
    project: string
    rating: number
    lines: number
    words: number
    date: string
    awards: Award[]
    pinned: boolean
}

export interface ClusterPoem extends PoemSummaryData {
    themes: string[]
    moods: string[]
    poetic_forms: string[]
    techniques: string[]
    tones_voices: string[]
}

export interface Poem extends PoemSummaryData {
    author?: Author
    url: string
    body: string
    notes: string[]
    socials: string[]
    themes: string[]
    moods: string[]
    poetic_forms: string[]
    techniques: string[]
    tones_voices: string[]
    contest_fit: string[]
    key_images: string[]
}

export interface PoemSummaryDataList {
    items: PoemSummaryData[]
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

export interface NeighbourResult extends PoemSummaryData {
    score: number
}
export interface NeighbourListResult {
    query_id: UUID
    neighbours: NeighbourResult[]
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

export interface ClusterExcluded extends PoemSummaryData {
    reason: "zero signal" | "cluster too small"
}

export interface ClusterResponse {
    clusters: ClusterItem[]
    excluded: ClusterExcluded[]
    k_used: number
    categories_used: string[]
}
