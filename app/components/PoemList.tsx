"use client"

import type { Poem } from "@/lib/types"
import PoemRow from "./PoemRow"

interface Props {
    poems: Poem[]
    editingId?: string | null
    onEdit?: (poem: Poem) => void
    onCancel?: () => void
    onSaved?: (updated: Poem, previous: Poem) => void
    onDirtyChange?: (dirty: boolean) => void
    onDelete?: (poem: Poem) => void
    onPinChanged?: (poem: Poem, pinned: boolean) => void
}

export default function PoemList({
    poems,
    editingId = null,
    onEdit,
    onCancel,
    onSaved,
    onDirtyChange,
    onDelete,
    onPinChanged,
}: Props) {
    return (
        <ol className="space-y-8">
            {poems.map((p) => (
                <li key={p.id}>
                    <PoemRow
                        poem={p}
                        editing={editingId === p.id}
                        onEdit={() => onEdit?.(p)}
                        onCancel={() => onCancel?.()}
                        onSaved={(updated) => onSaved?.(updated, p)}
                        onDirtyChange={(d) => onDirtyChange?.(d)}
                        onDelete={() => onDelete?.(p)}
                        onPinChanged={(pinned) => onPinChanged?.(p, pinned)}
                    />
                </li>
            ))}
        </ol>
    )
}
