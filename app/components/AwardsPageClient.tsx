import type { PoemSummaryData } from "@/lib/types"
import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import AwardsList from "@/components/awards/AwardsList"
import AwardedPoems from "@/components/awards/AwardedPoems"

export default function AwardsPageClient({
    awarded,
}: {
    awarded: PoemSummaryData[]
}) {
    return (
        <Page>
            <LColumn>
                <Header />
                <AwardsList poems={awarded} />
            </LColumn>
            <RColumn>
                <AwardedPoems poems={awarded} />
            </RColumn>
        </Page>
    )
}
