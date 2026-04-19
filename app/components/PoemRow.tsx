"use client"

import { useState } from "react"
import type { Poem, PoemSummary } from "@/lib/types"
import { useAppConfig } from "./AppConfig"
import { fetchPoem } from "@/lib/api"
import PoemStatistics from "./PoemStatistics"
import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
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
    const { readOnly } = useAppConfig()
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
                <div className="flex-1">
                    <PoemTitle poem={poem} link={true} />
                </div>
                <PinToggle
                    id={poem.id}
                    initialPinned={poem.pinned}
                    onChange={onPinChanged}
                />
            </div>
            <PoemStatistics poem={poem} />
            <PoemProject poem={poem} />
            <div className="mt-3">
                <button onClick={toggleBody} className="eyebrow hover:text-ink">
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
            {!readOnly && (
                <div className="mt-4 flex items-center gap-5 font-sans text-[0.76rem] uppercase tracking-wider2 text-muted">
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
                        className={
                            armedDelete ? "text-red-700" : "hover:text-ink"
                        }
                    >
                        {armedDelete ? "confirm delete" : "delete"}
                    </button>
                </div>
            )}
        </article>
    )
}
