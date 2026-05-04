export default function ExcerptEditor({
    value,
    dirty,
    onChange,
    onUpdate,
}: {
    value: string
    dirty: boolean
    onChange: (v: string) => void
    onUpdate: () => void
}) {
    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between">
                <span className="text-label tracking-widest text-xs uppercase">Excerpt (Editable)</span>
                <button
                    type="button"
                    disabled={!dirty}
                    onClick={onUpdate}
                    className="text-label text-xs hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                >
                    Update
                </button>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={6}
                className="w-full resize-none bg-transparent text-ink placeholder:text-muted focus:outline-none border-b border-[#d4d0c8] py-1 font-serif text-sm leading-relaxed whitespace-pre"
                style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                spellCheck={false}
            />
        </div>
    )
}
