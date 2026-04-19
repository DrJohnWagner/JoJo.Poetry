"use client"

export type SortField = "title" | "date" | "lines" | "words" | "rating" | "contest_count"
export type SortDir = "asc" | "desc"

export interface SortState {
    field: SortField
    dir: SortDir
}

export const DEFAULT_SORT: SortState = { field: "date", dir: "desc" }

const FIELDS: { field: SortField; label: string; defaultDir: SortDir }[] = [
    { field: "title", label: "Title", defaultDir: "asc" },
    { field: "date", label: "Date", defaultDir: "desc" },
    { field: "rating", label: "Rating", defaultDir: "desc" },
    { field: "lines", label: "Lines", defaultDir: "desc" },
    { field: "words", label: "Words", defaultDir: "desc" },
    { field: "contest_count", label: "Awards", defaultDir: "desc" },
]

export default function SortBar({
    sort,
    onChange,
}: {
    sort: SortState
    onChange: (s: SortState) => void
}) {
    return (
        <div className="mb-6">
            <p className="eyebrow mb-3 text-muted">Sort</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
                {FIELDS.map(({ field, label, defaultDir }) => {
                    const active = sort.field === field
                    return (
                        <button
                            key={field}
                            onClick={() =>
                                onChange(
                                    active
                                        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
                                        : { field, dir: defaultDir }
                                )
                            }
                            className={[
                                "eyebrow pb-0.5 border-b transition-colors",
                                active
                                    ? "border-accent text-accent"
                                    : "border-transparent text-muted hover:text-ink hover:border-ink/30",
                            ].join(" ")}
                        >
                            {label}
                            {active && (
                                <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
