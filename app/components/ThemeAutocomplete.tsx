"use client"

import { useEffect, useRef, useState } from "react"
import { fetchFeatures } from "@/lib/api"

export default function ThemeAutocomplete({
    value,
    onChange,
}: {
    value: string[]
    onChange: (next: string[]) => void
}) {
    const [options, setOptions] = useState<string[]>([])
    const [draft, setDraft] = useState("")
    const [open, setOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchFeatures("themes").then(setOptions).catch(() => {})
    }, [])

    const matches = draft.trim()
        ? options.filter(
              (o) =>
                  !value.includes(o) &&
                  o.toLowerCase().includes(draft.trim().toLowerCase())
          )
        : []

    function add(theme: string) {
        onChange([...value, theme])
        setDraft("")
        setOpen(false)
        inputRef.current?.focus()
    }

    return (
        <div>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value)
                        setOpen(true)
                    }}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onFocus={() => draft && setOpen(true)}
                    placeholder="Add a theme…"
                    className="mt-1 w-full border-b border-rule bg-transparent py-1 font-serif outline-none focus:border-accent"
                />
                {open && matches.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto border border-rule bg-paper shadow-md">
                        {matches.map((m) => (
                            <li
                                key={m}
                                onMouseDown={() => add(m)}
                                className="cursor-pointer px-3 py-1.5 font-sans text-sm hover:bg-ink/5"
                            >
                                {m}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {value.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {value.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onChange(value.filter((x) => x !== t))}
                            className="rounded-full border border-rule px-3 py-1 text-[0.72rem] uppercase tracking-wider2 text-muted transition-colors hover:border-ink hover:text-ink"
                        >
                            {t} ×
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
