import { toSortedLabels } from "@/lib/format"

const PoemFeatures = ({ features }: { features?: string[] }) => {
    if (!features || features.length === 0) return null

    return (
        <span className="poem-features-text">
            {toSortedLabels(features).join(" · ")}
        </span>
    )
}

export default PoemFeatures
