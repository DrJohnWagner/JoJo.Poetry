import { toSortedLabels } from "@/lib/format"

const PoemFeatures = ({
    features,
    className = "",
}: {
    features?: string[]
    className?: string
}) => {
    if (!features || features.length === 0) return null

    return (
        <div className={`text-meta ${className}`}>
            {toSortedLabels(features).join(" · ")}
        </div>
    )
}

export default PoemFeatures
