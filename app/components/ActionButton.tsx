export default function ActionButton({
    icon: Icon,
    label,
    onClick,
    disabled = false
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="text-label flex items-center gap-2 text-sm transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
            <Icon className="text-base" />
            {label}
        </button>
    )
}
