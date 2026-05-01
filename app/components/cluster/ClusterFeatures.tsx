import { toLabel } from "@/lib/format"

const stripGroupPrefix = (f: string) => f.split(":").slice(1).join(":") || f

export default function ClusterFeatures({ features }: { features?: string[] }) {
    if (!features || features.length === 0) return null

    return (
        <span className="text-meta mt-1">
            {features.map((f) => toLabel(stripGroupPrefix(f))).join(" · ")}
        </span>
    )
}
