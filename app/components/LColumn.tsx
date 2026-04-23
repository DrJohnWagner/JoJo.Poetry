export default function LColumn({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="mx-auto w-full max-w-prose lg:mx-0 lg:shrink-0 lg:grow-0 lg:basis-[65ch]">
            {children}
        </div>
    )
}
