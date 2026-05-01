"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { deletePoem, fetchPoem, fetchPoems } from "@/lib/api"
import type { Poem, PoemSummaryData, SearchState } from "@/lib/types"
import SearchBar from "./PoemSearchBar"
import SortBar, { DEFAULT_SORT, type SortState } from "./PoemSortBar"
import PoemList from "./PoemList"
import ErrorMessage from "../ErrorMessage"
import LoadingMessage from "../LoadingMessage"

const EMPTY: SearchState = {
    q: "",
    themes: [],
    year: null,
    month: null,
    medals: [],
    title: "",
    body: "",
    project: "",
    notes: "",
}

export default function PoemListing({
    initial,
}: {
    initial: PoemSummaryData[]
}) {
    const searchParams = useSearchParams()
    const [search, setSearch] = useState<SearchState>(EMPTY)
    const [items, setItems] = useState<PoemSummaryData[]>(initial)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [loadedPoems, setLoadedPoems] = useState<Record<string, Poem>>({})

    function confirmDiscard(reason: string): boolean {
        if (!dirty) return true
        return window.confirm(`Discard unsaved changes? (${reason})`)
    }

    const searchRef = useRef(search)
    useEffect(() => {
        searchRef.current = search
    }, [search])

    // Theme links (e.g. /?themes=loss) do a soft Next.js navigation — the component
    // doesn't remount, so a mount-only effect won't fire. useSearchParams() reacts
    // to same-page URL changes, which is what we need.
    //
    // After extracting themes we clean the URL with replaceState so it reverts to /.
    // That triggers another searchParams update (empty). To suppress it without a
    // one-shot skip flag (which React StrictMode's double-invocation consumes early),
    // we pre-set lastProcessedParams to "" — what searchParams.toString() will return
    // after the clean — so the router's feedback arrives already marked as processed.
    const lastProcessedParams = useRef("")
    useEffect(() => {
        const raw = searchParams.toString()
        if (raw === lastProcessedParams.current) return
        lastProcessedParams.current = raw
        if (searchParams.has("reset")) {
            setSearch(EMPTY)
            lastProcessedParams.current = ""
            window.history.replaceState(null, "", "/")
            return
        }
        const themes = searchParams.getAll("themes")
        setSearch((prev) => {
            if (themes.join(",") === prev.themes.join(",")) return prev
            return { ...prev, themes }
        })
        if (themes.length > 0) {
            lastProcessedParams.current = ""
            window.history.replaceState(null, "", "/")
        }
    }, [searchParams])

    const refetchFromTop = useCallback(() => {
        const snapshot = searchRef.current
        setLoading(true)
        setErr(null)
        fetchPoems(snapshot)
            .then((res) => {
                if (searchRef.current !== snapshot) return
                setItems(res.items)
            })
            .catch((e: Error) => setErr(e.message))
            .finally(() => {
                if (searchRef.current === snapshot) setLoading(false)
            })
    }, [])

    const isFirst = useRef(true)
    useEffect(() => {
        if (isFirst.current) {
            isFirst.current = false
            return
        }
        refetchFromTop()
    }, [search, refetchFromTop])

    async function handleEdit(poem: PoemSummaryData) {
        if (editingId && editingId !== poem.id) {
            if (!confirmDiscard(`open editor for "${poem.title}"`)) return
        }
        setDirty(false)
        if (!loadedPoems[poem.id]) {
            setLoading(true)
            try {
                const full = await fetchPoem(poem.id)
                setLoadedPoems((prev) => ({ ...prev, [poem.id]: full }))
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Failed")
                setLoading(false)
                return
            }
            setLoading(false)
        }
        setEditingId(poem.id)
    }

    async function handleDelete(id: string) {
        try {
            await deletePoem(id)
            refetchFromTop()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Failed")
        }
    }

    const sortedItems = useMemo(() => {
        const { field, dir } = sort
        return [...items].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            let cmp: number
            if (field === "title") {
                cmp = a.title.localeCompare(b.title)
            } else if (field === "date") {
                cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
            } else if (field === "award_count") {
                cmp = a.awards.length - b.awards.length
            } else {
                cmp = (a[field] as number) - (b[field] as number)
            }
            return dir === "asc" ? cmp : -cmp
        })
    }, [items, sort])

    return (
        <div>
            <SearchBar value={search} onChange={setSearch} />
            <SortBar sort={sort} onChange={setSort} />

            {items.length === 0 && !loading && (
                <p className="py-8 italic text-muted">No poems match.</p>
            )}

            <PoemList
                poems={sortedItems}
                editingId={editingId}
                loadedPoems={loadedPoems}
                onEdit={(p) => void handleEdit(p)}
                onCancel={() => {
                    setDirty(false)
                    setEditingId(null)
                }}
                onSaved={(updated, previous) => {
                    setDirty(false)
                    const orderChanged =
                        updated.pinned !== previous.pinned ||
                        updated.date !== previous.date
                    setEditingId(null)
                    if (orderChanged) {
                        refetchFromTop()
                        return
                    }
                    setItems((prev) =>
                        prev.map((p) => (p.id === updated.id ? updated : p))
                    )
                    setLoadedPoems((prev) => ({ ...prev, [updated.id]: updated }))
                }}
                onDirtyChange={setDirty}
                onDelete={(p) => {
                    if (!confirmDiscard("delete this poem")) return
                    void handleDelete(p.id)
                }}
                onPinChanged={(p, pinned) => {
                    if (pinned !== p.pinned) refetchFromTop()
                }}
            />

            <div className="mt-16 flex items-center gap-6">
                <LoadingMessage show={loading} />
                <ErrorMessage message={err} className="text-sm inline" />
            </div>
        </div>
    )
}
