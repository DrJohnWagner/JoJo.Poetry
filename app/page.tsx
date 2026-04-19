import Header from "@/components/Header"
import PoemListing from "@/components/PoemListing"
import SimilarPoems from "@/components/SimilarPoems"
import { fetchPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Home() {
    const initial = await fetchPoems(
        { q: "", year: null, month: null, awards: [], title: "", body: "", project: "", notes: "" },
        0,
        3
    )

    const aside = {
        query_id: "00000000-0000-0000-0000-000000000000" as const,
        neighbours: initial.items.map((p) => ({
            id: p.id,
            title: p.title,
            project: p.project,
            score: 0,
        })),
    }

    return (
        <article className="lg:grid lg:grid-cols-[auto_20rem] lg:gap-12 lg:justify-center items-start">
            <div className="max-w-prose">
                <Header />
                <PoemListing
                    initial={{
                        items: initial.items,
                        total: initial.pagination.total,
                        has_more: initial.pagination.has_more,
                    }}
                />
            </div>
            <aside className="max-w-prose lg:max-w-none mt-12 lg:mt-0 lg:sticky lg:top-8">
                <SimilarPoems similarities={aside} />
            </aside>
        </article>
    )
}
