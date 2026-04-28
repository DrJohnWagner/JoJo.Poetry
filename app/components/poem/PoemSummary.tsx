import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
import PoemStatistics from "./PoemStatistics"
import PoemFeatures from "./PoemFeatures"
import PoemContestTooltip from "./PoemContestTooltip"
import type { PoemSummaryData } from "@/lib/types"
import type { Variant } from "./PoemStatistics"

export default function PoemSummary({
    poem,
    features,
    variant = "complete",
    pinned,
    onPinChange,
    showAwards = false,
}: {
    poem: PoemSummaryData
    features?: string[]
    variant?: Variant
    pinned?: boolean
    onPinChange?: (pinned: boolean) => void
    showAwards?: boolean
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
            {showAwards && poem.awards.length > 0 && (
                <div className="mt-1 flex flex-row gap-1">
                    {[...poem.awards]
                        .sort(
                            (a, b) =>
                                new Date(b.closed).getTime() -
                                new Date(a.closed).getTime()
                        )
                        .map((a) => (
                            <PoemContestTooltip key={a.url} award={a} />
                        ))}
                </div>
            )}
        </div>
    )
}
