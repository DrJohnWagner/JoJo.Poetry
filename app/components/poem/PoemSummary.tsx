import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
import PoemStatistics from "./PoemStatistics"
import type { PoemSummaryData } from "@/lib/types"
import type { Variant } from "./PoemStatistics"

export default function PoemSummary({
    poem,
    variant = "complete",
}: {
    poem: PoemSummaryData
    variant?: Variant
}) {
    return (
        <div>
            <PoemTitle id={poem.id} title={poem.title} />
            <PoemStatistics poem={poem} variant={variant} />
            <PoemProject project={poem.project} clamp />
        </div>
    )
}
