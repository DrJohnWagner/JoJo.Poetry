"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createPoem } from "@/lib/api"
import { plainTextToBody } from "@/lib/format"
import NotesEditor from "./NotesEditor"
import PoemMetadataEditor, {
    inputCls,
    textareaCls,
    Labelled,
    type PoemMetadataValues,
} from "./PoemMetadataEditor"

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
    const [project, setProject] = useState("")
    const [body, setBody] = useState("")
    const [rating, setRating] = useState<number>(75)
    const [url, setUrl] = useState("")

    // Optional — empty strings/arrays map to backend defaults if left blank
    const [date, setDate] = useState("")
    const [themes, setThemes] = useState("")
    const [emotionalRegister, setEmotionalRegister] = useState("")
    const [formAndCraft, setFormAndCraft] = useState("")
    const [keyImages, setKeyImages] = useState("")
    const [contestFit, setContestFit] = useState("")
    const [socials, setSocials] = useState("")
    const [pinned, setPinned] = useState(false)
    const [notes, setNotes] = useState("")

    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const dirty =
        title !== "" ||
        project !== "" ||
        body !== "" ||
        rating !== 75 ||
        url !== "" ||
        date !== "" ||
        themes !== "" ||
        emotionalRegister !== "" ||
        formAndCraft !== "" ||
        keyImages !== "" ||
        contestFit !== "" ||
        socials !== "" ||
        pinned ||
        notes !== ""

    useEffect(() => {
        if (!dirty || saving) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [dirty, saving])

    const inFlightRef = useRef(false)

    function splitTags(s: string): string[] {
        return s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
    }

    function setMeta(k: keyof PoemMetadataValues, v: string | number) {
        if (k === "rating") setRating(v as number)
        else if (k === "date") setDate(v as string)
        else if (k === "url") setUrl(v as string)
        else if (k === "themes") setThemes(v as string)
        else if (k === "emotional_register") setEmotionalRegister(v as string)
        else if (k === "form_and_craft") setFormAndCraft(v as string)
        else if (k === "key_images") setKeyImages(v as string)
        else if (k === "contest_fit") setContestFit(v as string)
        else if (k === "socials") setSocials(v as string)
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
        if (socials.trim()) payload.socials = splitTags(socials)
        const noteLines = notes.split("\n").map((s) => s.trim()).filter(Boolean)
        if (noteLines.length > 0) payload.notes = noteLines

        try {
            const created = await createPoem(payload)
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

    return (
        <form onSubmit={submit} className="space-y-5">
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

            <PoemMetadataEditor
                values={{ rating, date, url, themes, emotional_register: emotionalRegister, form_and_craft: formAndCraft, key_images: keyImages, contest_fit: contestFit, socials }}
                set={setMeta}
                ratingRequired
                urlRequired
                dateHint="ISO 8601. Blank = now (UTC)."
            />

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
