import Header from "@/components/Header"
import PoemListing from "@/components/PoemListing"
import RecentPoems from "@/components/RecentPoems"
import { fetchPoems, fetchRecentPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Home() {
    const [initial, recent] = await Promise.all([
        fetchPoems(
            { q: "", year: null, month: null, awards: [], title: "", body: "", project: "", notes: "" },
            0,
            3
        ),
        fetchRecentPoems(12),
    ])

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
                <RecentPoems recent={recent} />
            </aside>
        </article>
    )
}
