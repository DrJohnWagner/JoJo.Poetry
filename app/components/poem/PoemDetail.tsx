"use client"

import { useEffect, useRef, useState } from "react"
import type { Poem } from "@/lib/types"
import { useAppConfig } from "../AppConfig"
import PoemBody from "./PoemBody"
import PoemAuthor from "./PoemAuthor"
import PoemNotes from "./PoemNotes"
import PoemSocial from "./PoemSocial"
import PoemGroup from "./PoemGroup"
import PoemFeatures from "./PoemFeatures"
import PoemButtons from "./PoemButtons"
import PoemEditor from "./PoemEditor"
import HorizontalRule from "../HorizontalRule"
import { fetchPoem } from "@/lib/api"
import { cleanPoetryUrl } from "@/lib/format"
import PoemAwards from "./PoemAwards"
import PoemSummary from "./PoemSummary"
import { PoemAnalytics } from "@/components/analytics/PoemAnalytics"
import dynamic from "next/dynamic"

const InstagramEmbed = dynamic(
    () => import("react-social-media-embed").then((m) => m.InstagramEmbed),
    { ssr: false }
)

function MetaRow({ group, features }: { group: string; features: string[] }) {
    if (!features || features.length === 0) return null
    return (
        <>
            <dt className="text-label">
                <PoemGroup group={group} />
            </dt>
            <dd className="text-meta">
                <PoemFeatures features={features} />
            </dd>
        </>
    )
}

export default function PoemDetail({ poem: initial }: { poem: Poem }) {
    const { readOnly } = useAppConfig()
    const [poem, setPoem] = useState<Poem>(initial)
    const [open, setOpen] = useState(false)
    const [analyticsOpen, setAnalyticsOpen] = useState(false)
    const [caption, setCaption] = useState(false)
    const [editing, setEditing] = useState(false)
    const [liveTitle, setLiveTitle] = useState(initial.title)
    const SMALL = 350
    const LARGE = 500
    const [width, setWidth] = useState(SMALL)
    const mechanismRef = useRef<HTMLDivElement>(null)
    const [mechanismExpanded, setMechanismExpanded] = useState(false)
    const [mechanismOverflows, setMechanismOverflows] = useState(false)

    useEffect(() => {
        const el = mechanismRef.current
        if (!el || mechanismExpanded) return
        setMechanismOverflows(el.scrollHeight > el.clientHeight + 1)
    }, [poem.mechanism, mechanismExpanded])

    function handleUpdate() {
        fetchPoem(poem.id).then(setPoem).catch(() => {})
    }

    if (editing) {
        return (
            <div>
                <p className="text-label mb-6">
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
    const instagram = poem.socials.filter((s) => s.includes("instagram.com"))

    return (
        <div>
            <header className="mb-5">
                <PoemSummary
                    poem={poem}
                    pinned={poem.pinned}
                    onPinChange={(p) =>
                        setPoem((prev) => ({ ...prev, pinned: p }))
                    }
                    onUpdate={handleUpdate}
                    clampProject={false}
                    features={[]}
                />
            </header>

            <HorizontalRule />

            <section aria-label="Poem body" className="my-5">
                <PoemBody poemId={poem.id} showBody={true} />
            </section>

            <HorizontalRule />

            <section aria-label="Analytics" className="my-5">
                <button
                    onClick={() => setAnalyticsOpen((a) => !a)}
                    className="text-label hover:text-ink"
                >
                    {analyticsOpen ? "Hide analytics" : "Show analytics"}
                </button>
                {analyticsOpen && (
                    <div className="mt-4">
                        <PoemAnalytics poemId={poem.id} width={600} />
                    </div>
                )}
            </section>

            <HorizontalRule />

            {poem.mechanism.length > 0 && (
                <>
                    <section aria-label="Mechanism" className="my-5">
                        <p className="text-label mb-3">Mechanism</p>
                        <div
                            ref={mechanismRef}
                            className={`font-sans text-sm leading-relaxed text-ink/80 space-y-3${mechanismExpanded ? "" : " line-clamp-5"}`}
                        >
                            {poem.mechanism.map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>
                        {(mechanismOverflows || mechanismExpanded) && (
                            <button
                                onClick={() => setMechanismExpanded((e) => !e)}
                                className="mt-3 text-label hover:text-ink"
                            >
                                {mechanismExpanded ? "SHOW LESS" : "SHOW MORE"}
                            </button>
                        )}
                    </section>
                    <HorizontalRule />
                </>
            )}

            <dl className="grid grid-cols-1 items-start gap-x-4 gap-y-2 text-[0.95rem] md:grid-cols-[max-content_1fr]">
                {poem.author && (
                    <>
                        <dt className="text-label">Author</dt>
                        <dd>
                            <PoemAuthor author={poem.author} />
                        </dd>
                    </>
                )}
                {poem.notes.length > 0 && (
                    <>
                        <dt className="text-label">Notes</dt>
                        <dd>
                            <PoemNotes poem={poem} />
                        </dd>
                    </>
                )}
                <MetaRow
                    group="Themes"
                    features={themes.map(
                        (t) => `/?themes=${encodeURIComponent(t)}`
                    )}
                />
                <MetaRow group="Moods" features={moods} />
                <MetaRow group="Poetic forms" features={poetic_forms} />
                <MetaRow group="Techniques" features={techniques} />
                <MetaRow group="Tones/Voices" features={tones_voices} />
                <MetaRow group="Images" features={key_images} />
                <MetaRow group="Contest fit" features={contest_fit} />
                {socials.length > 0 && (
                    <>
                        <dt className="text-label">Socials</dt>
                        <dd className="space-y-1">
                            {socials.map((s) => (
                                <PoemSocial key={s} url={s} />
                            ))}
                        </dd>
                    </>
                )}

                {awards.length > 0 && (
                    <>
                        <dt className="text-label">
                            <PoemGroup group="Awards" />
                        </dt>
                        <dd className="space-y-1">
                            <PoemAwards awards={awards} />
                        </dd>
                    </>
                )}

                <dt className="text-label">Link</dt>
                <dd className="text-meta">
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

            {instagram.length > 0 && (
                <div className="text-label mt-5 hover:text-ink">
                    <div className="my-5 flex gap-x-5">
                        <button
                            onClick={() => setOpen(!open)}
                            className="text-label hover:text-ink"
                        >
                            {open ? "Hide socials" : "Show socials"}
                        </button>
                        {open && (
                            <button
                                onClick={() =>
                                    setWidth(width === LARGE ? SMALL : LARGE)
                                }
                                className="text-label hover:text-ink"
                            >
                                {width === LARGE ? "Small" : "Large"}
                            </button>
                        )}
                        {open && (
                            <button
                                onClick={() => setCaption(!caption)}
                                className="text-label hover:text-ink"
                            >
                                {caption ? "Hide captions" : "Show captions"}
                            </button>
                        )}
                    </div>
                    {open &&
                        instagram.map((url) => (
                            <div
                                key={url}
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                            >
                                {caption && (
                                    <InstagramEmbed
                                        url={url}
                                        width={width}
                                        captioned
                                    />
                                )}
                                {!caption && (
                                    <InstagramEmbed url={url} width={width} />
                                )}
                            </div>
                        ))}
                </div>
            )}

            {instagram.length > 0 && !readOnly && <HorizontalRule />}

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
