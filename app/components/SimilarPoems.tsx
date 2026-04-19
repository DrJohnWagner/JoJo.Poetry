import Link from "next/link"
import type { NeighbourListResult } from "@/lib/types"

export default function SimilarPoems({ similarities }: { similarities: NeighbourListResult }) {
    if (!similarities || !similarities.neighbours || similarities.neighbours.length === 0) {
        return null
    }

    return (
        <section aria-label="Similar Poems" className="p-4 bg-paper/50 rounded border border-ink/10">
            <h2 className="eyebrow mb-4">Similar Poems</h2>
            <ul className="space-y-4">
                {similarities.neighbours.map(neighbour => (
                    <li key={neighbour.id}>
                        <Link href={`/poems/${neighbour.id}`} className="block group">
                            <h3 className="font-serif text-[1rem] leading-tight text-ink group-hover:text-accent group-hover:underline">
                                {neighbour.title}
                            </h3>
                            {neighbour.project && (
                                <p className="font-sans text-[0.8rem] text-muted mt-1 truncate">
                                    {neighbour.project}
                                </p>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
