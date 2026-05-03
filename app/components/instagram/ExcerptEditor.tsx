export default function ExcerptEditor({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div>
            <span className="text-label tracking-widest text-xs uppercase block mb-2">Excerpt (Editable)</span>
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
