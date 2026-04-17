"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createPoem } from "@/lib/api"
import { plainTextToBody } from "@/lib/format"
import NotesEditor from "./NotesEditor"

/** Dedicated create form. Mirrors the editing surface in field names,
 *  widgets, and behaviour so that the create and edit experiences feel
 *  like the same form in different modes.
 *
 *  Required (⦁) vs optional inputs are marked in-line. Defaults for
 *  omitted optional fields are applied by the backend, so this form
 *  sends only what the user typed.
 */
export default function PoemCreateForm() {
    const router = useRouter()

    // Required
    const [title, setTitle] = useState("")
    const [url, setUrl] = useState("")
    const [project, setProject] = useState("")
    const [body, setBody] = useState("")
    const [rating, setRating] = useState<number>(75)

    // Optional — empty strings/arrays map to backend defaults if left blank
    const [date, setDate] = useState<string>("") // blank → backend uses now()
    const [themes, setThemes] = useState("")
    const [emotionalRegister, setEmotionalRegister] = useState("")
    const [formAndCraft, setFormAndCraft] = useState("")
    const [keyImages, setKeyImages] = useState("")
    const [contestFit, setContestFit] = useState("")
    const [pinned, setPinned] = useState(false)
    const [notes, setNotes] = useState("")

    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const dirty =
        title !== "" ||
        url !== "" ||
        project !== "" ||
        body !== "" ||
        rating !== 75 ||
        date !== "" ||
        themes !== "" ||
        emotionalRegister !== "" ||
        formAndCraft !== "" ||
        keyImages !== "" ||
        contestFit !== "" ||
        pinned ||
        notes !== ""

    // Unsaved-changes guard on page unload.
    useEffect(() => {
        if (!dirty || saving) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [dirty, saving])

    // Double-submit guard: the button is disabled while saving, and a
    // ref short-circuits any concurrent callers (double-click, repeated
    // Enter, autofill-driven form resubmit).
    const inFlightRef = useRef(false)

    function splitTags(s: string): string[] {
        return s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
    }

    async function submit(e?: React.FormEvent) {
        e?.preventDefault()
        if (inFlightRef.current || saving) return
        inFlightRef.current = true
        setSaving(true)
        setErr(null)

        const payload: Record<string, unknown> = {
            title: title.trim(),
            url: url.trim(),
            body: plainTextToBody(body),
            project: project.trim(),
            rating,
            pinned,
        }
        if (date.trim()) payload.date = date.trim()
        if (themes.trim()) payload.themes = splitTags(themes)
        if (emotionalRegister.trim())
            payload.emotional_register = splitTags(emotionalRegister)
        if (formAndCraft.trim())
            payload.form_and_craft = splitTags(formAndCraft)
        if (keyImages.trim()) payload.key_images = splitTags(keyImages)
        if (contestFit.trim()) payload.contest_fit = splitTags(contestFit)
        const noteLines = notes.split("\n").map((s) => s.trim()).filter(Boolean)
        if (noteLines.length > 0) payload.notes = noteLines

        try {
            const created = await createPoem(payload)
            // Clear the dirty flags before navigating so the beforeunload
            // guard does not fire for our own redirect.
            inFlightRef.current = false
            router.push(`/poems/${created.id}`)
            router.refresh()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Failed")
            inFlightRef.current = false
            setSaving(false)
        }
    }

    function cancel() {
        if (dirty && !window.confirm("Discard this new poem?")) return
        router.push("/")
    }

    const inputCls =
        "mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-1"
    const textareaCls =
        "mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-3 font-serif leading-[1.65] resize-y"

    return (
        <form
            onSubmit={submit}
            className="space-y-5"
            // Prevent implicit form submission from autocomplete on text inputs;
            // submit only via the explicit Save control or by pressing Enter
            // inside single-line inputs.
        >
            <div>
                <p className="eyebrow mb-6 text-muted">
                    New poem · fields marked{" "}
                    <span className="text-accent">⦁</span> are required.
                </p>
            </div>

            <Labelled label="Title" required>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className={inputCls + " font-display text-2xl"}
                />
            </Labelled>

            <Labelled label="URL" required hint="Canonical external link.">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className={inputCls + " font-mono text-sm"}
                />
            </Labelled>

            <Labelled
                label="Project"
                required
                hint="One-sentence authorial statement."
            >
                <textarea
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    required
                    rows={2}
                    className={textareaCls + " italic"}
                />
            </Labelled>

            <Labelled
                label="Body"
                required
                hint="Newlines and leading whitespace are preserved exactly."
            >
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={18}
                    spellCheck={false}
                    className={
                        textareaCls +
                        " whitespace-pre font-serif text-[1.02rem]"
                    }
                    style={{ tabSize: 4, MozTabSize: 4 } as React.CSSProperties}
                />
            </Labelled>

            <NotesEditor value={notes} onChange={setNotes} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Labelled label="Rating (0–100)" required>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        required
                        className={inputCls}
                    />
                </Labelled>
                <Labelled label="Date" hint="ISO 8601. Blank = now (UTC).">
                    <input
                        type="text"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className={inputCls + " font-mono text-sm"}
                    />
                </Labelled>
                <Labelled label="Pinned">
                    <label className="mt-2 inline-flex items-center gap-2 font-sans text-sm">
                        <input
                            type="checkbox"
                            checked={pinned}
                            onChange={(e) => setPinned(e.target.checked)}
                        />
                        Pin to top
                    </label>
                </Labelled>
            </div>

            <TagInput label="Themes" value={themes} onChange={setThemes} />
            <TagInput
                label="Emotional register"
                value={emotionalRegister}
                onChange={setEmotionalRegister}
            />
            <TagInput
                label="Form and craft"
                value={formAndCraft}
                onChange={setFormAndCraft}
            />
            <TagInput
                label="Key images"
                value={keyImages}
                onChange={setKeyImages}
            />
            <TagInput
                label="Contest fit"
                value={contestFit}
                onChange={setContestFit}
            />

            <div className="pt-4 flex items-center gap-6 font-sans text-[0.72rem] uppercase tracking-wider2">
                <button
                    type="submit"
                    disabled={saving}
                    className="text-accent border-b border-accent pb-1 disabled:opacity-60"
                >
                    {saving ? "saving…" : "save poem"}
                </button>
                <button
                    type="button"
                    onClick={cancel}
                    disabled={saving}
                    className="text-muted hover:text-ink"
                >
                    cancel
                </button>
                {err && (
                    <span className="text-red-700 normal-case tracking-normal">
                        {err}
                    </span>
                )}
            </div>
        </form>
    )
}

function Labelled({
    label,
    required,
    hint,
    children,
}: {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="block">
            <span className="eyebrow">
                {label}
                {required && <span className="ml-1 text-accent">⦁</span>}
            </span>
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
        <Labelled label={label} hint="Comma-separated; optional.">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-1 font-sans text-sm"
            />
        </Labelled>
    )
}
