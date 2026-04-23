"use client"

import type { Poem } from "@/lib/types"
import PoemEditorForm from "./PoemEditorForm"

export default function PoemRowEditor({
    poem,
    onSaved,
    onCancel,
    onDirtyChange,
    onTitleChange,
}: {
    poem: Poem
    onSaved: (poem: Poem) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
    onTitleChange?: (title: string) => void
}) {
    return (
        <PoemEditorForm
            poem={poem}
            density="compact"
            onSaved={onSaved}
            onCancel={onCancel}
            onDirtyChange={onDirtyChange}
            onTitleChange={onTitleChange}
        />
    )
}
