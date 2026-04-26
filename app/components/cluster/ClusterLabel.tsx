import type { ClusterItem } from "@/lib/types"
import { toLabel } from "@/lib/format"

export default function ClusterLabel({ cluster }: { cluster: ClusterItem }) {
    return (
        <div className="flex items-baseline gap-3">
            <h3 className="font-serif text-[1.1rem] font-semibold uppercase leading-tight">
                {toLabel(cluster.label)}
            </h3>
            <span className="label-text">
                {cluster.size} {cluster.size === 1 ? "poem" : "poems"}
            </span>
        </div>
    )
}
