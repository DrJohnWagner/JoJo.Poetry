import type { ClusterResponse, FilterOption, FontOption, Poem, PoemSummaryData, PoemSummaryDataList, SearchState, SimilarityBundle, SocialGenerateRequest, SocialGenerateResponse, SocialImageResponse, SocialPostRequest, SocialPostResponse, SocialRegenerateRequest, SocialUpdateRequest } from './types'
import { hasAdvanced } from "./types"
import { getPins } from "./pins"

const SERVER_BASE =
    process.env.API_BASE_URL_SERVER?.replace(/\/$/, "") ||
    "http://localhost:8000"

const CLIENT_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    ""

const BASE = typeof window === "undefined" ? SERVER_BASE : CLIENT_BASE

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
        cache: "no-store",
    })
    if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`
        try {
            const body = await res.json()
            if (body?.detail)
                detail =
                    typeof body.detail === "string"
                        ? body.detail
                        : JSON.stringify(body.detail)
        } catch {}
        throw new Error(detail)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
}

function buildListQuery(s: SearchState): string {
    const p = new URLSearchParams()
    if (s.q.trim()) p.set("q", s.q.trim())
    for (const t of s.themes) p.append("themes", t)
    return p.toString()
}

function buildAdvancedQuery(s: SearchState): string {
    const p = new URLSearchParams()
    if (s.q.trim()) p.set("q", s.q.trim())
    for (const t of s.themes) p.append("themes", t)
    if (s.year !== null) p.set("year", String(s.year))
    if (s.month !== null) p.set("month", String(s.month))
    for (const a of s.medals) p.append("medals", a)
    if (s.title.trim()) p.set("title", s.title.trim())
    if (s.body.trim()) p.set("body", s.body.trim())
    if (s.project.trim()) p.set("project", s.project.trim())
    if (s.notes.trim()) p.set("notes", s.notes.trim())
    return p.toString()
}

function mergePins(list: PoemSummaryDataList): PoemSummaryDataList {
    if (typeof window === "undefined") return list
    const pins = getPins()
    return { items: list.items.map((p) => ({ ...p, pinned: pins.has(p.id) })) }
}

export async function fetchPoems(s: SearchState): Promise<PoemSummaryDataList> {
    if (hasAdvanced(s)) {
        const result = await req<PoemSummaryDataList>(`/api/poems/search?${buildAdvancedQuery(s)}`)
        return mergePins(result)
    }
    const qs = buildListQuery(s)
    const result = await req<PoemSummaryDataList>(`/api/poems${qs ? `?${qs}` : ""}`)
    return mergePins(result)
}

export function fetchPoem(id: string): Promise<Poem> {
    return req<Poem>(`/api/poems/${encodeURIComponent(id)}`)
}

export function createPoem(payload: Record<string, unknown>): Promise<Poem> {
    return req<Poem>(`/api/poems`, {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

export function patchPoem(id: string, updates: Partial<Poem>): Promise<Poem> {
    return req<Poem>(`/api/poems/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    })
}

export function deletePoem(id: string): Promise<void> {
    return req<void>(`/api/poems/${encodeURIComponent(id)}`, {
        method: "DELETE",
    })
}

export function fetchRecentPoems(k: number = 12): Promise<PoemSummaryDataList> {
    return req<PoemSummaryDataList>(`/api/poems/recent?k=${k}`)
}

export function fetchSimilarPoems(id: string): Promise<SimilarityBundle> {
    return req<SimilarityBundle>(`/api/poems/${encodeURIComponent(id)}/similar`)
}

export function fetchAwardedPoems(): Promise<PoemSummaryDataList> {
    return req<PoemSummaryDataList>("/api/poems/awards")
}

export function fetchAuthor(): Promise<{ pen_name: string; full_name: string }> {
    return req<{ pen_name: string; full_name: string }>("/api/author", {
        cache: "force-cache",
    })
}

export function fetchFeatures(group: string): Promise<string[]> {
    return req<string[]>(`/api/features/${encodeURIComponent(group)}`)
}

export function fetchClusters(categories: string[]): Promise<ClusterResponse> {
    return req<ClusterResponse>("/api/poems/cluster", {
        method: "POST",
        body: JSON.stringify({ categories }),
    })
}

export function socialFilters(): Promise<FilterOption[]> {
    return req<FilterOption[]>("/api/socials/filters")
}

export function socialFonts(): Promise<FontOption[]> {
    return req<FontOption[]>("/api/socials/fonts")
}

export function socialGenerate(data: SocialGenerateRequest): Promise<SocialGenerateResponse> {
    return req<SocialGenerateResponse>("/api/socials/generate", {
        method: "POST",
        body: JSON.stringify(data),
    })
}

export function socialUpdate(data: SocialUpdateRequest): Promise<SocialImageResponse> {
    return req<SocialImageResponse>("/api/socials/update", {
        method: "POST",
        body: JSON.stringify(data),
    })
}

export function socialRegenerate(data: SocialRegenerateRequest): Promise<SocialImageResponse> {
    return req<SocialImageResponse>("/api/socials/regenerate", {
        method: "POST",
        body: JSON.stringify(data),
    })
}

export function socialPost(data: SocialPostRequest): Promise<SocialPostResponse> {
    return req<SocialPostResponse>("/api/socials/post", {
        method: "POST",
        body: JSON.stringify(data),
    })
}

export type { PoemSummaryData }
