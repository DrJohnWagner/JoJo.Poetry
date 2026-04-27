import ClustersPageClient from "@/components/ClustersPageClient"
import { fetchPoems, fetchRecentPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function ClustersPage() {
    const [initial, recent] = await Promise.all([
        fetchPoems({ q: "", year: null, month: null, medals: [], title: "", body: "", project: "", notes: "" }),
        fetchRecentPoems(12),
    ])

    return (
        <ClustersPageClient
            initial={initial.items}
            recent={recent}
        />
    )
}
