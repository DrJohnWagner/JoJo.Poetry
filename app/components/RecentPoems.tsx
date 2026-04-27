import type { PoemSummaryDataList } from "@/lib/types"
import PoemSummary from "@/components/poem/PoemSummary"

export default function RecentPoems({ recent }: { recent: PoemSummaryDataList }) {
    if (!recent.items.length) return null
    return (
        <section aria-label="Recent poems" className="bg-paper/50">
            <h2 className="label-text text-center">Recent Poems</h2>
            <div className="mt-3 space-y-4">
                {recent.items.map((p) => (
                    <PoemSummary key={p.id} poem={p} variant="abridged" />
                ))}
            </div>
        </section>
    )
}
