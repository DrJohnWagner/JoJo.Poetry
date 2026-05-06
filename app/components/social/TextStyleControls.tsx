"use client"

import { useRef } from "react"
import type { FontOption } from "@/lib/types"
import StepperInput from "../StepperInput"
import FontSelector from "../FontSelector"

export type ColourMode = "white" | "black" | "auto" | "custom"

export interface TextStyle {
    colour: ColourMode
    customColour: string
    filterFirst: boolean
    font: string // filename stem relative to fonts/, e.g. EB_Garamond/EBGaramond-Regular
    fontSize: number
    margin: number
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
        <div className="grid grid-cols-[max-content_max-content] items-center gap-x-4 gap-y-3 text-sm">
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
                Colour
            </span>
            <div className="flex flex-wrap items-center gap-2">
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

            <span className="text-label text-xs uppercase tracking-widest">
                Margin
            </span>
            <StepperInput
                value={value.margin}
                onChange={(v) => set({ margin: v })}
                min={0}
                smallStep={1}
                largeStep={5}
            />

            <label className="col-span-2 flex cursor-pointer items-center gap-2">
                <input
                    type="checkbox"
                    checked={value.filterFirst}
                    onChange={(e) => set({ filterFirst: e.target.checked })}
                    className="accent-ink"
                />
                <span className="text-label text-xs">Filter before text</span>
            </label>
        </div>
    )
}
