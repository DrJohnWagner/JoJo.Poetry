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

/** Shared inline editor for a full poem — exactly the same editable
 *  field set wherever it is rendered. `density` tweaks the layout for
 *  list rows vs. the detail page; the fields themselves do not change.
 */
export default function PoemEditorForm({
    poem,
    density = "comfortable",
    onSaved,
    onCancel,
    onDirtyChange,
}: {
    poem: Poem
    density?: "compact" | "comfortable"
    onSaved: (updated: Poem) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
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

    // Guard page unload if unsaved changes exist.
    useEffect(() => {
        if (!dirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ""
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

    const inputCls =
        "mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-1"
    const textareaCls =
        "mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-3 font-serif leading-[1.65] resize-y"

    return (
        <div className={rowGap}>
            <Labelled label="Title">
                <input
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Labelled label="Rating (0–100)">
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.rating}
                        onChange={(e) => set("rating", Number(e.target.value))}
                        className={inputCls}
                    />
                </Labelled>
                <Labelled label="Date">
                    <input
                        type="text"
                        value={draft.date}
                        onChange={(e) => set("date", e.target.value)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className={inputCls + " font-mono text-sm"}
                    />
                </Labelled>
                <Labelled label="URL">
                    <input
                        type="url"
                        value={draft.url}
                        onChange={(e) => set("url", e.target.value)}
                        className={inputCls + " font-mono text-sm"}
                    />
                </Labelled>
            </div>

            <TagInput
                label="Themes"
                value={draft.themes}
                onChange={(v) => set("themes", v)}
            />
            <TagInput
                label="Emotional register"
                value={draft.emotional_register}
                onChange={(v) => set("emotional_register", v)}
            />
            <TagInput
                label="Form and craft"
                value={draft.form_and_craft}
                onChange={(v) => set("form_and_craft", v)}
            />
            <TagInput
                label="Key images"
                value={draft.key_images}
                onChange={(v) => set("key_images", v)}
            />
            <TagInput
                label="Contest fit"
                value={draft.contest_fit}
                onChange={(v) => set("contest_fit", v)}
            />

            <Labelled label="Copyright / note">
                <textarea
                    value={draft.copyright}
                    onChange={(e) => set("copyright", e.target.value)}
                    rows={3}
                    className={textareaCls}
                />
            </Labelled>

            <div className="pt-2 flex items-center gap-6 font-sans text-[0.72rem] uppercase tracking-wider2">
                <button
                    onClick={save}
                    disabled={saving}
                    className="text-accent"
                >
                    {saving ? "saving…" : dirty ? "save" : "done"}
                </button>
                <button
                    onClick={cancel}
                    disabled={saving}
                    className="text-muted hover:text-ink"
                >
                    cancel
                </button>
                {dirty && (
                    <span className="text-[0.72rem] text-muted normal-case tracking-normal">
                        unsaved
                    </span>
                )}
                {err && (
                    <span className="text-red-700 text-[0.8rem] normal-case tracking-normal">
                        {err}
                    </span>
                )}
            </div>
        </div>
    )
}

function Labelled({
    label,
    hint,
    children,
}: {
    label: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="block">
            <span className="eyebrow">{label}</span>
            {children}
            {hint && (
                <span className="block text-[0.72rem] text-muted mt-1">
                    {hint}
                </span>
            )}
        </label>
    )
}

function TagInput({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (v: string) => void
}) {
    return (
        <Labelled label={label} hint="Comma-separated.">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-1 font-sans text-sm"
            />
        </Labelled>
    )
}
