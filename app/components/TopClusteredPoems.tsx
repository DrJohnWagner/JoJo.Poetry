import type { ClusterResponse } from "@/lib/types"
import PoemSummary from "@/components/poem/PoemSummary"
import { toLabel } from "@/lib/format"

type TopClusterGroup = {
    key: string
    label: string
    poems: ClusterResponse["clusters"][number]["poems"]
}

function TopClusterList({
    poems,
    label,
}: {
    poems: TopClusterGroup["poems"]
    label: string
}) {
    if (poems.length === 0) return null
    return (
        <section aria-label={`${label} top clustered poems`} className="bg-paper/50">
            <h2 className="eyebrow">{label}</h2>
            <div className="mt-3 space-y-4">
                {poems.map((poem) => (
                    <PoemSummary key={poem.id} poem={poem} variant="abridged" />
                ))}
            </div>
        </section>
    )
}

export default function TopClusteredPoems({
    result,
}: {
    result: ClusterResponse
}) {
    const groups: TopClusterGroup[] = result.clusters
        .map((cluster) => ({
            key: cluster.label,
            label: toLabel(cluster.label),
            poems: cluster.poems.slice(0, 1),
        }))
        .filter((group) => group.poems.length > 0)

    if (!groups.length) return null

    return (
        <div className="space-y-6">
            <h2 className="eyebrow text-center">Top-Rated Clustered Poems</h2>
            {groups.map(({ key, label, poems }) => (
                <TopClusterList key={key} poems={poems} label={label} />
            ))}
        </div>
    )
}