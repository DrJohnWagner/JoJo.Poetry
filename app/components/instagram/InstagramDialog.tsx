"use client"

import { useEffect, useRef, useState } from "react"
import ImagePreview from "./ImagePreview"
import ImagePromptInput from "./ImagePromptInput"
import ExcerptEditor from "./ExcerptEditor"
import TextPlacementGrid, { type Placement } from "./TextPlacementGrid"
import TextStyleControls, { type TextStyle } from "./TextStyleControls"
import FilterSelector, { type Filter } from "./FilterSelector"
import InstagramActions from "./InstagramActions"

const DEFAULT_STYLE: TextStyle = {
    colour: "white",
    customColour: "#ffffff",
    font: "serif",
    fontSize: 48,
    bold: false,
    italic: false,
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
    const [placement, setPlacement] = useState<Placement>("centre")
    const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_STYLE)
    const [filter, setFilter] = useState<Filter>("none")

    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    function handleClose() {
        dialogRef.current?.close()
        onClose()
    }

    function handleRegenerate() {
        // API wiring to come
    }

    function handlePost() {
        // API wiring to come
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-3xl bg-paper text-ink rounded-none border border-[#d4d0c8] p-0 backdrop:bg-ink/20"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
            {/* Header */}
            <div className="flex items-baseline justify-between px-8 pt-7 pb-4 border-b border-[#d4d0c8]">
                <h2 className="text-title text-title-lg">Create Instagram Post</h2>
                <button
                    type="button"
                    onClick={handleClose}
                    className="text-label hover:text-ink text-sm transition-colors"
                >
                    Close
                </button>
            </div>

            <div className="px-8 py-6 space-y-7">
                {/* Image preview */}
                <ImagePreview />

                {/* Image prompt */}
                <ImagePromptInput value={prompt} onChange={setPrompt} />

                {/* Excerpt + placement */}
                <div className="grid grid-cols-[1fr_auto] gap-8 items-start">
                    <ExcerptEditor value={excerpt} onChange={setExcerpt} />
                    <TextPlacementGrid value={placement} onChange={setPlacement} />
                </div>

                {/* Text style */}
                <TextStyleControls value={textStyle} onChange={setTextStyle} />

                {/* Filters */}
                <FilterSelector value={filter} onChange={setFilter} />

                {/* Actions */}
                <InstagramActions onRegenerate={handleRegenerate} onPost={handlePost} />
            </div>
        </dialog>
    )
}
