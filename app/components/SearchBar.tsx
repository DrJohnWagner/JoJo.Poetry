"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { hasAdvanced, type SearchState } from "@/lib/types"
import AdvancedSearchDialog from "./AdvancedSearchDialog"

const EMPTY_ADVANCED = { year: null, month: null, awards: [] as string[] }
const MONTHS = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

export default function SearchBar({
    value,
    onChange,
}: {
    value: SearchState
    onChange: (next: SearchState) => void
}) {
    const [draft, setDraft] = useState(value.q)
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setDraft(value.q)
    }, [value.q])

    useEffect(() => {
        if (draft === value.q) return
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            onChange({ ...value, q: draft.trim() })
        }, 300)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [draft, onChange, value])

    function submit(e?: React.FormEvent) {
        e?.preventDefault()
        if (timerRef.current) clearTimeout(timerRef.current)
        if (draft !== value.q) onChange({ ...value, q: draft.trim() })
    }

    const advancedCount =
        (value.year !== null ? 1 : 0) +
        (value.month !== null ? 1 : 0) +
        value.awards.length

    const activeFilters = useMemo(() => {
        const filters: Array<{
            key: string
            label: string
            clear: () => void
        }> = []
        if (value.q) {
            filters.push({
                key: "q",
                label: `Search: ${value.q}`,
                clear: () => {
                    setDraft("")
                    onChange({ ...value, q: "" })
                },
            })
        }
        if (value.year !== null) {
            filters.push({
                key: "year",
                label: `Year: ${value.year}`,
                clear: () => onChange({ ...value, year: null }),
            })
        }
        if (value.month !== null) {
            filters.push({
                key: "month",
                label: `Month: ${MONTHS[value.month]}`,
                clear: () => onChange({ ...value, month: null }),
            })
        }
        for (const award of value.awards) {
            filters.push({
                key: `award:${award}`,
                label: `Award: ${award}`,
                clear: () =>
                    onChange({
                        ...value,
                        awards: value.awards.filter((item) => item !== award),
                    }),
            })
        }
        return filters
    }, [onChange, value])

    const hasAnyFilter = activeFilters.length > 0

    return (
        <section aria-label="Search">
            <form onSubmit={submit} className="mb-8">
                <div className="flex items-end gap-3">
                    <label className="flex-1 block">
                        <span className="eyebrow">Search</span>
                        <input
                            type="search"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Search poems…"
                            className="mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 font-serif text-lg"
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setDraft("")
                                    onChange({ ...value, q: "" })
                                }
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen(true)}
                        className={`eyebrow border-b pb-1 transition-colors ${
                            hasAdvanced(value)
                                ? "text-accent border-accent"
                                : "text-muted border-muted hover:text-ink hover:border-ink"
                        }`}
                    >
                        Advanced{advancedCount ? ` · ${advancedCount}` : ""}
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {hasAnyFilter && <p className="eyebrow text-muted">
                        {`${activeFilters.length} active filter${activeFilters.length === 1 ? "" : "s"}`}
                    </p>}
                    {hasAnyFilter && (
                        <button
                            type="button"
                            onClick={() => {
                                setDraft("")
                                onChange({ q: "", ...EMPTY_ADVANCED })
                            }}
                            className="eyebrow text-muted hover:text-ink"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {hasAnyFilter && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {activeFilters.map((filter) => (
                            <button
                                key={filter.key}
                                type="button"
                                onClick={filter.clear}
                                className="rounded-full border border-rule px-3 py-1 text-[0.72rem] uppercase tracking-wider2 text-muted transition-colors hover:border-ink hover:text-ink"
                            >
                                {filter.label} ×
                            </button>
                        ))}
                    </div>
                )}
            </form>

            <AdvancedSearchDialog
                open={advancedOpen}
                value={value}
                onChange={onChange}
                onClose={() => setAdvancedOpen(false)}
                onClear={() => onChange({ ...value, ...EMPTY_ADVANCED })}
            />
        </section>
    )
}
