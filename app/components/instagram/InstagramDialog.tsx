"use client"

import { useEffect, useRef, useState } from "react"
import ImagePreview from "./ImagePreview"
import ImagePromptInput from "./ImagePromptInput"
import ExcerptEditor from "./ExcerptEditor"
import TextPlacementGrid, { type Placement } from "./TextPlacementGrid"
import TextStyleControls, { type TextStyle } from "./TextStyleControls"
import FilterSelector, { type Filter } from "./FilterSelector"
import InstagramActions from "./InstagramActions"
import {
    instagramUpdate,
    instagramRegenerate,
    instagramFonts,
    instagramFilters,
    instagramGenerate,
} from "@/lib/api"
import { addMruFont, getMruFonts } from "@/lib/fonts"
import type { FontOption, TextSpecification } from "@/lib/types"

const DEFAULT_STYLE: TextStyle = {
    colour: "white",
    customColour: "#ffffff",
    font: "",
    fontSize: 18,
}

const DEFAULT_PLACEMENT: Placement = "centre"

function resolveColour(style: TextStyle): string {
    if (style.colour === "custom") return style.customColour
    if (style.colour === "black") return "#000000"
    if (style.colour === "white") return "#ffffff"
    return "auto"
}

function toTextSpec(style: TextStyle, location: Placement): TextSpecification {
    return { colour: resolveColour(style), font: style.font, size: style.fontSize, location }
}

export default function InstagramDialog({
    poemId,
    initialExcerpt = "",
    onClose,
}: {
    poemId: string
    initialExcerpt?: string
    onClose: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [prompt, setPrompt] = useState("")
    const [excerpt, setExcerpt] = useState(initialExcerpt)
    const [image, setImage] = useState<string | undefined>(undefined)
    const [placement, setPlacement] = useState<Placement>("centre")
    const [mruFonts, setMruFonts] = useState<string[]>(() => getMruFonts())
    const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_STYLE)
    const [filter, setFilter] = useState<Filter>("none")
    const [fonts, setFonts] = useState<FontOption[]>([])
    const [filters, setFilters] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [dirtyPrompt, setDirtyPrompt] = useState(false)
    const [dirtyExcerpt, setDirtyExcerpt] = useState(false)

    useEffect(() => {
        dialogRef.current?.showModal()
        Promise.all([instagramFonts(), instagramFilters()])
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
                return instagramGenerate({
                    poem_id: poemId,
                    filter: "none",
                    text: toTextSpec(style, DEFAULT_PLACEMENT),
                })
            })
            .then((data) => {
                if (data.excerpt) setExcerpt(data.excerpt)
                if (data.prompt) setPrompt(data.prompt)
                if (data.image) setImage(`${data.image}?t=${Date.now()}`)
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
    } = {}) {
        const f = overrides.filter ?? filter
        const p = overrides.placement ?? placement
        const s = overrides.textStyle ?? textStyle
        setLoading(true)
        instagramUpdate({
            poem_id: poemId,
            filter: f,
            excerpt,
            text: toTextSpec(s, p),
        })
            .then((data) => {
                if (data.image) setImage(`${data.image}?t=${Date.now()}`)
                setDirtyExcerpt(false)
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

    function handleStyleChange(s: TextStyle) {
        setTextStyle(s)
        applyUpdate({ textStyle: s })
    }

    function handlePromptUpdate() {
        setDirtyPrompt(false)
        setLoading(true)
        instagramRegenerate({ poem_id: poemId, prompt })
            .then((data) => {
                if (data.image) setImage(`${data.image}?t=${Date.now()}`)
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
        setLoading(true)
        instagramGenerate({
            poem_id: poemId,
            filter: "none",
            text: toTextSpec(textStyle, DEFAULT_PLACEMENT),
        })
            .then((data) => {
                if (data.excerpt) setExcerpt(data.excerpt)
                if (data.prompt) setPrompt(data.prompt)
                if (data.image) setImage(`${data.image}?t=${Date.now()}`)
            })
            .finally(() => setLoading(false))
    }

    function handlePost() {
        addMruFont(textStyle.font)
        setMruFonts(getMruFonts())
        // API wiring to come
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
                    Create Instagram Post
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
                {/* Image preview + filters side by side */}
                <div className="flex items-start gap-6">
                    <ImagePreview src={image} loading={loading} />
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
                    {/* Image prompt */}
                    <ImagePromptInput
                        value={prompt}
                        dirty={dirtyPrompt}
                        onChange={(v) => {
                            setPrompt(v)
                            setDirtyPrompt(true)
                        }}
                        onUpdate={handlePromptUpdate}
                    />

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
                        />
                        <TextPlacementGrid
                            value={placement}
                            onChange={handlePlacementChange}
                        />
                    </div>

                    {/* Text style */}
                    <div className="mt-7">
                        <TextStyleControls
                            value={textStyle}
                            onChange={handleStyleChange}
                            fonts={fonts}
                            mruFonts={mruFonts}
                        />
                    </div>

                    {/* Actions */}
                    <div className="mt-7">
                        <InstagramActions
                            onRegenerate={handleRegenerate}
                            onPost={handlePost}
                        />
                    </div>
                </div>
            </div>
        </dialog>
    )
}
