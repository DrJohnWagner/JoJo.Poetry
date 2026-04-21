import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import ClusteringUI from "@/components/ClusteringUI"
import RecentPoems from "@/components/RecentPoems"
import { fetchRecentPoems } from "@/lib/api"

export const dynamic = "force-dynamic"

export default async function ClustersPage() {
    const recent = await fetchRecentPoems(12)

    return (
        <Page>
            <LColumn>
                <Header />
                <ClusteringUI />
            </LColumn>
            <RColumn>
                <RecentPoems recent={recent} />
            </RColumn>
        </Page>
    )
}
