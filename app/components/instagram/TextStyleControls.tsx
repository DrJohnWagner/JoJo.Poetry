"use client"

import { useRef } from "react"

export type ColourMode = "white" | "black" | "auto" | "custom"
export type FontFamily = "serif" | "sans"

export interface TextStyle {
    colour: ColourMode
    customColour: string
    font: FontFamily
    fontSize: number
    bold: boolean
    italic: boolean
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
}: {
    value: TextStyle
    onChange: (v: TextStyle) => void
}) {
    const colourInputRef = useRef<HTMLInputElement>(null)

    function set(patch: Partial<TextStyle>) {
        onChange({ ...value, ...patch })
    }

    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
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

            {/* Font */}
            <div className="flex items-center gap-2">
                <span className="text-label text-xs uppercase tracking-widest">Font</span>
                <select
                    value={value.font}
                    onChange={(e) => set({ font: e.target.value as FontFamily })}
                    className="bg-transparent text-ink border-b border-[#d4d0c8] text-sm focus:outline-none cursor-pointer"
                >
                    <option value="serif">Serif (Default)</option>
                    <option value="sans">Sans</option>
                </select>
            </div>

            {/* Font Size */}
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

            {/* Bold / Italic */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => set({ bold: !value.bold })}
                    className={`font-bold text-base transition-colors ${value.bold ? "text-ink border-b border-ink" : "text-muted hover:text-ink"}`}
                >
                    B
                </button>
                <button
                    type="button"
                    onClick={() => set({ italic: !value.italic })}
                    className={`italic text-base transition-colors ${value.italic ? "text-ink border-b border-ink" : "text-muted hover:text-ink"}`}
                >
                    I
                </button>
            </div>
        </div>
    )
}
