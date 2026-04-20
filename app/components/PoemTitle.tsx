import Link from "next/link"
import type { Poem, PoemSummary } from "@/lib/types"
import { fetchPoem } from "@/lib/api"
import PinToggle from "./PinToggle"
import CopyButton from "./CopyButton"
import { poemToMarkdown } from "@/lib/format"

export default function PoemTitle({
    poem,
    link,
    onPinChange,
}: {
    poem: Poem | PoemSummary
    link: boolean
    onPinChange?: (pinned: boolean) => void
}) {
    const getText = "body" in poem
        ? () => Promise.resolve(poemToMarkdown(poem))
        : () => fetchPoem(poem.id).then(poemToMarkdown)

    return (
        <div className="flex items-baseline justify-between gap-6">
            <div className="flex items-baseline gap-3 flex-1">
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
                <CopyButton getText={getText} />
            </div>
            <PinToggle
                id={poem.id}
                initialPinned={poem.pinned}
                onChange={onPinChange}
            />
        </div>
    )
}
