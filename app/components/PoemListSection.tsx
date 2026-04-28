import type { PoemSummaryData } from "@/lib/types"
import PoemSummary from "./poem/PoemSummary"

export default function PoemListSection({
    label,
    poems,
}: {
    label: string
    poems: PoemSummaryData[]
}) {
    if (poems.length === 0) return null
    return (
        <section aria-label={`${label} poems`} className="bg-paper/50">
            <h2 className="text-label">{label}</h2>
            <div className="mt-3 space-y-4">
                {poems.map((poem) => (
                    <PoemSummary key={poem.id} poem={poem} variant="abridged" />
                ))}
            </div>
        </section>
    )
}
