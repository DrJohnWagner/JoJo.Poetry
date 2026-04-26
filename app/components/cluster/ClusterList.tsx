"use client"

import type { Poem } from "@/lib/types"
import type { ClusterGroup } from "@/lib/cluster"
import ClusterRow from "./ClusterRow"

interface Props {
    poems: Poem[]
    selected: ClusterGroup[]
    editingId?: string | null
    editingTitle: string
    loadedPoems?: Record<string, Poem>
    onEdit?: (poem: Poem) => void
    onCancel?: () => void
    onSaved?: (updated: Poem, previous: Poem) => void
    onDirtyChange?: (dirty: boolean) => void
    onDelete?: (poem: Poem) => void
    onTitleChange?: (title: string) => void
    onPinChanged?: (poem: Poem, pinned: boolean) => void
}

export default function ClusterList({
    poems,
    selected,
    editingId = null,
    editingTitle,
    loadedPoems,
    onEdit,
    onCancel,
    onSaved,
    onDirtyChange,
    onDelete,
    onTitleChange,
    onPinChanged,
}: Props) {
    return (
        <div className="space-y-5">
            {poems.map((p) => (
                <ClusterRow
                    key={p.id}
                    poem={p}
                    selected={selected}
                    editing={editingId === p.id}
                    editingTitle={editingTitle}
                    editPoem={loadedPoems?.[p.id]}
                    onEdit={() => onEdit?.(p)}
                    onDelete={() => onDelete?.(p)}
                    onSaved={(updated) => onSaved?.(updated, p)}
                    onCancel={() => onCancel?.()}
                    onDirtyChange={(d) => onDirtyChange?.(d)}
                    onTitleChange={(title) => onTitleChange?.(title)}
                    onPinChanged={(pinned) => onPinChanged?.(p, pinned)}
                />
            ))}
        </div>
    )
}
