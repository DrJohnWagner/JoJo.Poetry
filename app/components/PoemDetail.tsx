"use client"

import { useState } from "react"
import type { Poem } from "@/lib/types"
import { useAppConfig } from "./AppConfig"
import PoemBody from "./PoemBody"
import PoemStatistics from "./PoemStatistics"
import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
import PinToggle from "./PinToggle"
import DeleteButton from "./DeleteButton"
import PoemContest from "./PoemContest"
import PoemSocial from "./PoemSocial"
import PoemEditorForm from "./PoemEditorForm"
import HorizontalRule from "./HorizontalRule"

export default function PoemDetail({ poem: initial }: { poem: Poem }) {
    const { readOnly } = useAppConfig()
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
            <header className="mb-5">
                <div className="flex items-baseline justify-between gap-6">
                    <div className="flex-1">
                        <PoemTitle poem={poem} link={false} />
                    </div>
                    <PinToggle
                        id={poem.id}
                        initialPinned={poem.pinned}
                        onChange={(p) =>
                            setPoem((prev) => ({ ...prev, pinned: p }))
                        }
                    />
                </div>
                <PoemStatistics poem={poem} />
                <PoemProject poem={poem} />
            </header>

            <HorizontalRule />

            <section aria-label="Poem body" className="my-5">
                <PoemBody body={poem.body} />
            </section>

            <section aria-label="Author's Notes" className="my-5">
                <p className="eyebrow mb-2">Author&#39;s Notes</p>
                {poem.notes.length > 0 ? (
                    <ul className="space-y-1 font-sans text-[0.85rem] text-ink/80">
                        {poem.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="font-sans text-[0.85rem] text-muted">
                        [No notes.]
                    </p>
                )}
            </section>

            <HorizontalRule />

            <dl className="grid grid-cols-1 gap-x-0 gap-y-2 text-[0.95rem] md:grid-cols-[8rem_1fr]">
                <MetaRow label="Themes" values={poem.themes} />
                <MetaRow label="Register" values={poem.emotional_register} />
                <MetaRow label="Form" values={poem.form_and_craft} />
                <MetaRow label="Images" values={poem.key_images} />
                <MetaRow label="Contest fit" values={poem.contest_fit} />
                {poem.socials.length > 0 && (
                    <>
                        <dt className="eyebrow pt-1">Socials</dt>
                        <dd className="space-y-1">
                            {poem.socials.map((s) => (
                                <PoemSocial key={s} url={s} />
                            ))}
                        </dd>
                    </>
                )}

                {poem.contests.length > 0 && (
                    <>
                        <dt className="eyebrow pt-1">Contests</dt>
                        {/* <dd className="space-y-1 font-sans text-sm normal-case tracking-normal"> */}
                        <dd className="space-y-1">
                            {poem.contests.map((contest) => (
                                <PoemContest
                                    key={contest.url}
                                    contest={contest}
                                />
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

            <HorizontalRule />
            {!readOnly && (
                <footer className="flex items-center justify-between gap-6">
                    <button
                        onClick={() => setEditing(true)}
                        className="eyebrow border-b border-ink pb-1 transition-colors hover:border-accent hover:text-accent"
                    >
                        Edit poem
                    </button>
                    <DeleteButton id={poem.id} />
                </footer>
            )}
        </div>
    )
}

function MetaRow({ label, values }: { label: string; values: string[] }) {
    if (!values || values.length === 0) return null
    return (
        <>
            <dt className="eyebrow pt-0">{label}</dt>
            <dd className="font-sans text-[0.78rem] text-ink/80">
                {values.join(" · ")}
            </dd>
        </>
    )
}
