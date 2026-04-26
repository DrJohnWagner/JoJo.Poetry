"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { hasAdvanced, type SearchState } from "@/lib/types"
import AdvancedSearchDialog from "./AdvancedSearchDialog"

const EMPTY_ADVANCED = {
    year: null,
    month: null,
    medals: [] as string[],
    title: "",
    body: "",
    project: "",
    notes: "",
}
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        value.medals.length +
        (value.title?.trim() ? 1 : 0) +
        (value.body?.trim() ? 1 : 0) +
        (value.project?.trim() ? 1 : 0) +
        (value.notes?.trim() ? 1 : 0)

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
        for (const medal of value.medals) {
            filters.push({
                key: `medal:${medal}`,
                label: `Medal: ${medal}`,
                clear: () =>
                    onChange({
                        ...value,
                        medals: value.medals.filter((item) => item !== medal),
                    }),
            })
        }
        if (value.title?.trim()) {
            filters.push({
                key: "title",
                label: `Title: ${value.title.trim()}`,
                clear: () => onChange({ ...value, title: "" }),
            })
        }
        if (value.body?.trim()) {
            filters.push({
                key: "body",
                label: `Body: ${value.body.trim()}`,
                clear: () => onChange({ ...value, body: "" }),
            })
        }
        if (value.project?.trim()) {
            filters.push({
                key: "project",
                label: `Project: ${value.project.trim()}`,
                clear: () => onChange({ ...value, project: "" }),
            })
        }
        if (value.notes?.trim()) {
            filters.push({
                key: "notes",
                label: `Notes: ${value.notes.trim()}`,
                clear: () => onChange({ ...value, notes: "" }),
            })
        }
        return filters
    }, [onChange, value])

    const hasAnyFilter = activeFilters.length > 0

    return (
        <section aria-label="Search">
            <form onSubmit={submit} className="mb-5">
                <div className="flex items-end gap-3">
                    <label className="block flex-1">
                        <span className="label-text">Search</span>
                        <input
                            type="search"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Search poems…"
                            className="mt-1 w-full border-b border-rule bg-transparent py-2 font-serif text-lg outline-none focus:border-accent"
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
                        className={`label-text border-b pb-1 transition-colors ${
                            hasAdvanced(value)
                                ? "border-accent text-accent"
                                : "border-muted text-muted hover:border-ink hover:text-ink"
                        }`}
                    >
                        Advanced{advancedCount ? ` · ${advancedCount}` : ""}
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {hasAnyFilter && (
                        <p className="label-text text-muted">
                            {`${activeFilters.length} active filter${activeFilters.length === 1 ? "" : "s"}`}
                        </p>
                    )}
                    {hasAnyFilter && (
                        <button
                            type="button"
                            onClick={() => {
                                setDraft("")
                                onChange({ q: "", ...EMPTY_ADVANCED })
                            }}
                            className="label-text text-muted hover:text-ink"
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
