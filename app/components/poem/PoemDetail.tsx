"use client"

import { useState } from "react"
import type { Poem } from "@/lib/types"
import { useAppConfig } from "../AppConfig"
import PoemBody from "./PoemBody"
import PoemStatistics from "./PoemStatistics"
import PoemProject from "./PoemProject"
import PoemTitle from "./PoemTitle"
import PoemAuthor from "./PoemAuthor"
import PoemNotes from "./PoemNotes"
import PoemSocial from "./PoemSocial"
import PoemGroup from "./PoemGroup"
import PoemFeatures from "./PoemFeatures"
import PoemButtons from "./PoemButtons"
import PoemEditor from "./PoemEditor"
import HorizontalRule from "../HorizontalRule"
import { cleanPoetryUrl } from "@/lib/format"
import PoemAwards from "./PoemAwards"

function MetaRow({ group, features }: { group: string; features: string[] }) {
    if (!features || features.length === 0) return null
    return (
        <>
            <dt className="label-text pt-0">
                <PoemGroup group={group} />
            </dt>
            <dd className="font-sans text-[0.78rem] text-ink/80">
                <PoemFeatures features={features} />
            </dd>
        </>
    )
}

export default function PoemDetail({ poem: initial }: { poem: Poem }) {
    const { readOnly } = useAppConfig()
    const [poem, setPoem] = useState<Poem>(initial)
    const [editing, setEditing] = useState(false)
    const [liveTitle, setLiveTitle] = useState(initial.title)
    const { id, title } = poem

    if (editing) {
        return (
            <div>
                <p className="label-text mb-6">
                    Editing &middot; &ldquo;{liveTitle.trim() || "(Untitled)"}
                    &rdquo;
                </p>
                <PoemEditor
                    poem={poem}
                    density="comfortable"
                    onTitleChange={setLiveTitle}
                    onSaved={(u) => {
                        setPoem(u)
                        setLiveTitle(u.title)
                        setEditing(false)
                    }}
                    onCancel={() => {
                        setLiveTitle(poem.title)
                        setEditing(false)
                    }}
                />
            </div>
        )
    }
    const {
        themes,
        moods,
        poetic_forms,
        techniques,
        tones_voices,
        key_images,
        contest_fit,
        socials,
        awards,
    } = poem

    return (
        <div>
            <header className="mb-5">
                <PoemTitle
                    id={id}
                    title={title}
                    link={false}
                    pinned={poem.pinned}
                    onPinChange={(p) =>
                        setPoem((prev) => ({ ...prev, pinned: p }))
                    }
                />
                <PoemStatistics poem={poem} />
                <PoemProject project={poem.project} />
            </header>

            <HorizontalRule />

            <section aria-label="Poem body" className="my-5">
                <PoemBody body={poem.body} />
            </section>

            <HorizontalRule />

            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[0.95rem] md:grid-cols-[max-content_1fr]">
                {poem.author && (
                    <>
                        <dt className="label-text pt-1">Author</dt>
                        <dd>
                            <PoemAuthor author={poem.author} />
                        </dd>
                    </>
                )}
                {poem.notes.length > 0 && (
                    <>
                        <dt className="label-text pt-1">Notes</dt>
                        <dd>
                            <PoemNotes poem={poem} />
                        </dd>
                    </>
                )}
                <MetaRow group="Themes" features={themes} />
                <MetaRow group="Moods" features={moods} />
                <MetaRow group="Poetic forms" features={poetic_forms} />
                <MetaRow group="Techniques" features={techniques} />
                <MetaRow group="Tones/Voices" features={tones_voices} />
                <MetaRow group="Images" features={key_images} />
                <MetaRow group="Contest fit" features={contest_fit} />
                {socials.length > 0 && (
                    <>
                        <dt className="label-text pt-1">Socials</dt>
                        <dd className="space-y-1">
                            {socials.map((s) => (
                                <PoemSocial key={s} url={s} />
                            ))}
                        </dd>
                    </>
                )}

                {awards.length > 0 && (
                    <>
                        <dt className="label-text pt-1">
                            <PoemGroup group="Awards" />
                        </dt>
                        <dd className="space-y-1">
                            <PoemAwards awards={awards} />
                        </dd>
                    </>
                )}

                <dt className="label-text pt-1">Link</dt>
                <dd>
                    <a
                        href={cleanPoetryUrl(poem.url)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {cleanPoetryUrl(poem.url)} ↗
                    </a>
                </dd>
            </dl>

            <HorizontalRule />
            {!readOnly && (
                <footer>
                    <PoemButtons
                        onEdit={() => setEditing(true)}
                        deleteId={poem.id}
                    />
                </footer>
            )}
        </div>
    )
}
