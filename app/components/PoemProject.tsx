import type { Poem, PoemSummary } from "@/lib/types"

export default function PoemProject({ poem }: { poem: Poem | PoemSummary }) {
    if (!poem.project) return null
    return (
        <p className="mt-3 italic leading-normal text-ink/90">
            {poem.project}
        </p>
    )
}
