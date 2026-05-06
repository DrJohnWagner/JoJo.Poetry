export default function Tab({
    tab,
    value,
    children,
    className = "",
}: {
    tab: number
    value: number
    children: React.ReactNode
    className?: string
}) {
    return tab === value ? <div className={className}>{children}</div> : null
}
