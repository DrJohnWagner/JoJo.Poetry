import { notFound } from "next/navigation"
import Link from "next/link"
import PoemDetail from "@/components/PoemDetail"
import { fetchPoem } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function PoemPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    let poem
    try {
        poem = await fetchPoem(id)
    } catch (e: unknown) {
        if (e instanceof Error && /not found|404/i.test(e.message)) notFound()
        throw e
    }
    return (
        <article>
            <nav className="mb-10 eyebrow">
                <Link href="/" className="hover:text-ink hover:no-underline">← Index</Link>
            </nav>
            <PoemDetail poem={poem} />
        </article>
    )
}
