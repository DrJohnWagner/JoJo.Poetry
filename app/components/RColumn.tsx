export default function RColumn({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <aside className="mx-auto mt-12 max-w-prose lg:mx-0 lg:mt-0 lg:max-w-none lg:pt-[106px]">
            {children}
        </aside>
    )
}
