"use client"

import { useState } from "react"
import type { Poem } from "@/lib/types"
import { useAppConfig } from "./AppConfig"
import PoemStatistics from "./PoemStatistics"
import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
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
    poem: Poem
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

    if (editing) {
        return (
            <article>
                <PoemRowEditor
                    poem={poem}
                    onSaved={onSaved}
                    onCancel={onCancel}
                    onDirtyChange={onDirtyChange}
                />
            </article>
        )
    }

    return (
        <article>
            <PoemTitle poem={poem} link={true} onPinChange={onPinChanged} />
            <PoemStatistics poem={poem} />
            <PoemProject poem={poem} />
            <div className="mt-3">
                <button onClick={() => setBodyOpen((o) => !o)} className="eyebrow hover:text-ink">
                    {bodyOpen ? "Hide poem" : "Show poem"}
                </button>
                {bodyOpen && (
                    <div className="mt-4">
                        <PoemBody body={poem.body} />
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
                        className={armedDelete ? "text-red-700" : "hover:text-ink"}
                    >
                        {armedDelete ? "confirm delete" : "delete"}
                    </button>
                </div>
            )}
        </article>
    )
}
