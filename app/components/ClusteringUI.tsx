"use client"

import type { ClusterPoem, ClusterResponse, Poem } from "@/lib/types"
import PoemList from "./PoemList"
import ClusterFeatures from "./cluster/ClusterFeatures"
import ClusterHeader from "./cluster/ClusterHeader"
import ClusterLabel from "./cluster/ClusterLabel"
import PoemTitle from "./poem/PoemTitle"
import PoemSummary from "./poem/PoemSummary"
import PoemStatistics from "./poem/PoemStatistics"
import PoemProject from "./poem/PoemProject"
import PoemFeatures from "./poem/PoemFeatures"
import { getFeatureLabels, type ClusterGroup } from "@/lib/cluster"

function PoemItem({
    poem,
    selected,
    onPinnedChange,
}: {
    poem: ClusterPoem
    selected: ClusterGroup[]
    onPinnedChange: (poemId: string, pinned: boolean) => void
}) {
    const featureLabels = getFeatureLabels(poem, selected)

    return (
        <li key={poem.id}>
            <PoemTitle
                id={poem.id}
                title={poem.title}
                pinned={poem.pinned}
                onPinChange={(next) => onPinnedChange(poem.id, next)}
            />
            <PoemStatistics poem={poem} />
            {poem.project && <PoemProject project={poem.project} />}
            <PoemFeatures features={featureLabels} />
        </li>
    )
}
export default function ClusteringUI({
    initial,
    selected,
    loading,
    error,
    result,
    onPinnedChange,
}: {
    initial: { items: Poem[]; total: number; has_more: boolean }
    selected: ClusterGroup[]
    loading: boolean
    error: string | null
    result: ClusterResponse | null
    onPinnedChange: (poemId: string, pinned: boolean) => void
}) {
    const totalPoems = result
        ? result.clusters.reduce((sum, cluster) => sum + cluster.size, 0)
        : 0

    return (
        <section>
            {selected.length === 0 && <PoemList poems={initial.items} />}

            {loading && selected.length > 0 && (
                <p className="mt-10 font-sans text-sm text-muted">
                    Clustering poems...
                </p>
            )}

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
                                            selected={selected}
                                            onPinnedChange={onPinnedChange}
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
