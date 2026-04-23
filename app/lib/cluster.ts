import type { ClusterPoem } from "@/lib/types"
import { toLabel } from "./format"

export const getGroups = (p: ClusterPoem) => {
    return [
        p.themes,
        p.emotional_registers,
        p.formal_modes,
        p.craft_features,
        p.stylistic_postures,
    ]
}

export const getFeatures = (groups: Array<Array<string>>) => groups.flat()

export const getFeatureLabels = (p: ClusterPoem) => {
    return getFeatures(getGroups(p)).map(toLabel)
}
