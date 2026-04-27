import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import PoemListing from "@/components/poem/PoemListing"
import RecentPoems from "@/components/RecentPoems"
import { fetchPoems, fetchRecentPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function Home() {
    const [initial, recent] = await Promise.all([
        fetchPoems({ q: "", year: null, month: null, medals: [], title: "", body: "", project: "", notes: "" }),
        fetchRecentPoems(12),
    ])

    return (
        <Page>
            <LColumn>
                <Header />
                <PoemListing initial={initial.items} />
            </LColumn>
            <RColumn>
                <RecentPoems recent={recent} />
            </RColumn>
        </Page>
    )
}
