interface ErrorMessageProps {
    message: string | null
    className?: string
}

export default function ErrorMessage({
    message,
    className = "",
}: ErrorMessageProps) {
    if (!message) return null
    return <p className={`text-red-700 ${className}`}>{message}</p>
}
