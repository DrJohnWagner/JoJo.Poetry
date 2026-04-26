import { toLabel } from "@/lib/format"

export default function ClusterFeatures({ features }: { features: string[] }) {
    return (
        <span className="cluster-features-text mt-1">
            {features
                .map((f) => toLabel(f.split(":").slice(1).join(":") || f))
                .join(" · ")}
        </span>
    )
}
