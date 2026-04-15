"use client"

import { useState } from "react"
import type { Poem } from "@/lib/types"
import { formatDate } from "@/lib/format"
import PoemBody from "./PoemBody"
import PinToggle from "./PinToggle"
import DeleteButton from "./DeleteButton"
import PoemEditorForm from "./PoemEditorForm"

export default function PoemDetail({ poem: initial }: { poem: Poem }) {
    const [poem, setPoem] = useState<Poem>(initial)
    const [editing, setEditing] = useState(false)

    if (editing) {
        return (
            <div>
                <p className="eyebrow mb-6">Editing · “{poem.title}”</p>
                <PoemEditorForm
                    poem={poem}
                    density="comfortable"
                    onSaved={(u) => {
                        setPoem(u)
                        setEditing(false)
                    }}
                    onCancel={() => setEditing(false)}
                />
            </div>
        )
    }

    return (
        <div>
            <header className="mb-10">
                <div className="flex items-baseline justify-between gap-6">
                    <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight flex-1">
                        {poem.title}
                    </h1>
                    <PinToggle
                        id={poem.id}
                        initialPinned={poem.pinned}
                        onChange={(p) =>
                            setPoem((prev) => ({ ...prev, pinned: p }))
                        }
                    />
                </div>

                <div className="eyebrow mt-3 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatDate(poem.date)}</span>
                    <span>·</span>
                    <span>{poem.lines} lines</span>
                    <span>·</span>
                    <span>{poem.words} words</span>
                    <span>·</span>
                    <span>rating {poem.rating}</span>
                </div>

                {poem.project && (
                    <p className="mt-6 italic text-ink/90 leading-relaxed">
                        {poem.project}
                    </p>
                )}
            </header>

            <div className="my-10 rule" />

            <section aria-label="Poem body" className="my-12">
                <PoemBody body={poem.body} />
            </section>

            <div className="my-10 rule" />

            <dl className="grid grid-cols-1 md:grid-cols-[9rem_1fr] gap-y-5 gap-x-8 text-[0.95rem]">
                <MetaRow label="Themes" values={poem.themes} />
                <MetaRow label="Register" values={poem.emotional_register} />
                <MetaRow label="Form" values={poem.form_and_craft} />
                <MetaRow label="Images" values={poem.key_images} />
                <MetaRow label="Contest fit" values={poem.contest_fit} />

                {poem.contests.length > 0 && (
                    <>
                        <dt className="eyebrow pt-1">Contests</dt>
                        <dd className="space-y-1">
                            {poem.contests.map((c) => (
                                <div key={c.url}>
                                    <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {c.award}
                                    </a>
                                </div>
                            ))}
                        </dd>
                    </>
                )}

                <dt className="eyebrow pt-1">Link</dt>
                <dd>
                    <a href={poem.url} target="_blank" rel="noreferrer">
                        allpoetry.com ↗
                    </a>
                </dd>
            </dl>

            {poem.copyright && (
                <>
                    <div className="my-10 rule" />
                    <section className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                        {poem.copyright.replace(/<br\s*\/?>\n?/gi, "\n")}
                    </section>
                </>
            )}

            <div className="my-10 rule" />
            <footer className="flex items-center justify-between gap-6">
                <button
                    onClick={() => setEditing(true)}
                    className="eyebrow border-b border-ink pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    Edit poem
                </button>
                <DeleteButton id={poem.id} />
            </footer>
        </div>
    )
}

function MetaRow({ label, values }: { label: string; values: string[] }) {
    if (!values || values.length === 0) return null
    return (
        <>
            <dt className="eyebrow pt-1">{label}</dt>
            <dd className="font-sans text-[0.78rem] text-ink/80">{values.join(" · ")}</dd>
        </>
    )
}
