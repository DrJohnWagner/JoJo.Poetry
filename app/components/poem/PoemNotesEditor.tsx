"use client"

/** Multi-line editor for the notes field.
 *  Each non-empty line in the textarea maps to one string in the notes array.
 */
export default function PoemNotesEditor({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <label className="block">
            <span className="text-label">Author&apos;s Notes</span>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                placeholder="One note per line."
                className="mt-1 w-full resize-y border border-rule bg-transparent p-3 font-sans text-sm leading-relaxed outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[0.72rem] text-muted">
                One note per line.
            </span>
        </label>
    )
}
