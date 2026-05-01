export default function LoadingMessage({
    message = "Loading\u2026",
    show,
    className = "",
}: {
    message?: string
    show?: boolean
    className?: string
}) {
    if (!show) return null
    return <p className={`text-label ${className}`}>{message}</p>
}
