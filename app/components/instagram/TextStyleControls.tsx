"use client"

import { useRef } from "react"
import type { FontOption } from "@/lib/types"

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
}: {
    value: TextStyle
    onChange: (v: TextStyle) => void
    fonts?: FontOption[]
    mruFonts?: string[]
}) {
    const colourInputRef = useRef<HTMLInputElement>(null)

    function set(patch: Partial<TextStyle>) {
        onChange({ ...value, ...patch })
    }

    return (
        <div className="flex flex-col gap-3 text-sm">
            {/* Colour */}
            <div className="flex items-center gap-2">
                <span className="text-label text-xs uppercase tracking-widest">Text Colour</span>
                {COLOUR_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                            set({ colour: opt.value })
                            if (opt.value === "custom") colourInputRef.current?.click()
                        }}
                        className={`text-sm transition-colors ${
                            value.colour === opt.value
                                ? "text-ink border-b border-ink"
                                : "text-muted hover:text-ink"
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
                {value.colour === "custom" && (
                    <div className="flex items-center gap-1">
                        <div
                            className="w-4 h-4 border border-[#d4d0c8] cursor-pointer"
                            style={{ backgroundColor: value.customColour }}
                            onClick={() => colourInputRef.current?.click()}
                        />
                        <span className="text-muted text-xs font-mono">{value.customColour}</span>
                        <input
                            ref={colourInputRef}
                            type="color"
                            value={value.customColour}
                            onChange={(e) => set({ customColour: e.target.value })}
                            className="sr-only"
                        />
                    </div>
                )}
            </div>

            {/* Font + Size */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-label text-xs uppercase tracking-widest">Font</span>
                    <select
                        value={value.font}
                        onChange={(e) => set({ font: e.target.value })}
                        className="bg-transparent text-ink border-b border-[#d4d0c8] text-sm focus:outline-none cursor-pointer"
                    >
                        {fonts.length === 0 ? (
                            <option value={value.font}>{value.font}</option>
                        ) : (() => {
                            const recentFilenames = new Set(mruFonts)
                            const labelOf = Object.fromEntries(fonts.map((f) => [f.filename, f.label]))
                            const recentValid = mruFonts.filter((fn) => fn in labelOf)
                            const rest = fonts.filter((f) => !recentFilenames.has(f.filename))
                            return (
                                <>
                                    {recentValid.length > 0 && (
                                        <optgroup label="Recent">
                                            {recentValid.map((fn) => (
                                                <option key={fn} value={fn}>{labelOf[fn]}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="All Fonts">
                                        {rest.map((f) => (
                                            <option key={f.filename} value={f.filename}>{f.label}</option>
                                        ))}
                                    </optgroup>
                                </>
                            )
                        })()}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-label text-xs uppercase tracking-widest">Size</span>
                    <input
                        type="range"
                        min={12}
                        max={96}
                        value={value.fontSize}
                        onChange={(e) => set({ fontSize: Number(e.target.value) })}
                        className="w-24 accent-ink"
                    />
                    <span className="text-muted text-xs w-6 text-right">{value.fontSize}</span>
                </div>
            </div>
        </div>
    )
}
