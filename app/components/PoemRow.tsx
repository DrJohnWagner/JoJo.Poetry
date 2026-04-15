"use client"

import Link from "next/link"
import { useState } from "react"
import type { Poem, PoemSummary } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { fetchPoem } from "@/lib/api"
import PinToggle from "./PinToggle"
import PoemBody from "./PoemBody"
import PoemRowEditor from "./PoemRowEditor"

export default function PoemRow({
    poem,
    editing,
    onEdit,
    onCancel,
    onSaved,
    onDirtyChange,
    onDelete,
    onPinChanged,
}: {
    poem: PoemSummary
    editing: boolean
    onEdit: () => void
    onCancel: () => void
    onSaved: (p: Poem) => void
    onDirtyChange: (dirty: boolean) => void
    onDelete: () => void
    onPinChanged: (pinned: boolean) => void
}) {
    const [armedDelete, setArmedDelete] = useState(false)
    const [bodyOpen, setBodyOpen] = useState(false)
    const [body, setBody] = useState<string | null>(null)
    const [bodyLoading, setBodyLoading] = useState(false)

    function toggleBody() {
        if (!bodyOpen && body === null) {
            setBodyLoading(true)
            fetchPoem(poem.id)
                .then((p) => setBody(p.body))
                .finally(() => setBodyLoading(false))
        }
        setBodyOpen((o) => !o)
    }

    if (editing) {
        return (
            <article>
                <PoemRowEditor
                    summary={poem}
                    onSaved={onSaved}
                    onCancel={onCancel}
                    onDirtyChange={onDirtyChange}
                />
            </article>
        )
    }

    return (
        <article>
            <div className="flex items-baseline gap-4">
                <h2 className="font-display text-2xl md:text-[1.7rem] leading-snug tracking-tight flex-1">
                    <Link
                        href={`/poems/${poem.id}`}
                        className="text-ink no-underline hover:text-accent"
                    >
                        {poem.title}
                    </Link>
                </h2>
                <PinToggle
                    id={poem.id}
                    initialPinned={poem.pinned}
                    onChange={onPinChanged}
                />
            </div>
            <div className="eyebrow mt-1">
                {formatDate(poem.date)} · {poem.lines} lines · {poem.words} words · Rating: {poem.rating}
            </div>
            {poem.project && (
                <p className="mt-3 text-[1.08rem] leading-relaxed text-ink/90 italic">
                    {poem.project}
                </p>
            )}
            <div className="mt-3">
                <button
                    onClick={toggleBody}
                    className="eyebrow hover:text-ink"
                >
                    {bodyOpen ? "Hide poem" : "Show poem"}
                </button>
                {bodyOpen && (
                    <div className="mt-4">
                        {bodyLoading ? (
                            <span className="eyebrow text-muted">Loading…</span>
                        ) : body !== null ? (
                            <PoemBody body={body} />
                        ) : null}
                    </div>
                )}
            </div>
            {poem.themes.length > 0 && (
                <p className="taglist mt-3">
                    {poem.themes.slice(0, 6).join(" · ")}
                </p>
            )}
            <div className="mt-4 flex items-center gap-5 font-sans text-[0.72rem] uppercase tracking-wider2 text-muted">
                <button onClick={onEdit} className="hover:text-ink">
                    edit
                </button>
                <button
                    onClick={() => {
                        if (!armedDelete) {
                            setArmedDelete(true)
                            setTimeout(() => setArmedDelete(false), 4000)
                            return
                        }
                        onDelete()
                    }}
                    className={armedDelete ? "text-red-700" : "hover:text-ink"}
                >
                    {armedDelete ? "confirm delete" : "delete"}
                </button>
            </div>
        </article>
    )
}
