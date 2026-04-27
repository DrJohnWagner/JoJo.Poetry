"use client"

import { useState } from "react"
import type { Poem, PoemSummaryData } from "@/lib/types"
import { useAppConfig } from "../AppConfig"
import PoemSummary from "./PoemSummary"
import PoemBody from "./PoemBody"
import PoemEditor from "./PoemEditor"
import PoemButtons from "./PoemButtons"

export default function PoemRow({
    poem,
    editPoem,
    editing,
    onEdit,
    onCancel,
    onSaved,
    onDirtyChange,
    onDelete,
    onPinChanged,
}: {
    poem: PoemSummaryData
    editPoem?: Poem
    editing: boolean
    onEdit: () => void
    onCancel: () => void
    onSaved: (p: Poem) => void
    onDirtyChange: (dirty: boolean) => void
    onDelete: () => void
    onPinChanged: (pinned: boolean) => void
}) {
    const { readOnly } = useAppConfig()
    const [liveTitle, setLiveTitle] = useState(poem.title)

    if (editing && editPoem) {
        return (
            <article>
                <p className="label-text mb-4">
                    Editing &middot; &ldquo;{liveTitle.trim() || "(Untitled)"}
                    &rdquo;
                </p>
                <PoemEditor
                    poem={editPoem}
                    density="compact"
                    onSaved={onSaved}
                    onCancel={onCancel}
                    onDirtyChange={onDirtyChange}
                    onTitleChange={setLiveTitle}
                />
            </article>
        )
    }

    return (
        <article>
            <PoemSummary
                poem={poem}
                features={[]}
                pinned={poem.pinned}
                onPinChange={onPinChanged}
            />
            <PoemBody poemId={poem.id} />
            {!readOnly && <PoemButtons onEdit={onEdit} onDelete={onDelete} />}
        </article>
    )
}
