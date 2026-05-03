export default function ImagePromptInput({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="mt-5">
            <div className="flex items-baseline justify-between mb-1">
                <span className="text-label tracking-widest text-xs uppercase">Image Prompt</span>
                <button type="button" className="text-label text-xs hover:text-ink">Advanced</button>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter or edit the image prompt…"
                rows={3}
                className="w-full resize-none border-b border-[#d4d0c8] bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink py-1"
            />
        </div>
    )
}
