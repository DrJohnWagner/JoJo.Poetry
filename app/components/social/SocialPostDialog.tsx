"use client"

import { useEffect, useRef, useState } from "react"
import ImagePreview from "./ImagePreview"
import ImagePromptInput from "./ImagePromptInput"
import ExcerptEditor from "./ExcerptEditor"
import TextPlacementGrid, { type Placement } from "./TextPlacementGrid"
import TextStyleControls, { type TextStyle } from "./TextStyleControls"
import FilterSelector, { type Filter } from "./FilterSelector"
import SocialPostActions from "./SocialPostActions"
import {
    socialUpdate,
    socialRegenerate,
    socialFonts,
    socialFilters,
    socialGenerate,
    socialPost,
} from "@/lib/api"
import { addMruFont, getMruFonts } from "@/lib/fonts"
import type { FilterOption, FontOption, TextSpecification } from "@/lib/types"

const DEFAULT_STYLE: TextStyle = {
    colour: "white",
    customColour: "#ffffff",
    font: "",
    fontSize: 32,
}

const DEFAULT_PLACEMENT: Placement = "centre"

function resolveColour(style: TextStyle): string {
    if (style.colour === "custom") return style.customColour
    if (style.colour === "black") return "#000000"
    if (style.colour === "white") return "#ffffff"
    return "auto"
}

function toTextSpec(style: TextStyle, location: Placement, margin: number): TextSpecification {
    return { colour: resolveColour(style), font: style.font, size: style.fontSize, location, margin }
}

