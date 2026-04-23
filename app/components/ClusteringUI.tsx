"use client"

import { useEffect, useState } from "react"
import { fetchClusters } from "@/lib/api"
import type { ClusterPoem, ClusterResponse, Poem } from "@/lib/types"
import PoemList from "./PoemList"
import ClusterCheckboxes from "./cluster/ClusterCheckboxes"
import ClusterFeatures from "./cluster/ClusterFeatures"
import ClusterHeader from "./cluster/ClusterHeader"
import ClusterLabel from "./cluster/ClusterLabel"
import PoemTitle from "./poem/PoemTitle"
import PoemProject from "./poem/PoemProject"
import { getFeatureLabels } from "@/lib/cluster"

function PoemItem({
    poem,
    onPinnedChange,
}: {
    poem: ClusterPoem
    onPinnedChange: (poemId: string, pinned: boolean) => void
}) {
    return (
        <li key={poem.id}>
            <PoemTitle
                id={poem.id}
                title={poem.title}
                pinned={poem.pinned}
                onPinChange={(next) => onPinnedChange(poem.id, next)}
            />
            {poem.project && <PoemProject project={poem.project} />}
            {getFeatureLabels(poem).length > 0 && (
                <p className="taglist mt-1">
                    {getFeatureLabels(poem).join(" · ")}
                </p>
            )}
        </li>
    )
}
export default function ClusteringUI({
    initial,
}: {
    initial: { items: Poem[]; total: number; has_more: boolean }
}) {
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<ClusterResponse | null>(null)

    function toggle(cat: string) {
        setSelected((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        )
    }

    function handlePinnedChange(poemId: string, pinned: boolean) {
        setResult((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                clusters: prev.clusters.map((cluster) => ({
                    ...cluster,
                    poems: cluster.poems.map((poem) =>
                        poem.id === poemId ? { ...poem, pinned } : poem
                    ),
                })),
            }
        })
    }

    useEffect(() => {
        if (selected.length === 0) return

        let cancelled = false

        async function run() {
            setLoading(true)
            setError(null)
            setResult(null)
            try {
                const next = await fetchClusters(selected)
                if (!cancelled) setResult(next)
            } catch (e) {
                if (!cancelled) {
                    setResult(null)
                    setError(e instanceof Error ? e.message : "Request failed")
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [selected])

    const totalPoems = result
        ? result.clusters.reduce((s, c) => s + c.size, 0)
        : 0

    return (
        <section>
            <div className="mb-6">
                <ClusterCheckboxes selected={selected} toggle={toggle} />
            </div>
            {selected.length === 0 && <PoemList poems={initial.items} />}

            {/* Placeholder
            {selected.length > 0 && !result && !loading && !error && (
                <p className="mt-10 font-sans text-sm text-muted">
                    Select one or more categories to cluster automatically.
                </p>
            )} */}

            {/* Error */}
            {error && (
                <p className="mt-8 font-sans text-sm text-red-700">{error}</p>
            )}

            {/* Results */}
            {result && (
                <>
                    <div className="rule mb-6 mt-8" />

                    {/* Summary */}
                    <ClusterHeader result={result} totalPoems={totalPoems} />

                    {/* Clusters */}
                    <div className="mt-8 space-y-10">
                        {result.clusters.map((cluster, i) => (
                            <div key={i}>
                                <ClusterLabel cluster={cluster} />
                                {cluster.features.length > 0 && (
                                    <ClusterFeatures
                                        features={cluster.features}
                                    />
                                )}
                                <ul className="mt-4 space-y-5">
                                    {cluster.poems.map((p) => (
                                        <PoemItem
                                            key={p.id}
                                            poem={p}
                                            onPinnedChange={handlePinnedChange}
                                        />
                                    ))}
                                </ul>
                                {i < result.clusters.length - 1 && (
                                    <div className="rule mb-6 mt-8" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Excluded */}
                    {result.excluded.length > 0 && (
                        <div className="mt-10">
                            <div className="rule mb-6" />
                            <p className="eyebrow mb-4">
                                Unclustered — cluster too small
                            </p>
                            <ul className="space-y-3">
                                {result.excluded.map((e) => (
                                    <li key={String(e.id)}>
                                        <PoemTitle id={e.id} title={e.title} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
