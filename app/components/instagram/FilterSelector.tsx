export type Filter = "none" | "clarendon" | "gingham" | "lark" | "juno" | "reyes"

const FILTERS: { label: string; value: Filter }[] = [
    { label: "None",       value: "none"      },
    { label: "Clarendon",  value: "clarendon" },
    { label: "Gingham",    value: "gingham"   },
    { label: "Lark",       value: "lark"      },
    { label: "Juno",       value: "juno"      },
    { label: "Reyes",      value: "reyes"     },
]

export default function FilterSelector({
    value,
    onChange,
}: {
    value: Filter
    onChange: (v: Filter) => void
}) {
    return (
        <div>
            <span className="text-label tracking-widest text-xs uppercase block mb-2">Filters</span>
            <div className="flex gap-3 flex-wrap">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => onChange(f.value)}
                        className="flex flex-col items-center gap-1"
                    >
                        <div
                            className={`w-12 h-12 border transition-colors ${
                                value === f.value
                                    ? "border-ink"
                                    : "border-[#d4d0c8] hover:border-ink"
                            }`}
                            style={{ backgroundColor: "#e8e4dc" }}
                        />
                        <span
                            className={`text-xs transition-colors ${
                                value === f.value
                                    ? "text-ink border-b border-ink"
                                    : "text-muted"
                            }`}
                        >
                            {f.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}
