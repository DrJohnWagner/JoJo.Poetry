export default function Page({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <article className="items-start lg:grid lg:grid-cols-[auto_clamp(20rem,33vw,30rem)] lg:justify-center lg:gap-12">
            {children}
        </article>
    )
}
