"use client"

import { useEffect, useRef } from "react"
import { MEDALS, type SearchState } from "@/lib/types"
import ThemeAutocomplete from "./ThemeAutocomplete"

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

const inputCls =
    "mt-1 w-full border-b border-rule bg-transparent py-1 font-serif outline-none focus:border-accent"

function TextField({
    label,
    value,
    onChange,
    placeholder = "Substring match…",
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
}) {
    return (
        <label className="col-span-2 block">
            <span className="text-label">{label}</span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={inputCls}
            />
        </label>
    )
}

/** Accessible modal built on the native <dialog> element. */
export default function AdvancedSearchDialog({
    open,
    value,
    onChange,
    onClose,
    onClear,
}: {
    open: boolean
    value: SearchState
    onChange: (next: SearchState) => void
    onClose: () => void
    onClear: () => void
}) {
    const ref = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const d = ref.current
        if (!d) return
        if (open && !d.open) d.showModal()
        if (!open && d.open) d.close()
    }, [open])

    const toggleMedal = (a: string) => {
        const next = value.medals.includes(a)
            ? value.medals.filter((x) => x !== a)
            : [...value.medals, a]
        onChange({ ...value, medals: next })
    }

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => {
                // Click on backdrop (the dialog itself) closes; click on content does not.
                if (e.target === ref.current) onClose()
            }}
            className="w-[90vw] max-w-xl rounded-sm border border-rule bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/20"
        >
            <form
                method="dialog"
                className="p-8"
                onSubmit={(e) => {
                    e.preventDefault()
                    onClose()
                }}
            >
                <header className="mb-6 flex items-baseline justify-between">
                    <h2 className="font-display text-xl">Advanced search</h2>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={onClear}
                            aria-label="Clear"
                            className="text-label hover:text-accent"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="text-label hover:text-accent"
                        >
                            Close
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <TextField
                        label="Title"
                        value={value.title}
                        onChange={(v) => onChange({ ...value, title: v })}
                    />
                    <TextField
                        label="Body"
                        value={value.body}
                        onChange={(v) => onChange({ ...value, body: v })}
                    />
                    <TextField
                        label="Project"
                        value={value.project}
                        onChange={(v) => onChange({ ...value, project: v })}
                    />
                    <TextField
                        label="Author's Notes"
                        value={value.notes}
                        onChange={(v) => onChange({ ...value, notes: v })}
                    />

                    <fieldset className="col-span-2">
                        <legend className="text-label">Themes</legend>
                        <p className="mb-2 mt-1 text-[0.96rem] text-muted">
                            All selected must be present (AND).
                        </p>
                        <ThemeAutocomplete
                            value={value.themes}
                            onChange={(themes) =>
                                onChange({ ...value, themes })
                            }
                        />
                    </fieldset>

                    <label className="block">
                        <span className="text-label">Year</span>
                        <input
                            type="number"
                            min={1900}
                            max={2100}
                            value={value.year ?? ""}
                            onChange={(e) =>
                                onChange({
                                    ...value,
                                    year:
                                        e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                })
                            }
                            className={inputCls}
                        />
                    </label>
                    <label className="block">
                        <span className="text-label">Month</span>
                        <select
                            value={value.month ?? ""}
                            onChange={(e) =>
                                onChange({
                                    ...value,
                                    month:
                                        e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                })
                            }
                            className={inputCls}
                        >
                            <option value="">Any</option>
                            {MONTHS.slice(1).map((m, i) => (
                                <option key={m} value={i + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </label>

                    <fieldset className="col-span-2">
                        <legend className="text-label">Medals</legend>
                        <p className="mb-2 mt-1 text-[0.96rem] text-muted">
                            Any selected — “None” matches poems with no award
                            entries.
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {MEDALS.map((a) => (
                                <label
                                    key={a}
                                    className="inline-flex items-center gap-2 font-sans text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={value.medals.includes(a)}
                                        onChange={() => toggleMedal(a)}
                                    />
                                    {a}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </div>
            </form>
        </dialog>
    )
}
