"use client"

import { useRef } from "react"
import type { FontOption, PDFOptions } from "@/lib/types"
import FontSelector from "../FontSelector"
import StepperInput from "../StepperInput"

const PAPER_OPTIONS = ["a4", "a5", "us-letter", "us-legal"]

export default function PDFControls({
    value,
    onChange,
    fonts = [],
    mruFonts = [],
}: {
    value: PDFOptions
    onChange: (v: PDFOptions) => void
    fonts?: FontOption[]
    mruFonts?: string[]
}) {
    const colourInputRef = useRef<HTMLInputElement>(null)

    function set(patch: Partial<PDFOptions>) {
        onChange({ ...value, ...patch })
    }

    return (
        <div className="grid grid-cols-[max-content_max-content] items-center gap-x-4 gap-y-3">
            <span className="text-label text-xs uppercase tracking-widest">
                Columns
            </span>
            <div className="flex items-center gap-4">
                <StepperInput
                    value={value.columns}
                    onChange={(v) => set({ columns: v })}
                    min={1}
                    max={3}
                    smallStep={1}
                />
                <span className="text-label text-xs uppercase tracking-widest">
                    Colour
                </span>
                <div className="flex items-center gap-2">
                    <div
                        className="h-4 w-4 cursor-pointer border border-[#d4d0c8]"
                        style={{ backgroundColor: value.colour }}
                        onClick={() => colourInputRef.current?.click()}
                    />
                    <span className="font-mono text-xs text-muted">
                        {value.colour}
                    </span>
                    <input
                        ref={colourInputRef}
                        type="color"
                        value={value.colour}
                        onChange={(e) => set({ colour: e.target.value })}
                        className="sr-only"
                    />
                </div>
            </div>

            <span className="text-label text-xs uppercase tracking-widest">
                Paper
            </span>
            <select
                value={value.paper}
                onChange={(e) => set({ paper: e.target.value })}
                className="cursor-pointer border-b border-[#d4d0c8] bg-transparent text-sm text-ink focus:outline-none"
            >
                {PAPER_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                        {p.toUpperCase()}
                    </option>
                ))}
            </select>

            <span className="text-label text-xs uppercase tracking-widest">
                Font
            </span>
            <FontSelector
                value={value.font}
                onChange={(v) => set({ font: v })}
                fonts={fonts}
                mruFonts={mruFonts}
            />

            <span className="text-label text-xs uppercase tracking-widest">
                Size
            </span>
            <div className="flex items-center gap-2">
                <StepperInput
                    value={value.font_size}
                    onChange={(v) => set({ font_size: v })}
                    min={8}
                    max={36}
                    smallStep={1}
                    largeStep={4}
                />
                <span className="text-xs text-muted">pt</span>
            </div>

            <span className="text-label text-xs uppercase tracking-widest">
                Margin
            </span>
            <div className="flex items-center gap-2">
                <StepperInput
                    value={value.margin}
                    onChange={(v) => set({ margin: v })}
                    min={0}
                    max={5}
                    smallStep={0.1}
                    largeStep={0.5}
                    decimals={1}
                />
                <span className="text-xs text-muted">cm</span>
            </div>

            <span className="text-label text-xs uppercase tracking-widest">
                Gutter
            </span>
            <div className="flex items-center gap-2">
                <StepperInput
                    value={value.gutter}
                    onChange={(v) => set({ gutter: v })}
                    min={0}
                    max={3}
                    smallStep={0.1}
                    largeStep={0.5}
                    decimals={1}
                />
                <span className="text-xs text-muted">cm</span>
            </div>

            <span className="text-label text-xs uppercase tracking-widest">
                Leading
            </span>
            <div className="flex items-center gap-2">
                <StepperInput
                    value={value.leading}
                    onChange={(v) => set({ leading: v })}
                    min={0}
                    max={3}
                    smallStep={0.1}
                    largeStep={0.5}
                    decimals={1}
                />
                <span className="text-xs text-muted">em</span>
            </div>

            <span className="text-label text-xs uppercase tracking-widest">
                Spacing
            </span>
            <div className="flex items-center gap-2">
                <StepperInput
                    value={value.spacing}
                    onChange={(v) => set({ spacing: v })}
                    min={0}
                    max={5}
                    smallStep={0.1}
                    largeStep={0.5}
                    decimals={1}
                />
                <span className="text-xs text-muted">em</span>
            </div>
        </div>
    )
}
