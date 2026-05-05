"use client"

import { useRef } from "react"
import type { FontOption } from "@/lib/types"
import StepperInput from "./StepperInput"

export type ColourMode = "white" | "black" | "auto" | "custom"

export interface TextStyle {
    colour: ColourMode
    customColour: string
    font: string        // filename stem relative to fonts/, e.g. EB_Garamond/EBGaramond-Regular
    fontSize: number
}

const COLOUR_OPTIONS: { label: string; value: ColourMode }[] = [
    { label: "White", value: "white" },
    { label: "Black", value: "black" },
    { label: "Auto",  value: "auto"  },
    { label: "Select", value: "custom" },
]

export default function TextStyleControls({
    value,
    onChange,
    fonts = [],
    mruFonts = [],
    filterFirst = false,
    onFilterFirstChange,
}: {
    value: TextStyle
    onChange: (v: TextStyle) => void
    fonts?: FontOption[]
    mruFonts?: string[]
    filterFirst?: boolean
    onFilterFirstChange?: (v: boolean) => void
}) {
    const colourInputRef = useRef<HTMLInputElement>(null)

    function set(patch: Partial<TextStyle>) {
        onChange({ ...value, ...patch })
    }

    return (
        <div className="flex flex-col gap-3 text-sm">
            {/* Font + Size */}
            <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-label text-xs uppercase tracking-widest">
                        Font
                    </span>
                    <select
                        value={value.font}
                        onChange={(e) => set({ font: e.target.value })}
                        className="cursor-pointer border-b border-[#d4d0c8] bg-transparent text-sm text-ink focus:outline-none"
                    >
                        {fonts.length === 0 ? (
                            <option value={value.font}>{value.font}</option>
                        ) : (
                            (() => {
                                const recentFilenames = new Set(mruFonts)
                                const labelOf = Object.fromEntries(
                                    fonts.map((f) => [f.filename, f.label])
                                )
                                const recentValid = mruFonts.filter(
                                    (fn) => fn in labelOf
                                )
                                const rest = fonts.filter(
                                    (f) => !recentFilenames.has(f.filename)
                                )
                                return (
                                    <>
                                        {recentValid.length > 0 && (
                                            <optgroup label="Recent">
                                                {recentValid.map((fn) => (
                                                    <option key={fn} value={fn}>
                                                        {labelOf[fn]}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="All Fonts">
                                            {rest.map((f) => (
                                                <option
                                                    key={f.filename}
                                                    value={f.filename}
                                                >
                                                    {f.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    </>
                                )
                            })()
                        )}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-label text-xs uppercase tracking-widest">
                        Size
                    </span>
                    <StepperInput
                        value={value.fontSize}
                        onChange={(v) => set({ fontSize: v })}
                        min={16}
                        max={64}
                        smallStep={1}
                        largeStep={4}
                    />
                </div>
            </div>

            {/* Colour + filter order */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-label text-xs uppercase tracking-widest">
                        Text Colour
                    </span>
                    {COLOUR_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                set({ colour: opt.value })
                                if (opt.value === "custom")
                                    colourInputRef.current?.click()
                            }}
                            className={`text-sm transition-colors ${
                                value.colour === opt.value
                                    ? "border-b border-ink text-ink"
                                    : "text-muted hover:text-ink"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {value.colour === "custom" && (
                        <div className="flex items-center gap-1">
                            <div
                                className="h-4 w-4 cursor-pointer border border-[#d4d0c8]"
                                style={{ backgroundColor: value.customColour }}
                                onClick={() => colourInputRef.current?.click()}
                            />
                            <span className="font-mono text-xs text-muted">
                                {value.customColour}
                            </span>
                            <input
                                ref={colourInputRef}
                                type="color"
                                value={value.customColour}
                                onChange={(e) =>
                                    set({ customColour: e.target.value })
                                }
                                className="sr-only"
                            />
                        </div>
                    )}
                </div>
                {onFilterFirstChange && (
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={filterFirst}
                            onChange={(e) => onFilterFirstChange(e.target.checked)}
                            className="accent-ink"
                        />
                        <span className="text-label text-xs">Filter before text</span>
                    </label>
                )}
            </div>
        </div>
    )
}
