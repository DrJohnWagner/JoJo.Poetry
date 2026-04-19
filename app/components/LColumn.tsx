export default function LColumn({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="mx-auto max-w-prose lg:mx-0">
            {children}
        </div>
    )
}
