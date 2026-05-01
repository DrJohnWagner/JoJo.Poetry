"use client"

import Link from "next/link"
import PinToggle from "../PinToggle"
import CopyButton from "../CopyButton"
import { poemToMarkdown } from "@/lib/format"

export default function PoemTitle({
    id,
    title,
    link = true,
    pinned,
    onPinChange,
}: {
    id: string
    title: string
    link?: boolean
    pinned?: boolean
    onPinChange?: (pinned: boolean) => void
}) {
    const hasPinToggle = onPinChange !== undefined
    const HeadingTag = hasPinToggle ? "h2" : "h4"
    const headingSizeClass = hasPinToggle
        ? "text-title-lg"
        : "text-title-sm"
    const titleContent = link ? (
        <Link href={`/poems/${id}`} className="text-title-link">
            {title}
        </Link>
    ) : (
        title
    )

    return (
        <div className="flex items-baseline justify-between gap-6">
            <div className="flex flex-1 items-baseline gap-3">
                <HeadingTag className={`text-title ${headingSizeClass}`}>
                    {titleContent}
                </HeadingTag>
                {hasPinToggle && (
                    <CopyButton
                        getText={() => poemToMarkdown(id, false)}
                        variant="outline"
                    />
                )}
                {hasPinToggle && (
                    <CopyButton
                        getText={() => poemToMarkdown(id, true)}
                        variant="filled"
                    />
                )}
            </div>
            {hasPinToggle && (
                <PinToggle
                    id={id}
                    initialPinned={pinned}
                    onChange={onPinChange}
                />
            )}
        </div>
    )
}
