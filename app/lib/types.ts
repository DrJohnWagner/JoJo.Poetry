export type UUID = string

export interface FontOption {
    filename: string
    label: string
}

export interface FilterOption {
    name: string
    image: string
}

export type Placement =
    | "top-left"
    | "top"
    | "top-right"
    | "left"
    | "centre"
    | "right"
    | "bottom-left"
    | "bottom"
    | "bottom-right"

export interface TextSpecification {
    colour: string // resolved hex, e.g. "#ffffff"
    font: string // filename stem relative to fonts/, e.g. EB_Garamond/EBGaramond-Regular
    size: number
    location: Placement
    margin: number
    filter_first?: boolean
}

export interface SocialCostEstimate {
    input_tokens: number
    output_tokens: number
    cached_input_tokens: number
    cache_creation_input_tokens: number
    image_input_tokens: number
    image_output_tokens: number
    input_cost_usd: number
    output_cost_usd: number
    cached_input_cost_usd: number
    cache_creation_input_cost_usd: number
    image_input_cost_usd: number
    image_output_cost_usd: number
    total_cost_usd: number
}

export interface SocialGenerateRequest {
    poem_id: UUID
    filter?: string
    text?: TextSpecification
}

export interface SocialGenerateResponse {
    excerpt: string
    prompt: string
    alt_text: string
    is_adult: boolean
    image_url: string
    cost: SocialCostEstimate | null
}

export interface SocialUpdateRequest {
    poem_id: UUID
    filter: string
    excerpt?: string
    text?: TextSpecification
}

export interface SocialImageResponse {
    image_url: string
    cost: SocialCostEstimate | null
}

export interface SocialRegenerateRequest {
    poem_id: UUID
    prompt: string
    excerpt?: string
    filter?: string
    text?: TextSpecification
}

export interface SocialPostRequest {
    poem_id: UUID
    filter: string
    excerpt?: string
    text?: TextSpecification
    alt_text: string
    is_adult: boolean
}

export interface SocialPostResponse {
    socials: string[]
    errors: string[]
}

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
    themes: string[]
    // Client-only: not in the API response; merged from localStorage by fetchPoems.
    pinned: boolean
}

export interface ClusterPoem extends PoemSummaryData {
    moods: string[]
    poetic_forms: string[]
    techniques: string[]
    tones_voices: string[]
}

export interface Poem extends ClusterPoem {
    author?: Author
    url: string
    body: string
    notes: string[]
    socials: string[]
    // moods: string[]
    // poetic_forms: string[]
    // techniques: string[]
    // tones_voices: string[]
    contest_fit: string[]
    key_images: string[]
}

export interface PoemSummaryDataList {
    items: PoemSummaryData[]
}

/** Filters that drive BOTH the simple and the advanced search calls. */
export interface SearchState {
    q: string
    themes: string[]
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
        s.themes.length > 0 ||
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
