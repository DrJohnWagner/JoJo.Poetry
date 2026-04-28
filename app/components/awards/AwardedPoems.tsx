import type { PoemSummaryData } from "@/lib/types"
import PoemSummary from "@/components/poem/PoemSummary"

const MEDAL_SCORE: Record<string, number> = {
    "Gold": 4,
    "Silver": 3,
    "Bronze": 2,
    "Honorable Mention": 1,
}

function awardScore(poem: PoemSummaryData): number {
    return poem.awards.reduce((sum, a) => sum + (MEDAL_SCORE[a.medal] ?? 0), 0)
}

export default function AwardedPoems({ poems }: { poems: PoemSummaryData[] }) {
    if (!poems.length) return null

    const sorted = [...poems].sort((a, b) => awardScore(b) - awardScore(a))

    return (
        <section aria-label="Award-winning poems" className="bg-paper/50">
            <h2 className="label-text text-center">Award-Winning Poems</h2>
            <div className="mt-3 space-y-4">
                {sorted.map((p) => (
                    <PoemSummary
                    key={p.id} poem={p} variant="abridged" showAwards={true} />
                ))}
            </div>
        </section>
    )
}
