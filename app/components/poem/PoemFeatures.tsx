import { toSortedLabels } from "@/lib/format"

const PoemFeatures = ({ features }: { features?: string[] }) => {
    if (!features || features.length === 0) return null

    return (
        <div className="text-meta mt-1">
            {toSortedLabels(features).join(" · ")}
        </div>
    )
}

export default PoemFeatures
