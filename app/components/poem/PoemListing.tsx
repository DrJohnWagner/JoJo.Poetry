"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { deletePoem, fetchPoems } from "@/lib/api"
import type { Poem, SearchState } from "@/lib/types"
import SearchBar from "../SearchBar"
import SortBar, { DEFAULT_SORT, type SortState } from "../SortBar"
import PoemList from "./PoemList"
import ErrorMessage from "../ErrorMessage"

const PAGE_SIZE = 5
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
    initial: { items: Poem[]; total: number; has_more: boolean }
}) {
    const [search, setSearch] = useState<SearchState>(EMPTY)
    const [items, setItems] = useState<Poem[]>(initial.items)
    const [total, setTotal] = useState(initial.total)
    const [hasMore, setHasMore] = useState(initial.has_more)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const editingIdRef = useRef<string | null>(null)
    // eslint-disable-next-line react-hooks/refs
    editingIdRef.current = editingId
    const dirtyRef = useRef(false)
    // eslint-disable-next-line react-hooks/refs
    dirtyRef.current = dirty

    /** Called when the user would lose unsaved edits. Returns true if
     *  it is safe to proceed (either not dirty, or user confirmed). */
    function confirmDiscard(reason: string): boolean {
        if (!dirtyRef.current) return true
        return window.confirm(`Discard unsaved changes? (${reason})`)
    }

    const searchRef = useRef(search)
    // eslint-disable-next-line react-hooks/refs
    searchRef.current = search

    /** Fetch page 0 for the current search. Used on search change and
     *  after mutations that can move a poem's position (pin/date/delete). */
    const refetchFromTop = useCallback(() => {
        const snapshot = searchRef.current
        const keepEditing = editingIdRef.current
        setLoading(true)
        setErr(null)
        fetchPoems(snapshot, 0, PAGE_SIZE)
            .then((res) => {
                if (searchRef.current !== snapshot) return
                // If the row currently being edited falls out of the refetched
                // window, splice it back onto the front so its editor is not
                // silently destroyed. Unsaved work is never dropped without an
                // explicit user confirmation.
                let items = res.items
                if (keepEditing && !items.some((p) => p.id === keepEditing)) {
                    const anchor = prevItemsRef.current.find(
                        (p) => p.id === keepEditing
                    )
                    if (anchor) items = [anchor, ...items]
                }
                setItems(items)
                setTotal(res.pagination.total)
                setHasMore(res.pagination.has_more)
            })
            .catch((e: Error) => setErr(e.message))
            .finally(() => {
                if (searchRef.current === snapshot) setLoading(false)
            })
    }, [])

    const prevItemsRef = useRef<Poem[]>(items)
    // eslint-disable-next-line react-hooks/immutability, react-hooks/refs
    prevItemsRef.current = items

    // Search changes *never* clobber the editor: the refetch keeps the
    // edited row in the list (see refetchFromTop), and the user decides
    // whether to cancel their draft. The SearchBar debounces free-text
    // updates before they reach this component, so we can refetch
    // immediately whenever the effective search state changes.
    const isFirst = useRef(true)
    useEffect(() => {
        if (isFirst.current) {
            isFirst.current = false
            return
        }
        refetchFromTop()
    }, [search, refetchFromTop])

    const loadMore = useCallback(() => {
        if (loading || !hasMore) return
        const snapshot = searchRef.current
        setLoading(true)
        setErr(null)
        fetchPoems(snapshot, items.length, PAGE_SIZE)
            .then((res) => {
                if (searchRef.current !== snapshot) return
                setItems((prev) => {
                    const existingIds = new Set(prev.map((p) => p.id))
                    const fresh = res.items.filter(
                        (p) => !existingIds.has(p.id)
                    )
                    return [...prev, ...fresh]
                })
                setTotal(res.pagination.total)
                setHasMore(res.pagination.has_more)
            })
            .catch((e: Error) => setErr(e.message))
            .finally(() => {
                if (searchRef.current === snapshot) setLoading(false)
            })
    }, [items.length, loading, hasMore])

    const sentinelRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = sentinelRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMore()
            },
            { rootMargin: "200px" }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [loadMore])

    /** Apply a confirmed Poem update to the current list. Updates in place
     *  when the order-relevant fields are unchanged; otherwise refetches. */
    const applyUpdated = useCallback(
        (updated: Poem, previous: Poem) => {
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
        },
        [refetchFromTop]
    )

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
                onEdit={(p) => {
                    if (editingId && editingId !== p.id) {
                        if (!confirmDiscard(`open editor for "${p.title}"`))
                            return
                    }
                    setDirty(false)
                    setEditingId(p.id)
                }}
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
                    handleDelete(p.id)
                }}
                onPinChanged={(p, pinned) => {
                    if (pinned !== p.pinned) refetchFromTop()
                }}
            />

            <div ref={sentinelRef} className="mt-16 flex items-center gap-6">
                {loading && (
                    <span className="label-text text-muted">Loading…</span>
                )}
                {!hasMore && total > 0 && (
                    <span className="label-text text-muted">
                        End · {total} poem{total === 1 ? "" : "s"}
                    </span>
                )}
                <ErrorMessage message={err} className="text-sm inline" />
            </div>
        </div>
    )
}
