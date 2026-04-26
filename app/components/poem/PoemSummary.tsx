import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
import PoemStatistics from "./PoemStatistics"
import PoemFeatures from "./PoemFeatures"
import type { PoemSummaryData } from "@/lib/types"
import type { Variant } from "./PoemStatistics"

export default function PoemSummary({
    poem,
    features,
    variant = "complete",
    pinned,
    onPinChange,
}: {
    poem: PoemSummaryData
    features?: string[]
    variant?: Variant
    pinned?: boolean
    onPinChange?: (pinned: boolean) => void
}) {
    return (
        <div>
            <PoemTitle
                id={poem.id}
                title={poem.title}
                pinned={pinned}
                onPinChange={onPinChange}
            />
            <PoemStatistics poem={poem} variant={variant} />
            <PoemProject project={poem.project} clamp />
            <PoemFeatures features={features} />
        </div>
    )
}
