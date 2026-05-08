"use client"

import { useEffect, useRef, useState } from "react"
import ImagePreview from "./ImagePreview"
// import ImagePromptInput from "./ImagePromptInput"
import UpdateRevertEditor from "./UpdateRevertEditor"
import Tabs from "../Tabs"
import Tab from "../Tab"
import ErrorMessage from "../ErrorMessage"
import DialogTitle from "../DialogTitle"
import TextPlacementGrid, { type Placement } from "./TextPlacementGrid"
import TextStyleControls, { type TextStyle } from "./TextStyleControls"
import FilterSelector, { type Filter } from "./FilterSelector"
import SocialPostActions from "./SocialPostActions"
import {
    socialUpdate,
    socialRegenerate,
    socialFilters,
    socialGenerate,
    socialPost,
    fetchFonts,
} from "@/lib/api"
import { getDefaultFont } from "@/lib/fonts"
import type {
    FilterOption,
    FontOption,
    SocialCostEstimate,
    TextSpecification,
} from "@/lib/types"

const EMPTY_COST: SocialCostEstimate = {
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    image_input_tokens: 0,
    image_output_tokens: 0,
    input_cost_usd: 0,
    output_cost_usd: 0,
    cached_input_cost_usd: 0,
    cache_creation_input_cost_usd: 0,
    image_input_cost_usd: 0,
    image_output_cost_usd: 0,
    total_cost_usd: 0,
}

function addCost(
    a: SocialCostEstimate,
    b: SocialCostEstimate | null | undefined
): SocialCostEstimate {
    if (!b) return a
    return Object.fromEntries(
        (Object.keys(a) as (keyof SocialCostEstimate)[]).map((k) => [
            k,
            a[k] + b[k],
        ])
    ) as unknown as SocialCostEstimate
}

function usd(n: number): string {
    return `$${n.toFixed(4)}`
}

function Cost({
    label,
    amount,
}: {
    label: string
    amount: number
    highlight?: boolean
}) {
    return (
        <>
            <span>{label}:</span>
            <span className="font-medium">{usd(amount)}</span>
        </>
    )
}

const DEFAULT_STYLE: TextStyle = {
    colour: "white",
    customColour: "#ffffff",
    filterFirst: false,
    font: "",
    fontSize: 32,
    margin: 30,
}

const DEFAULT_PLACEMENT: Placement = "centre"

function resolveColour(style: TextStyle): string {
    if (style.colour === "custom") return style.customColour
    if (style.colour === "black") return "#000000"
    if (style.colour === "white") return "#ffffff"
    return "auto"
}

