"use client"

import { useState } from "react"
import type { Poem } from "@/lib/types"
import { useAppConfig } from "../AppConfig"
import PoemSummary from "./PoemSummary"
import PoemBody from "./PoemBody"
import PoemEditor from "./PoemEditor"
import PoemButtons from "./PoemButtons"

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
    const [bodyOpen, setBodyOpen] = useState(false)
    const [liveTitle, setLiveTitle] = useState(poem.title)

    if (editing) {
        return (
            <article>
                <p className="label-text mb-4">
                    Editing &middot; &ldquo;{liveTitle.trim() || "(Untitled)"}
                    &rdquo;
                </p>
                <PoemEditor
                    poem={poem}
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
                features={poem.themes}
                pinned={poem.pinned}
                onPinChange={onPinChanged}
            />
            <PoemBody
                body={poem.body}
                open={bodyOpen}
                onOpenChange={setBodyOpen}
            />
            {!readOnly && <PoemButtons onEdit={onEdit} onDelete={onDelete} />}
        </article>
    )
}
