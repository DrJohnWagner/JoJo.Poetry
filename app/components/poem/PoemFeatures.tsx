import { toSortedLabels } from "@/lib/format"

const PoemFeatures = ({ features }: { features: string[] }) => {
    return (
        <span className="poem-features-text">
            {toSortedLabels(features).join(" · ")}
        </span>
    )
}

export default PoemFeatures
