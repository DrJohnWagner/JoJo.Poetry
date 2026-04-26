import type { ClusterResponse } from "@/lib/types"
import { CLUSTER_GROUPS } from "./ClusterCheckboxes"
import { countText, toLabel } from "@/lib/format"

const CATEGORY_LABELS: ReadonlyMap<string, string> = new Map(
    CLUSTER_GROUPS.map((group) => [group, toLabel(group)] as const)
)

export default function ClusterHeader({
    result,
    totalPoems,
}: {
    result: ClusterResponse
    totalPoems: number
}) {
    const categories = result.categories_used
        .map((id) => CATEGORY_LABELS.get(id) ?? id)
        .join(" | ")

    const parts = [
        categories,
        countText(result.clusters.length, "cluster"),
        countText(totalPoems, "poem"),
        result.excluded.length > 0 ? `${result.excluded.length} excluded` : null,
    ].filter(Boolean)

    return <p className="eyebrow">{parts.join(" · ")}</p>
}
