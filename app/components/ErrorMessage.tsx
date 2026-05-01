export default function ErrorMessage({
    message,
    show,
    className = "",
}: {
    message: string | null
    show?: boolean
    className?: string
}) {
    if (show === false || !message) return null
    return <p className={`text-red-700 ${className}`}>{message}</p>
}
