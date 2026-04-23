export default function Page({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <article className="mx-auto flex w-full items-start justify-center gap-12 px-4 sm:px-6 lg:px-8">
            {children}
        </article>
    )
}
