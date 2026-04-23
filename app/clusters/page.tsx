import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import ClusteringUI from "@/components/ClusteringUI"
import RecentPoems from "@/components/RecentPoems"
import { fetchPoems, fetchRecentPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function ClustersPage() {
    const [initial, recent] = await Promise.all([
        fetchPoems(
            {
                q: "",
                year: null,
                month: null,
                medals: [],
                title: "",
                body: "",
                project: "",
                notes: "",
            },
            0,
            10
        ),
        fetchRecentPoems(12),
    ])

    return (
        <Page>
            <LColumn>
                <Header />
                <ClusteringUI
                    initial={{
                        items: initial.items,
                        total: initial.pagination.total,
                        has_more: initial.pagination.has_more,
                    }}
                />
            </LColumn>
            <RColumn>
                <RecentPoems recent={recent} />
            </RColumn>
        </Page>
    )
}
