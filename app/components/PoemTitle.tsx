import Link from "next/link"
import type { Poem, PoemSummary } from "@/lib/types"

export default function PoemTitle({
    poem,
    link,
}: {
    poem: Poem | PoemSummary
    link: boolean
}) {
    return (
        <h2 className="font-display text-2xl leading-snug tracking-tight">
            {link ? (
                <Link
                    href={`/poems/${poem.id}`}
                    className="text-ink no-underline hover:text-accent"
                >
                    {poem.title}
                </Link>
            ) : (
                poem.title
            )}
        </h2>
    )
}
