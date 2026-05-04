export type Filter = string

function toLabel(name: string): string {
    return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FilterSelector({
    filters,
    value,
    onChange,
}: {
    filters: string[]
    value: Filter
    onChange: (v: Filter) => void
}) {
    return (
        <div>
            <span className="text-label tracking-widest text-xs uppercase block mb-2">Filters</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {filters.map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => onChange(f)}
                        className="flex flex-col items-center gap-1"
                    >
                        <div
                            className={`w-12 h-12 border transition-colors ${
                                value === f
                                    ? "border-ink"
                                    : "border-[#d4d0c8] hover:border-ink"
                            }`}
                            style={{ backgroundColor: "#e8e4dc" }}
                        />
                        <span
                            className={`text-xs transition-colors ${
                                value === f
                                    ? "text-ink border-b border-ink"
                                    : "text-muted"
                            }`}
                        >
                            {toLabel(f)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}
