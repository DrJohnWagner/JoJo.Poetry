"use client"

import type { Poem } from "@/lib/types"
import PoemEditorForm from "./PoemEditorForm"

export default function PoemRowEditor({
    poem,
    onSaved,
    onCancel,
    onDirtyChange,
}: {
    poem: Poem
    onSaved: (poem: Poem) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
}) {
    return (
        <PoemEditorForm
            poem={poem}
            density="compact"
            onSaved={onSaved}
            onCancel={onCancel}
            onDirtyChange={onDirtyChange}
        />
    )
}
