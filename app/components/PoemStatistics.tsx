import type { Poem } from "@/lib/types"
import { formatDate } from "@/lib/format"

export default function PoemStatistics({ poem }: { poem: Poem }) {
    const awardCount = poem.awards.length
    return (
        <div className="eyebrow mt-1 flex flex-wrap gap-x-1 gap-y-1">
            <span>{formatDate(poem.date)}</span>
            <span>·</span>
            <span>Rating: {poem.rating}</span>
            <span>·</span>
            <span>{poem.lines} lines</span>
            <span>·</span>
            <span>{poem.words} words</span>
            {awardCount > 0 && (
                <>
                    <span>·</span>
                    <span>
                        {awardCount} {awardCount === 1 ? "medal" : "medals"}
                    </span>
                </>
            )}
        </div>
    )
}
