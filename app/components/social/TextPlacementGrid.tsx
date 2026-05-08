export type { Placement } from "@/lib/types"
import type { Placement } from "@/lib/types"

const GRID: { label: string; value: Placement; symbol: string }[] = [
    { label: "Top Left",     value: "top-left",     symbol: "↖" },
    { label: "Top",          value: "top",           symbol: "↑" },
    { label: "Top Right",    value: "top-right",     symbol: "↗" },
    { label: "Left",         value: "left",          symbol: "←" },
    { label: "Centre",       value: "centre",        symbol: "·" },
    { label: "Right",        value: "right",         symbol: "→" },
    { label: "Bottom Left",  value: "bottom-left",   symbol: "↙" },
    { label: "Bottom",       value: "bottom",        symbol: "↓" },
    { label: "Bottom Right", value: "bottom-right",  symbol: "↘" },
]

export default function TextPlacementGrid({
    value,
    onChange,
}: {
    value: Placement
    onChange: (v: Placement) => void
}) {
    return (
        <div>
            <span className="text-label mb-2 block text-xs uppercase tracking-widest">
                Place Text
            </span>
            <div className="grid grid-cols-3 gap-1" style={{ width: 120 }}>
                {GRID.map((cell) => (
                    <button
                        key={cell.value}
                        type="button"
                        onClick={() => onChange(cell.value)}
                        title={cell.label}
                        className={`flex items-center justify-center text-base leading-none transition-colors ${
                            value === cell.value
                                ? "border border-ink text-ink"
                                : "border border-[#d4d0c8] text-muted hover:border-ink hover:text-ink"
                        }`}
                        style={{ width: 40, height: 40 }}
                    >
                        {cell.symbol}
                    </button>
                ))}
            </div>
        </div>
    )
}
