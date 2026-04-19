import { notFound } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import PoemDetail from "@/components/PoemDetail"
import SimilarPoems from "@/components/SimilarPoems"
import { fetchPoem, fetchSimilarPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function PoemPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    let poem
    let similarities
    
    try {
        poem = await fetchPoem(id)
    } catch (e: unknown) {
        if (e instanceof Error && /not found|404/i.test(e.message)) notFound()
        throw e
    }

    try {
        similarities = await fetchSimilarPoems(id)
    } catch {
        // Silently fail similarity so page still loads
        similarities = null
    }

    return (
        <article className="lg:grid lg:grid-cols-[auto_20rem] lg:gap-12 lg:justify-center items-start">
            <div className="max-w-prose">
                <Header />
                <nav className="mb-10 eyebrow">
                    <Link href="/" className="hover:text-ink hover:no-underline">← Index</Link>
                </nav>
                <PoemDetail poem={poem} />
            </div>
            
            <aside className="max-w-prose lg:max-w-none mt-12 lg:mt-0 lg:sticky lg:top-8">
                {similarities && <SimilarPoems bundle={similarities} />}
            </aside>
        </article>
    )
}
