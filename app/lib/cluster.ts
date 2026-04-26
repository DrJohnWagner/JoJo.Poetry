import type { Poem, ClusterPoem } from "@/lib/types"
import { toSortedLabels } from "./format"

export type ClusterGroup =
    | "themes"
    | "moods"
    | "poetic_forms"
    | "techniques"
    | "tones_voices"

export const getGroups = (p: Poem | ClusterPoem) => {
    return [
        p.themes,
        p.moods,
        p.poetic_forms,
        p.techniques,
        p.tones_voices,
    ]
}

export const getFeatures = (groups: Array<Array<string>>) => groups.flat()

export const getFeatureLabels = (
    p: Poem | ClusterPoem,
    selected?: readonly ClusterGroup[]
) => {
    const groups = selected?.length
        ? selected.map((group) => p[group])
        : getGroups(p)
    return toSortedLabels(getFeatures(groups))
}
