"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { deletePoem, fetchPoem, fetchPoems } from "@/lib/api"
import type { Poem, PoemSummaryData, SearchState } from "@/lib/types"
import SearchBar from "./PoemSearchBar"
import SortBar, { DEFAULT_SORT, type SortState } from "./PoemSortBar"
import PoemList from "./PoemList"
import ErrorMessage from "../ErrorMessage"

const EMPTY: SearchState = {
    q: "",
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
    const [search, setSearch] = useState<SearchState>(EMPTY)
    const [items, setItems] = useState<PoemSummaryData[]>(initial)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [loadedPoems, setLoadedPoems] = useState<Record<string, Poem>>({})

    const editingIdRef = useRef<string | null>(null)
    useEffect(() => {
        editingIdRef.current = editingId
    }, [editingId])

    const dirtyRef = useRef(false)
    useEffect(() => {
        dirtyRef.current = dirty
    }, [dirty])

    function confirmDiscard(reason: string): boolean {
        if (!dirtyRef.current) return true
        return window.confirm(`Discard unsaved changes? (${reason})`)
    }

    const searchRef = useRef(search)
    useEffect(() => {
        searchRef.current = search
    }, [search])

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

    const applyUpdated = useCallback(
        (updated: Poem, previous: PoemSummaryData) => {
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
        },
        [refetchFromTop]
    )

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
                    applyUpdated(updated, previous)
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
                {loading && (
                    <span className="label-text text-muted">Loading…</span>
                )}
                <ErrorMessage message={err} className="text-sm inline" />
            </div>
        </div>
    )
}
