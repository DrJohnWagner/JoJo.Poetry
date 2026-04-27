"use client"

import { useMemo, useState } from "react"
import { deletePoem, fetchPoem } from "@/lib/api"
import type { ClusterResponse, Poem, PoemSummaryData } from "@/lib/types"
import PoemList from "./poem/PoemList"
import ClusterFeatures from "./cluster/ClusterFeatures"
import ClusterHeader from "./cluster/ClusterHeader"
import ClusterLabel from "./cluster/ClusterLabel"
import ClusterList from "./cluster/ClusterList"
import PoemSummary from "./poem/PoemSummary"
import HorizontalRule from "./HorizontalRule"
import ErrorMessage from "./ErrorMessage"
import { type ClusterGroup } from "@/lib/cluster"

export default function ClusteringUI({
    initial,
    selected,
    loading,
    error,
    result,
    onPinnedChange,
}: {
    initial: PoemSummaryData[]
    selected: ClusterGroup[]
    loading: boolean
    error: string | null
    result: ClusterResponse | null
    onPinnedChange: (poemId: string, pinned: boolean) => void
}) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const [dirty, setDirty] = useState(false)
    const [rowError, setRowError] = useState<string | null>(null)
    const [loadedPoems, setLoadedPoems] = useState<Record<string, Poem>>({})
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

    const totalPoems = result
        ? result.clusters.reduce((sum, c) => sum + c.size, 0)
        : 0

    function stopEditing() {
        setDirty(false)
        setEditingId(null)
    }

    function updateLoaded(poem: Poem) {
        setLoadedPoems((prev) => ({ ...prev, [poem.id]: poem }))
    }

    function handlePinChange(id: string, pinned: boolean) {
        onPinnedChange(id, pinned)
        setLoadedPoems((prev) => {
            const target = prev[id] ?? initial.find((p) => p.id === id)
            if (!target) return prev
            return { ...prev, [id]: { ...target, pinned } }
        })
    }

    function confirmDiscard(reason: string): boolean {
        if (!dirty) return true
        return window.confirm(`Discard unsaved changes? (${reason})`)
    }

    async function startEditing(poem: { id: string; title: string }) {
        if (editingId && editingId !== poem.id) {
            if (!confirmDiscard(`open editor for "${poem.title}"`)) return
        }

        setRowError(null)
        setDirty(false)

        let target = loadedPoems[poem.id]
        if (!target) {
            try {
                target = await fetchPoem(poem.id)
                updateLoaded(target)
            } catch (e: unknown) {
                setRowError(e instanceof Error ? e.message : "Failed")
                return
            }
        }

        setEditingTitle(target.title)
        setEditingId(target.id)
    }

    async function handleDelete(id: string, title: string) {
        if (editingId === id && !confirmDiscard(`delete "${title}"`)) return

        setRowError(null)
        try {
            await deletePoem(id)
            setDeletedIds((prev) => new Set([...prev, id]))
            if (editingId === id) stopEditing()
        } catch (e: unknown) {
            setRowError(e instanceof Error ? e.message : "Failed")
        }
    }

    const sortedClusters = useMemo(
        () =>
            result?.clusters.map((cluster) => ({
                ...cluster,
                poems: cluster.poems
                    .filter((p) => !deletedIds.has(p.id))
                    .map((p) => loadedPoems[p.id] ?? p)
                    .sort((a, b) => {
                        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
                        return a.title.localeCompare(b.title)
                    }),
            })) ?? [],
        [result, deletedIds, loadedPoems]
    )

    const displayPoems = useMemo(
        () =>
            initial
                .filter((p) => !deletedIds.has(p.id))
                .map((p) => loadedPoems[p.id] ?? p)
                .sort((a, b) => {
                    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
                    return (
                        new Date(b.date).getTime() -
                            new Date(a.date).getTime() ||
                        a.id.localeCompare(b.id)
                    )
                }),
        [initial.items, deletedIds, loadedPoems]
    )

    return (
        <section>
            {selected.length === 0 && (
                <PoemList
                    poems={displayPoems}
                    editingId={editingId}
                    onEdit={(poem) => void startEditing(poem)}
                    onCancel={stopEditing}
                    onSaved={(updated) => {
                        updateLoaded(updated)
                        onPinnedChange(updated.id, updated.pinned)
                        stopEditing()
                    }}
                    onDirtyChange={setDirty}
                    onDelete={(poem) => void handleDelete(poem.id, poem.title)}
                    onPinChanged={(poem, pinned) =>
                        handlePinChange(poem.id, pinned)
                    }
                />
            )}

            {loading && selected.length > 0 && (
                <p className="mt-10 font-sans text-sm text-muted">
                    Clustering poems...
                </p>
            )}

            <ErrorMessage message={error} className="mt-8 font-sans text-sm" />

            {result && (
                <>
                    <HorizontalRule />
                    <ClusterHeader result={result} totalPoems={totalPoems} />

                    <div className="mt-8 space-y-10">
                        {sortedClusters.map((cluster, i) => (
                            <div key={i}>
                                <ClusterLabel cluster={cluster} />
                                <ClusterFeatures features={cluster.features} />
                                <div className="mt-4">
                                    <ClusterList
                                        poems={cluster.poems}
                                        selected={selected}
                                        editingId={editingId}
                                        editingTitle={editingTitle}
                                        loadedPoems={loadedPoems}
                                        onEdit={(poem) =>
                                            void startEditing(poem)
                                        }
                                        onDelete={(poem) =>
                                            void handleDelete(
                                                poem.id,
                                                poem.title
                                            )
                                        }
                                        onSaved={(updated) => {
                                            updateLoaded(updated)
                                            onPinnedChange(
                                                updated.id,
                                                updated.pinned
                                            )
                                            stopEditing()
                                        }}
                                        onCancel={stopEditing}
                                        onDirtyChange={setDirty}
                                        onTitleChange={setEditingTitle}
                                        onPinChanged={(poem, pinned) =>
                                            handlePinChange(poem.id, pinned)
                                        }
                                    />
                                </div>
                                <HorizontalRule
                                    show={i < result.clusters.length - 1}
                                />
                            </div>
                        ))}
                    </div>

                    <ErrorMessage
                        message={rowError}
                        className="mt-8 font-sans text-sm"
                    />

                    {result.excluded.length > 0 && (
                        <div className="mt-10">
                            <HorizontalRule />
                            <p className="label-text mb-4">
                                Unclustered — cluster too small
                            </p>
                            <div className="space-y-4">
                                {result.excluded.map((e) => (
                                    <PoemSummary
                                        key={String(e.id)}
                                        poem={e}
                                        variant="abridged"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
