"use client"

import { useEffect, useMemo, useState } from "react"
import { patchPoem } from "@/lib/api"
import type { Poem } from "@/lib/types"
import { bodyToPlainText, plainTextToBody } from "@/lib/format"
import {
    diffDraft,
    draftFromPoem,
    isDirty,
    type PoemDraft,
} from "@/lib/editable"
import PoemNotesEditor from "./PoemNotesEditor"
import PoemMetadataEditor, {
    inputCls,
    textareaCls,
    Labelled,
    type PoemMetadataValues,
} from "./PoemMetadataEditor"
import ErrorMessage from "../ErrorMessage"

/** Shared inline editor for a full poem — exactly the same editable
 *  field set wherever it is rendered. `density` tweaks the layout for
 *  list rows vs. the detail page; the fields themselves do not change.
 */
export default function PoemEditor({
    poem,
    density = "comfortable",
    onSaved,
    onCancel,
    onDirtyChange,
    onTitleChange,
}: {
    poem: Poem
    density?: "compact" | "comfortable"
    onSaved: (updated: Poem) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
    onTitleChange?: (title: string) => void
}) {
    const plainBase = useMemo(() => bodyToPlainText(poem.body), [poem.body])
    const [draft, setDraft] = useState<PoemDraft>(() =>
        draftFromPoem(poem, plainBase)
    )
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const dirty = useMemo(
        () => isDirty(poem, plainBase, draft, plainTextToBody),
        [poem, plainBase, draft]
    )

    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

    useEffect(() => {
        if (!dirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [dirty])

    function set<K extends keyof PoemDraft>(k: K, v: PoemDraft[K]) {
        setDraft((d) => ({ ...d, [k]: v }))
    }

    async function save() {
        const updates = diffDraft(poem, plainBase, draft, plainTextToBody)
        if (Object.keys(updates).length === 0) {
            onCancel()
            return
        }
        setSaving(true)
        setErr(null)
        try {
            const updated = await patchPoem(poem.id, updates)
            onSaved(updated)
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Failed")
        } finally {
            setSaving(false)
        }
    }

    function cancel() {
        if (dirty && !window.confirm("Discard unsaved changes to this poem?"))
            return
        onCancel()
    }

    const rowGap = density === "compact" ? "space-y-3" : "space-y-5"
    const bodyRows = density === "compact" ? 10 : 22
    const actionButtonClass =
        "button-text button-text-standard button-text-default button-text-hoverable button-text-disabled"

    return (
        <div className={rowGap}>
            <Labelled label="Title">
                <input
                    value={draft.title}
                    onChange={(e) => {
                        set("title", e.target.value)
                        onTitleChange?.(e.target.value)
                    }}
                    className={inputCls + " font-display text-2xl"}
                />
            </Labelled>

            <Labelled label="Project">
                <textarea
                    value={draft.project}
                    onChange={(e) => set("project", e.target.value)}
                    rows={2}
                    className={textareaCls + " italic"}
                />
            </Labelled>

            <Labelled
                label="Body"
                hint="Newlines and leading whitespace are preserved exactly."
            >
                <textarea
                    value={draft.body}
                    onChange={(e) => set("body", e.target.value)}
                    rows={bodyRows}
                    spellCheck={false}
                    className={
                        textareaCls +
                        " whitespace-pre font-serif text-[1.02rem]"
                    }
                    style={{ tabSize: 4, MozTabSize: 4 } as React.CSSProperties}
                />
            </Labelled>

            <PoemNotesEditor
                value={draft.notes}
                onChange={(v) => set("notes", v)}
            />

            <PoemMetadataEditor
                values={draft as PoemMetadataValues}
                set={(k, v) =>
                    set(k as keyof PoemDraft, v as PoemDraft[keyof PoemDraft])
                }
            />

            <div className="flex items-center gap-6 pt-2">
                <button
                    onClick={save}
                    disabled={saving}
                    className={actionButtonClass}
                >
                    {saving ? "saving…" : dirty ? "save" : "done"}
                </button>
                <button
                    onClick={cancel}
                    disabled={saving}
                    className={actionButtonClass}
                >
                    cancel
                </button>
                {dirty && (
                    <span className="text-[0.72rem] normal-case tracking-normal text-muted">
                        unsaved
                    </span>
                )}
                <ErrorMessage message={err} className="text-[0.8rem] normal-case tracking-normal inline" />
            </div>
        </div>
    )
}
