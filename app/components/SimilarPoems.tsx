import type { NeighbourListResult, SimilarityBundle } from "@/lib/types"
import PoemSummary from "@/components/PoemSummary"

const CATEGORIES: { key: keyof SimilarityBundle; label: string }[] = [
    { key: "overall",  label: "Overall" },
    { key: "theme",    label: "Theme" },
    { key: "form",     label: "Form & Craft" },
    { key: "emotion",  label: "Emotion" },
    { key: "imagery",  label: "Imagery" },
]

function NeighbourList({ result, label }: { result: NeighbourListResult; label: string }) {
    if (result.neighbours.length === 0) return null
    return (
        <section aria-label={`${label} similar poems`} className="p-4 bg-paper/50 rounded border border-ink/10">
            <h2 className="eyebrow mb-4">{label}</h2>
            <ul className="space-y-4">
                {result.neighbours.map((n) => (
                    <PoemSummary key={n.id} id={String(n.id)} title={n.title} project={n.project} />
                ))}
            </ul>
        </section>
    )
}

export default function SimilarPoems({ bundle }: { bundle: SimilarityBundle }) {
    const hasAny = CATEGORIES.some((c) => bundle[c.key].neighbours.length > 0)
    if (!hasAny) return null
    return (
        <div className="space-y-6">
            <h2 className="eyebrow text-center">Similar Poems</h2>
            {CATEGORIES.map(({ key, label }) => (
                <NeighbourList key={key} result={bundle[key]} label={label} />
            ))}
        </div>
    )
}
