export default function RColumn({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <aside className="hidden lg:block lg:min-w-0 lg:max-w-[32.5ch] lg:flex-1 lg:pt-[106px]">
            {children}
        </aside>
    )
}
