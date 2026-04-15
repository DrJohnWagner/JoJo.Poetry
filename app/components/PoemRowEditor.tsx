"use client"

import { useEffect, useState } from "react"
import { fetchPoem } from "@/lib/api"
import type { Poem, PoemSummary } from "@/lib/types"
import PoemEditorForm from "./PoemEditorForm"

/** List-row editing surface. Fetches the full poem, then delegates to
 *  the shared PoemEditorForm — so the editable field set is identical
 *  to the detail page. */
export default function PoemRowEditor({
    summary,
    onSaved,
    onCancel,
    onDirtyChange,
}: {
    summary: PoemSummary
    onSaved: (poem: Poem) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
}) {
    const [full, setFull] = useState<Poem | null>(null)
    const [err, setErr] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        fetchPoem(summary.id)
            .then((p) => !cancelled && setFull(p))
            .catch((e: Error) => !cancelled && setErr(e.message))
        return () => {
            cancelled = true
        }
    }, [summary.id])

    if (err && !full) return <p className="text-red-700 text-sm py-4">{err}</p>
    if (!full) return <p className="eyebrow text-muted py-4">Loading…</p>

    return (
        <PoemEditorForm
            poem={full}
            density="compact"
            onSaved={onSaved}
            onCancel={onCancel}
            onDirtyChange={onDirtyChange}
        />
    )
}
