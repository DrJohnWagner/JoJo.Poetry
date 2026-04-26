import type { ClusterResponse } from "@/lib/types"
import PoemListSection from "./PoemListSection"
import { toLabel } from "@/lib/format"

export default function TopClusteredPoems({
    result,
}: {
    result: ClusterResponse
}) {
    const groups = result.clusters
        .map((cluster) => ({
            key: cluster.label,
            label: toLabel(cluster.label),
            poems: cluster.poems.slice(0, 1),
        }))
        .filter((group) => group.poems.length > 0)

    if (!groups.length) return null

    return (
        <div className="space-y-6">
            <h2 className="label-text text-center">
                Top-Rated Clustered Poems
            </h2>
            {groups.map(({ key, label, poems }) => (
                <PoemListSection key={key} label={label} poems={poems} />
            ))}
        </div>
    )
}