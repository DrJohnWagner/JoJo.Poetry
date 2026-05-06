export default function DialogTitle({
    title,
    subtitle,
    onClose,
}: {
    title: string
    subtitle: string
    onClose: () => void
}) {
    return (
        <>
            <div className="flex items-baseline justify-between border-b border-[#d4d0c8] px-8 py-4">
                <h2 className="text-title text-title-lg">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-label text-sm transition-colors hover:text-ink"
                >
                    Close
                </button>
            </div>
            <div className="px-8 py-2">
                <p className="text-title text-title-md">{subtitle}</p>
            </div>
        </>
    )
}
