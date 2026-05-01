import type { Poem } from "@/lib/types"

export default function PoemNotes({ poem }: { poem: Pick<Poem, "notes"> }) {
    return (
        <ul className="space-y-1 text-meta">
            {poem.notes.map((n) => (
                <li key={n}>{n}</li>
            ))}
        </ul>
    )
}