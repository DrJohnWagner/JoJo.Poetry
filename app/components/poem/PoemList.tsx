"use client"

import type { Poem, PoemSummaryData } from "@/lib/types"
import PoemRow from "./PoemRow"

interface Props {
    poems: PoemSummaryData[]
    editingId?: string | null
    loadedPoems?: Record<string, Poem>
    onEdit?: (poem: PoemSummaryData) => void
    onCancel?: () => void
    onSaved?: (updated: Poem, previous: PoemSummaryData) => void
    onDirtyChange?: (dirty: boolean) => void
    onDelete?: (poem: PoemSummaryData) => void
    onPinChanged?: (poem: PoemSummaryData, pinned: boolean) => void
}

export default function PoemList({
    poems,
    editingId = null,
    loadedPoems,
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
                        editPoem={loadedPoems?.[p.id]}
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
