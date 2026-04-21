import type { Poem } from "@/lib/types"
import { formatDate } from "@/lib/format"

export default function PoemStatistics({ poem }: { poem: Poem }) {
    const contestCount = poem.contests.length
    return (
        <div className="eyebrow mt-1 flex flex-wrap gap-x-1 gap-y-1">
            <span>{formatDate(poem.date)}</span>
            <span>·</span>
            <span>Rating: {poem.rating}</span>
            <span>·</span>
            <span>{poem.lines} lines</span>
            <span>·</span>
            <span>{poem.words} words</span>
            {contestCount > 0 && (
                <>
                    <span>·</span>
                    <span>
                        {contestCount} {contestCount === 1 ? "medal" : "medals"}
                    </span>
                </>
            )}
        </div>
    )
}
