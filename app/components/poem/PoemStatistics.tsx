import type { PoemSummaryData } from "@/lib/types"
import { formatDate } from "@/lib/format"

export type Variant = "complete" | "abridged"

export default function PoemStatistics({
    poem,
    variant = "complete",
}: {
    poem: PoemSummaryData
    variant?: Variant
}) {
    const awardCount = poem.awards.length
    const complete = variant === "complete"
    return (
        <div className="poem-statistics-text mt-1 flex flex-wrap gap-x-1 gap-y-1">
            {complete && (
                <>
                    <span>{formatDate(poem.date)}</span>
                    <span>·</span>
                </>
            )}
            <span>{poem.lines} lines</span>
            <span>·</span>
            <span>{poem.words} words</span>
            {complete && awardCount > 0 && (
                <>
                    <span>·</span>
                    <span>
                        {awardCount} {awardCount === 1 ? "medal" : "medals"}
                    </span>
                </>
            )}
            <span>·</span>
            <span>Rating: {poem.rating}</span>
        </div>
    )
}
