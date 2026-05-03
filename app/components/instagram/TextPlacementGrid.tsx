export type Placement =
    | "top-left" | "top" | "top-right"
    | "left"     | "centre" | "right"
    | "bottom-left" | "bottom" | "bottom-right"

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
            <span className="text-label tracking-widest text-xs uppercase block mb-2">Place Text on Image</span>
            <div className="grid grid-cols-3 gap-1" style={{ width: 120 }}>
                {GRID.map((cell) => (
                    <button
                        key={cell.value}
                        type="button"
                        onClick={() => onChange(cell.value)}
                        title={cell.label}
                        className={`flex items-center justify-center text-base leading-none transition-colors ${
                            value === cell.value
                                ? "text-ink border border-ink"
                                : "text-muted border border-[#d4d0c8] hover:border-ink hover:text-ink"
                        }`}
                        style={{ width: 36, height: 36 }}
                    >
                        {cell.symbol}
                    </button>
                ))}
            </div>
        </div>
    )
}
