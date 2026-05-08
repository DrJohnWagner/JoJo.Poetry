export default function ExcerptEditor({
    value,
    dirty,
    onChange,
    onUpdate,
    onRevert,
}: {
    value: string
    dirty: boolean
    onChange: (v: string) => void
    onUpdate: () => void
    onRevert: () => void
}) {
    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between">
                <span className="text-label text-xs uppercase tracking-widest">
                    Excerpt
                </span>
                <div className="flex items-baseline gap-3">
                    <button
                        type="button"
                        disabled={!dirty}
                        onClick={onUpdate}
                        className="text-label text-xs hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    >
                        Update
                    </button>
                    <button
                        type="button"
                        disabled={!dirty}
                        onClick={onRevert}
                        className="text-label text-xs hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    >
                        Revert
                    </button>
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={7}
                className="w-full resize-none whitespace-pre border-b border-[#d4d0c8] bg-transparent py-1 font-serif text-base leading-relaxed text-ink placeholder:text-muted focus:outline-none"
                spellCheck={false}
            />
        </div>
    )
}
