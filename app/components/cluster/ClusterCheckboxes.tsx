import { toLabel } from "@/lib/format"
import type { ClusterGroup } from "@/lib/cluster"

// Missing: "poetic_forms",
export const CLUSTER_GROUPS = [
    "themes",
    "moods",
    "techniques",
    "tones_voices",
] as const satisfies readonly ClusterGroup[]

export default function ClusterCheckboxes({
    selected,
    toggle,
}: {
    selected: ClusterGroup[]
    toggle: (cat: ClusterGroup) => void
}) {
    return (
        <div>
            <p className="eyebrow">Cluster by:</p>
            <ul className="mt-3 flex w-auto flex-wrap items-center gap-x-4 gap-y-2">
                {CLUSTER_GROUPS.map((group) => (
                    <li key={group}>
                        <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={selected.includes(group)}
                                onChange={() => toggle(group)}
                                className="accent-ink"
                            />
                            {toLabel(group)}
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    )
}
