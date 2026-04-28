"use client"

export type AwardSortField = "date" | "medal" | "poem_title" | "contest_title"
export type SortDir = "asc" | "desc"

export interface AwardSortState {
    field: AwardSortField
    dir: SortDir
}

export const DEFAULT_AWARD_SORT: AwardSortState = { field: "date", dir: "desc" }

const FIELDS: { field: AwardSortField; label: string; defaultDir: SortDir }[] =
    [
        { field: "medal", label: "Medal", defaultDir: "asc" },
        { field: "date", label: "Date", defaultDir: "desc" },
        { field: "poem_title", label: "Poem", defaultDir: "asc" },
        { field: "contest_title", label: "Contest", defaultDir: "asc" },
    ]

export default function AwardsSortBar({
    sort,
    onChange,
}: {
    sort: AwardSortState
    onChange: (s: AwardSortState) => void
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
                                        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
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
