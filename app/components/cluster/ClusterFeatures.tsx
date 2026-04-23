const toLabel = (s: string) =>
    s
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")

export default function ClusterFeatures({ features }: { features: string[] }) {
    return (
        <p className="taglist mt-1">
            {features
                .map((f) => toLabel(f.split(":").slice(1).join(":") || f))
                .join(" · ")}
        </p>
    )
}
