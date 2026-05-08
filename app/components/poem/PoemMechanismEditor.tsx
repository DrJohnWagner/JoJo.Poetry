"use client"

/** Multi-line editor for the mechanism field.
 *  Each non-empty line in the textarea maps to one paragraph in the mechanism array.
 */
export default function PoemMechanismEditor({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <label className="block">
            <span className="text-label">Mechanism</span>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={6}
                placeholder="One paragraph per line."
                className="mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-3 font-sans text-sm leading-relaxed resize-y"
            />
            <span className="block text-[0.72rem] text-muted mt-1">
                One paragraph per line.
            </span>
        </label>
    )
}
