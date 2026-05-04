export default function ImagePromptInput({
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
        <div className="mt-5">
            <div className="mb-1 flex items-baseline justify-between">
                <span className="text-label text-xs uppercase tracking-widest">
                    Image Prompt
                </span>
                <div className="flex items-baseline gap-3">
                    <button
                        type="button"
                        disabled={!dirty || !value}
                        onClick={onUpdate}
                        className="text-label text-xs hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    >
                        Update
                    </button>
                    <button
                        type="button"
                        disabled={!value}
                        onClick={() => onChange("")}
                        className="text-label text-xs hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter or edit the image prompt…"
                rows={5}
                className="w-full resize-none border-b border-[#d4d0c8] bg-transparent py-1 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
        </div>
    )
}
