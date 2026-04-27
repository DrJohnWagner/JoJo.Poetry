"use client"

import type { Poem } from "@/lib/types"
import { useAppConfig } from "../AppConfig"
import PoemButtons from "../poem/PoemButtons"
import PoemBody from "../poem/PoemBody"
import PoemSummary from "../poem/PoemSummary"
import PoemEditor from "../poem/PoemEditor"
import { getFeatureLabels, type ClusterGroup } from "@/lib/cluster"

type Props = {
    poem: Poem
    selected: ClusterGroup[]
    editing: boolean
    editingTitle: string
    editPoem?: Poem
    onEdit: () => void
    onDelete: () => void
    onSaved: (updated: Poem) => void
    onCancel: () => void
    onDirtyChange: (dirty: boolean) => void
    onTitleChange: (title: string) => void
    onPinChanged: (pinned: boolean) => void
}

export default function ClusterRow({
    poem,
    selected,
    editing,
    editingTitle,
    editPoem,
    onEdit,
    onDelete,
    onSaved,
    onCancel,
    onDirtyChange,
    onTitleChange,
    onPinChanged,
}: Props) {
    const { readOnly } = useAppConfig()

    if (editing) {
        return (
            <article>
                <p className="label-text mb-4">
                    Editing &middot; &ldquo;{editingTitle.trim() || "(Untitled)"}
                    &rdquo;
                </p>
                <PoemEditor
                    poem={editPoem ?? poem}
                    density="compact"
                    onSaved={onSaved}
                    onCancel={onCancel}
                    onDirtyChange={onDirtyChange}
                    onTitleChange={onTitleChange}
                />
            </article>
        )
    }

    return (
        <article>
            <PoemSummary
                poem={poem}
                features={getFeatureLabels(poem, selected)}
                pinned={poem.pinned}
                onPinChange={onPinChanged}
            />
            <PoemBody poemId={poem.id} />
            {!readOnly && <PoemButtons onEdit={onEdit} onDelete={onDelete} />}
        </article>
    )
}
