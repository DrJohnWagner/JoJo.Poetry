import type { Poem } from "@/lib/types"

export default function PoemProject({ poem }: { poem: Poem }) {
    if (!poem.project) return null
    return (
        <p className="mt-3 italic leading-normal text-ink/90">
            {poem.project}
        </p>
    )
}
