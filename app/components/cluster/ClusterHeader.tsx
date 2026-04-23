import type { ClusterResponse } from "@/lib/types"
import { CLUSTER_GROUPS } from "./ClusterCheckboxes"

const CATEGORY_LABELS: ReadonlyMap<string, string> = new Map(
    CLUSTER_GROUPS.map((g) => [g.id, g.label] as const)
)

const countText = (n: number, singular: string, plural = `${singular}s`) =>
    `${n} ${n === 1 ? singular : plural}`

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
