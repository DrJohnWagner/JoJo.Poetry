import type { FilterOption } from "@/lib/types"

export type Filter = string

function toLabel(name: string): string {
    return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FilterSelector({
    filters,
    value,
    onChange,
}: {
    filters: FilterOption[]
    value: Filter
    onChange: (v: Filter) => void
}) {
    return (
        <div>
            <span className="text-label mb-2 block text-xs uppercase tracking-widest">
                Filters
            </span>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {filters.map((f) => (
                    <button
                        key={f.name}
                        type="button"
                        onClick={() => onChange(f.name)}
                        className="flex flex-col items-center gap-1"
                    >
                        <div
                            className={`h-16 w-16 border transition-colors ${
                                value === f.name
                                    ? "border-ink"
                                    : "border-[#d4d0c8] hover:border-ink"
                            }`}
                        >
                            {f.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={f.image}
                                    alt={toLabel(f.name)}
                                    className="h-full w-full object-cover"
                                />
                            )}
                        </div>
                        <span
                            className={`text-xs transition-colors ${
                                value === f.name
                                    ? "border-b border-ink text-ink"
                                    : "text-muted"
                            }`}
                        >
                            {toLabel(f.name)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}