function toTextSpec(style: TextStyle, location: Placement): TextSpecification {
    return {
        colour: resolveColour(style),
        font: style.font,
        size: style.fontSize,
        location,
        margin: style.margin,
        filter_first: style.filterFirst,
    }
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
    onPosted?: (
        urls: string[],
        errors: string[],
        cost: SocialCostEstimate
    ) => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [prompt, setPrompt] = useState("")
    const [savedPrompt, setSavedPrompt] = useState("")
    const [excerpt, setExcerpt] = useState(initialExcerpt)
    const [savedExcerpt, setSavedExcerpt] = useState(initialExcerpt)
    const [altText, setAltText] = useState("")
    const [adult, setAdult] = useState(false)
    const [tab, setTab] = useState(0)
    const [image, setImage] = useState<string | undefined>(undefined)
    const [placement, setPlacement] = useState<Placement>("centre")
    const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_STYLE)
    const [filter, setFilter] = useState<Filter>("none")
    const [fonts, setFonts] = useState<FontOption[]>([])
    const [filters, setFilters] = useState<FilterOption[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState(
        "Generating image\u2026"
    )
    const [error, setError] = useState<string | null>(null)
    const [cost, setCost] = useState<SocialCostEstimate>(EMPTY_COST)

    useEffect(() => {
        dialogRef.current?.showModal()
        Promise.all([fetchFonts(), socialFilters()])
            .then(([loadedFonts, loadedFilters]) => {
                setFonts(loadedFonts)
                setFilters(loadedFilters)
                const defaultFont = getDefaultFont(loadedFonts)
                const style: TextStyle = { ...DEFAULT_STYLE, font: defaultFont }
                setTextStyle(style)
                return socialGenerate({
                    poem_id: poemId,
                    filter: "none",
                    text: toTextSpec(style, DEFAULT_PLACEMENT),
                })
            })
            .then((data) => {
                setExcerpt(data.excerpt)
                setSavedExcerpt(data.excerpt)
                setPrompt(data.prompt)
                setSavedPrompt(data.prompt)
                setAltText(data.alt_text)
                setAdult(data.is_adult)
                setImage(`${data.image_url}?t=${Date.now()}`)
                setCost((c) => addCost(c, data.cost))
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false))
    }, [poemId])

    function handleClose() {
        dialogRef.current?.close()
        onClose()
    }

    function applyUpdate(
        overrides: {
            filter?: Filter
            placement?: Placement
            textStyle?: TextStyle
        } = {}
    ) {
        const f = overrides.filter ?? filter
        const p = overrides.placement ?? placement
        const s = overrides.textStyle ?? textStyle
        setError(null)
        setLoadingMessage("Updating image\u2026")
        setLoading(true)
        socialUpdate({
            poem_id: poemId,
            filter: f,
            excerpt,
            text: toTextSpec(s, p),
        })
            .then((data) => {
                setImage(`${data.image_url}?t=${Date.now()}`)
                setSavedExcerpt(excerpt)
            })
            .catch((err: Error) => {
                if (!err.message.includes("generate first")) {
                    setError(err.message)
                    return
                }
                return socialGenerate({
                    poem_id: poemId,
                    filter: f,
                    text: toTextSpec(s, p),
                })
                    .then((data) => {
                        setExcerpt(data.excerpt)
                        setSavedExcerpt(data.excerpt)
                        setPrompt(data.prompt)
                        setSavedPrompt(data.prompt)
                        setImage(`${data.image_url}?t=${Date.now()}`)
                        setAltText(data.alt_text)
                        setAdult(data.is_adult)
                        setCost((c) => addCost(c, data.cost))
                    })
                    .catch((err2: Error) => setError(err2.message))
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
        setSavedPrompt(prompt)
        setError(null)
        setLoadingMessage("Regenerating image\u2026")
        setLoading(true)
        socialRegenerate({
            poem_id: poemId,
            prompt,
            excerpt,
            filter,
            text: toTextSpec(textStyle, placement),
        })
            .then((data) => {
                setImage(`${data.image_url}?t=${Date.now()}`)
                setCost((c) => addCost(c, data.cost))
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false))
    }

    function handleExcerptUpdate() {
        applyUpdate()
    }

    async function handleCopy() {
        if (!image) return
        const response = await fetch(image)
        const blob = await response.blob()
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
    }

    function handleRegenerate() {
        setFilter("none")
        setPlacement(DEFAULT_PLACEMENT)
        setError(null)
        setLoadingMessage("Generating image\u2026")
        setLoading(true)
        socialGenerate({
            poem_id: poemId,
            filter: "none",
            text: toTextSpec(textStyle, DEFAULT_PLACEMENT),
        })
            .then((data) => {
                setExcerpt(data.excerpt)
                setSavedExcerpt(data.excerpt)
                setPrompt(data.prompt)
                setSavedPrompt(data.prompt)
                setImage(`${data.image_url}?t=${Date.now()}`)
                setCost((c) => addCost(c, data.cost))
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false))
    }

    function handlePost() {
        setError(null)
        setLoadingMessage("Posting to social media\u2026")
        setLoading(true)
        socialPost({
            poem_id: poemId,
            filter,
            excerpt,
            text: toTextSpec(textStyle, placement),
            alt_text: altText,
            is_adult: adult,
        })
            .then((data) => {
                handleClose()
                onPosted?.(data.socials, data.errors, cost)
            })
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false))
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-3xl rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
            <DialogTitle
                title="Create Social Media Post"
                subtitle={`Poem: ${title}`}
                onClose={handleClose}
            />
            <div className="relative">
                <div
                    className={`space-y-7 px-8 py-2${loading ? "pointer-events-none select-none opacity-40" : ""}`}
                >
                    <div className="grid grid-cols-[max-content_max-content] gap-8">
                        <div className="flex flex-col justify-center gap-3">
                            <ImagePreview src={image} />
                            <ErrorMessage
                                message={error}
                                className="text-meta"
                            />
                        </div>
                        <div className="flex justify-center">
                            <FilterSelector
                                filters={filters}
                                value={filter}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className="flex justify-center">
                            <TextStyleControls
                                value={textStyle}
                                onChange={handleStyleChange}
                                fonts={fonts}
                            />
                        </div>
                        <div className="flex justify-center">
                            <TextPlacementGrid
                                value={placement}
                                onChange={handlePlacementChange}
                            />
                        </div>
                    </div>
                    <div>
                        <Tabs
                            tabs={["Excerpt", "Image Prompt", "Alt Text"]}
                            tab={tab}
                            onTab={setTab}
                            className="mb-2 mt-3"
                        />
                        <Tab tab={0} value={tab}>
                            <UpdateRevertEditor
                                value={excerpt}
                                dirty={excerpt !== savedExcerpt}
                                onChange={(v) => setExcerpt(v)}
                                onUpdate={handleExcerptUpdate}
                                onRevert={() => setExcerpt(savedExcerpt)}
                                wordWrap={false}
                            />
                        </Tab>
                        <Tab tab={1} value={tab}>
                            <UpdateRevertEditor
                                value={prompt}
                                dirty={prompt !== savedPrompt}
                                onChange={(v) => setPrompt(v)}
                                onUpdate={handlePromptUpdate}
                                onRevert={() => setPrompt(savedPrompt)}
                            />
                        </Tab>
                        <Tab tab={2} value={tab}>
                            <UpdateRevertEditor
                                value={altText}
                                dirty={false}
                                onChange={(v) => setAltText(v)}
                            />
                        </Tab>
                        <span className="text-label mb-2 block text-xs uppercase tracking-widest">
                            Costs
                        </span>
                        <div className="text-meta mt-3 flex gap-3 text-sm tabular-nums">
                            <Cost
                                label="Text"
                                amount={
                                    cost.input_cost_usd +
                                    cost.output_cost_usd +
                                    cost.cached_input_cost_usd
                                }
                            />
                            <Cost
                                label="Image"
                                amount={
                                    cost.image_input_cost_usd +
                                    cost.image_output_cost_usd
                                }
                            />
                            <Cost
                                label="Total"
                                amount={cost.total_cost_usd}
                                highlight
                            />
                        </div>
                        <div className="my-5">
                            <SocialPostActions
                                onRegenerate={handleRegenerate}
                                onCopy={handleCopy}
                                onPost={handlePost}
                                canPost={
                                    excerpt === savedExcerpt &&
                                    prompt === savedPrompt
                                }
                            />
                        </div>
                    </div>
                </div>
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-start gap-3 pt-[25%]">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#d4d0c8] border-t-[#6b6760]" />
                        <span className="text-lg text-muted">
                            {loadingMessage}
                        </span>
                    </div>
                )}
            </div>
        </dialog>
    )
}
