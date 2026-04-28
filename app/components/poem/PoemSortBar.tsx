"use client"

export type SortField = "title" | "date" | "lines" | "words" | "rating" | "award_count"
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
    { field: "award_count", label: "Awards", defaultDir: "desc" },
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
            <p className="label-text mb-3 text-muted">Sort</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
                {FIELDS.map(({ field, label, defaultDir }) => {
                    const active = sort.field === field
                    return (
                        <button
                            key={field}
                            onClick={() =>
                                onChange(
                                    active
                                        ? {
                                              field,
                                              dir:
                                                  sort.dir === "asc"
                                                      ? "desc"
                                                      : "asc",
                                          }
                                        : { field, dir: defaultDir }
                                )
                            }
                            className={`button-sort ${active ? "button-sort-active" : "button-sort-inactive"}`}
                        >
                            {label}
                            {active && (
                                <span className="ml-1">
                                    {sort.dir === "asc" ? "↑" : "↓"}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
