"use client"

/** Multi-line editor for the notes field.
 *  Each non-empty line in the textarea maps to one string in the notes array.
 */
export default function NotesEditor({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <label className="block">
            <span className="eyebrow">Author&#39;s Notes</span>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                placeholder="One note per line."
                className="mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-3 font-sans text-sm leading-relaxed resize-y"
            />
            <span className="block text-[0.72rem] text-muted mt-1">
                One note per line.
            </span>
        </label>
    )
}
