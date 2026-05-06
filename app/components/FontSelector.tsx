import type { FontOption } from "@/lib/types"

export default function FontSelector({
    value,
    onChange,
    fonts = [],
    mruFonts = [],
}: {
    value: string
    onChange: (v: string) => void
    fonts?: FontOption[]
    mruFonts?: string[]
}) {
    const recentFilenames = new Set(mruFonts)
    const labelOf = Object.fromEntries(fonts.map((f) => [f.filename, f.label]))
    const recentValid = mruFonts.filter((fn) => fn in labelOf)
    const rest = fonts.filter((f) => !recentFilenames.has(f.filename))

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="cursor-pointer border-b border-[#d4d0c8] bg-transparent text-sm text-ink focus:outline-none"
        >
            {fonts.length === 0 ? (
                <option value={value}>{value}</option>
            ) : (
                <>
                    {recentValid.length > 0 && (
                        <optgroup label="Recent">
                            {recentValid.map((fn) => (
                                <option key={fn} value={fn}>
                                    {labelOf[fn]}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    <optgroup label="All Fonts">
                        {rest.map((f) => (
                            <option key={f.filename} value={f.filename}>
                                {f.label}
                            </option>
                        ))}
                    </optgroup>
                </>
            )}
        </select>
    )
}
