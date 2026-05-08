export default function UpdateRevertEditor({
    value,
    dirty,
    onChange,
    onUpdate,
    onRevert,
}: {
    value: string
    dirty: boolean
    onChange: (v: string) => void
    onUpdate?: () => void
    onRevert?: () => void
}) {
    const disabledClassName = "disabled:pointer-events-none disabled:opacity-30"
    const buttonClassName = `text-label text-xs hover:text-ink ${disabledClassName}`
    return (
        <div>
            <div className="mb-2 flex justify-end gap-5">
                {onUpdate && (
                    <button
                        type="button"
                        disabled={!dirty}
                        onClick={onUpdate}
                        className={buttonClassName}
                    >
                    Update
                </button>
                )}
                {onRevert && (
                    <button
                        type="button"
                        disabled={!dirty}
                        onClick={onRevert}
                        className={buttonClassName}
                    >
                        Revert
                    </button>
                )}
                <button
                    type="button"
                    disabled={!value}
                    onClick={() => onChange("")}
                    className={buttonClassName}
                >
                    Clear
                </button>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={8}
                className="w-full resize-none whitespace-pre border-b border-[#d4d0c8] bg-transparent py-1 text-base leading-relaxed text-ink placeholder:text-muted focus:outline-none"
                spellCheck={false}
            />
        </div>
    )
}
