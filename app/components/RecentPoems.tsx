import type { RecentList } from "@/lib/types"
import PoemSummary from "@/components/PoemSummary"

export default function RecentPoems({ recent }: { recent: RecentList }) {
    if (!recent.items.length) return null
    return (
        <section aria-label="Recent poems" className="p-4 bg-paper/50 rounded border border-ink/10">
            <h2 className="eyebrow mb-4 text-center">Recent Poems</h2>
            <ul className="space-y-4">
                {recent.items.map((p) => (
                    <PoemSummary key={p.id} id={String(p.id)} title={p.title} project={p.project} />
                ))}
            </ul>
        </section>
    )
}