export default function SocialPostDialog({
    poemId,
    title,
    initialExcerpt = "",
    onClose,
    onPosted,
}: {
    poemId: string
    title: string
    initialExcerpt?: string
    onClose: () => void
    onPosted?: (urls: string[]) => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [prompt, setPrompt] = useState("")
    const [excerpt, setExcerpt] = useState(initialExcerpt)
    const [image, setImage] = useState<string | undefined>(undefined)
    const [placement, setPlacement] = useState<Placement>("centre")
    const [mruFonts, setMruFonts] = useState<string[]>(() => getMruFonts())
    const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_STYLE)
    const [filter, setFilter] = useState<Filter>("none")
    const [filterFirst, setFilterFirst] = useState(false)
    const [fonts, setFonts] = useState<FontOption[]>([])
    const [filters, setFilters] = useState<FilterOption[]>([])
    const [margin, setMargin] = useState(30)
    const [loading, setLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Generating image\u2026")
    const [dirtyPrompt, setDirtyPrompt] = useState(false)
    const [dirtyExcerpt, setDirtyExcerpt] = useState(false)
    const [savedPrompt, setSavedPrompt] = useState("")
    const [savedExcerpt, setSavedExcerpt] = useState(initialExcerpt)

    useEffect(() => {
        dialogRef.current?.showModal()
        Promise.all([socialFonts(), socialFilters()])
            .then(([loadedFonts, loadedFilters]) => {
                setFonts(loadedFonts)
                setFilters(loadedFilters)
                const mru = getMruFonts()
                const defaultFont =
                    mru.find((f) => loadedFonts.some((lf) => lf.filename === f))
                    ?? loadedFonts[0]?.filename
                    ?? ""
                const style: TextStyle = { ...DEFAULT_STYLE, font: defaultFont }
                setTextStyle(style)
                return socialGenerate({
                    poem_id: poemId,
                    filter: "none",
                    text: toTextSpec(style, DEFAULT_PLACEMENT, 30),
                })
            })
            .then((data) => {
                setExcerpt(data.excerpt); setSavedExcerpt(data.excerpt)
                setPrompt(data.prompt); setSavedPrompt(data.prompt)
                setImage(`${data.image_url}?t=${Date.now()}`)
                setDirtyPrompt(false)
                setDirtyExcerpt(false)
            })
            .finally(() => setLoading(false))
    }, [poemId])

    function handleClose() {
        dialogRef.current?.close()
        onClose()
    }

    function applyUpdate(overrides: {
        filter?: Filter
        placement?: Placement
        textStyle?: TextStyle
        margin?: number
        filterFirst?: boolean
    } = {}) {
        const f = overrides.filter ?? filter
        const p = overrides.placement ?? placement
        const s = overrides.textStyle ?? textStyle
        const m = overrides.margin ?? margin
        const ff = overrides.filterFirst ?? filterFirst
        setLoadingMessage("Updating image\u2026")
        setLoading(true)
        socialUpdate({
            poem_id: poemId,
            filter: f,
            excerpt,
            text: toTextSpec(s, p, m),
            filter_first: ff,
        })
            .then((data) => {
                setImage(`${data.image_url}?t=${Date.now()}`)
                setSavedExcerpt(excerpt)
                setDirtyExcerpt(false)
            })
            .catch((err: Error) => {
                if (!err.message.includes("generate first")) throw err
                return socialGenerate({
                    poem_id: poemId,
                    filter: f,
                    text: toTextSpec(s, p, m),
                    filter_first: ff,
                }).then((data) => {
                    setExcerpt(data.excerpt); setSavedExcerpt(data.excerpt)
                    setPrompt(data.prompt); setSavedPrompt(data.prompt)
                    setImage(`${data.image_url}?t=${Date.now()}`)
                    setDirtyPrompt(false)
                    setDirtyExcerpt(false)
                })
            })
            .finally(() => setLoading(false))
    }

    function handleFilterChange(f: Filter) {
        setFilter(f)
        applyUpdate({ filter: f })
    }

    function handlePlacementChange(p: Placement) {
        setPlacement(p)
        applyUpdate({ placement: p })
    }

    function handleMarginChange(m: number) {
        setMargin(m)
        applyUpdate({ margin: m })
    }

    function handleStyleChange(s: TextStyle) {
        setTextStyle(s)
        applyUpdate({ textStyle: s })
    }

    function handlePromptUpdate() {
        setSavedPrompt(prompt)
        setDirtyPrompt(false)
        setLoadingMessage("Regenerating image\u2026")
        setLoading(true)
        socialRegenerate({
            poem_id: poemId,
            prompt,
            excerpt,
            filter,
            text: toTextSpec(textStyle, placement, margin),
            filter_first: filterFirst,
        })
            .then((data) => {
                setImage(`${data.image_url}?t=${Date.now()}`)
            })
            .finally(() => setLoading(false))
    }

    function handleExcerptUpdate() {
        applyUpdate()
    }

    function handleRegenerate() {
        setFilter("none")
        setPlacement(DEFAULT_PLACEMENT)
        setDirtyPrompt(false)
        setDirtyExcerpt(false)
        setLoadingMessage("Generating image\u2026")
        setLoading(true)
        socialGenerate({
            poem_id: poemId,
            filter: "none",
            text: toTextSpec(textStyle, DEFAULT_PLACEMENT, margin),
            filter_first: filterFirst,
        })
            .then((data) => {
                setExcerpt(data.excerpt); setSavedExcerpt(data.excerpt)
                setPrompt(data.prompt); setSavedPrompt(data.prompt)
                setImage(`${data.image_url}?t=${Date.now()}`)
            })
            .finally(() => setLoading(false))
    }

    function handlePost() {
        addMruFont(textStyle.font)
        setMruFonts(getMruFonts())
        setLoadingMessage("Posting to social media\u2026")
        setLoading(true)
        socialPost({
            poem_id: poemId,
            filter,
            excerpt,
            text: toTextSpec(textStyle, placement, margin),
            filter_first: filterFirst,
        })
            .then((data) => {
                handleClose()
                onPosted?.(data.socials)
            })
            .finally(() => setLoading(false))
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-3xl rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
            {/* Header */}
            <div className="flex items-baseline justify-between border-b border-[#d4d0c8] px-8 pb-4 pt-7">
                <h2 className="text-title text-title-lg">
                    Create Social Post
                </h2>
                <button
                    type="button"
                    onClick={handleClose}
                    className="text-label text-sm transition-colors hover:text-ink"
                >
                    Close
                </button>
            </div>

            <div className="space-y-7 overflow-hidden px-8 py-6">
                {/* Poem title */}
                <p className="text-title text-title-sm">Poem: {title}</p>

                {/* Image preview + filters side by side */}
                <div className="flex items-start gap-6">
                    <ImagePreview src={image} loading={loading} loadingMessage={loadingMessage} />
                    <div
                        className={
                            loading
                                ? "pointer-events-none select-none opacity-40"
                                : undefined
                        }
                    >
                        <FilterSelector
                            filters={filters}
                            value={filter}
                            onChange={handleFilterChange}
                        />
                    </div>
                </div>

                {/* Controls — dimmed and non-interactive while loading */}
                <div
                    className={
                        loading
                            ? "pointer-events-none select-none opacity-40"
                            : undefined
                    }
                >
                    {/* Text style */}
                    <div className="mt-7">
                        <TextStyleControls
                            value={textStyle}
                            onChange={handleStyleChange}
                            fonts={fonts}
                            mruFonts={mruFonts}
                            filterFirst={filterFirst}
                            onFilterFirstChange={(v) => {
                                setFilterFirst(v)
                                applyUpdate({ filterFirst: v })
                            }}
                        />
                    </div>

                    {/* Excerpt + placement */}
                    <div className="mt-7 grid grid-cols-[1fr_auto] items-start gap-8">
                        <ExcerptEditor
                            value={excerpt}
                            dirty={dirtyExcerpt}
                            onChange={(v) => {
                                setExcerpt(v)
                                setDirtyExcerpt(true)
                            }}
                            onUpdate={handleExcerptUpdate}
                            onRevert={() => { setExcerpt(savedExcerpt); setDirtyExcerpt(false) }}
                        />
                        <TextPlacementGrid
                            value={placement}
                            onChange={handlePlacementChange}
                            margin={margin}
                            onMarginChange={handleMarginChange}
                        />
                    </div>

                    {/* Image prompt */}
                    <ImagePromptInput
                        value={prompt}
                        dirty={dirtyPrompt}
                        onChange={(v) => {
                            setPrompt(v)
                            setDirtyPrompt(true)
                        }}
                        onUpdate={handlePromptUpdate}
                        onRevert={() => { setPrompt(savedPrompt); setDirtyPrompt(false) }}
                    />

                    {/* Actions */}
                    <div className="mt-7">
                        <SocialPostActions
                            onRegenerate={handleRegenerate}
                            onPost={handlePost}
                            canPost={!dirtyExcerpt && !dirtyPrompt}
                        />
                    </div>
                </div>
            </div>
        </dialog>
    )
}
