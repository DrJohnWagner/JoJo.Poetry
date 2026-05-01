import { toLabel } from "@/lib/format"

export default function ClusterFeatures({ features }: { features?: string[] }) {
    if (!features || features.length === 0) return null

    return (
        <span className="text-meta mt-1">
            {features
                .map((f) => toLabel(f.split(":").slice(1).join(":") || f))
                .join(" · ")}
        </span>
    )
}
