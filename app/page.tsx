import PoemListing from "@/components/PoemListing"
import { fetchPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Home() {
    const initial = await fetchPoems(
        { q: "", year: null, month: null, awards: [], title: "", body: "", project: "", notes: "" },
        0,
        3
    )
    return (
        <PoemListing
            initial={{
                items: initial.items,
                total: initial.pagination.total,
                has_more: initial.pagination.has_more,
            }}
        />
    )
}
