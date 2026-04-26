import { notFound } from "next/navigation"
import Link from "next/link"
import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import PoemDetail from "@/components/poem/PoemDetail"
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
        <Page>
            <LColumn>
                <Header />
                <PoemDetail poem={poem} />
            </LColumn>
            <RColumn>
                {similarities && <SimilarPoems bundle={similarities} />}
            </RColumn>
        </Page>
    )
}
