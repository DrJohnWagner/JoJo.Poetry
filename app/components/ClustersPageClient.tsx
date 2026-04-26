"use client"

import { useEffect, useState } from "react"
import type { ClusterResponse, Poem, RecentList } from "@/lib/types"
import { fetchClusters } from "@/lib/api"
import type { ClusterGroup } from "@/lib/cluster"
import Page from "@/components/Page"
import LColumn from "@/components/LColumn"
import RColumn from "@/components/RColumn"
import Header from "@/components/Header"
import ClusteringUI from "@/components/ClusteringUI"
import RecentPoems from "@/components/RecentPoems"
import TopClusteredPoems from "@/components/TopClusteredPoems"
import ClusterCheckboxes from "@/components/cluster/ClusterCheckboxes"

export default function ClustersPageClient({
    initial,
    recent,
}: {
    initial: { items: Poem[]; total: number; has_more: boolean }
    recent: RecentList
}) {
    const [selected, setSelected] = useState<ClusterGroup[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<ClusterResponse | null>(null)

    function toggle(cat: ClusterGroup) {
        setSelected((prev) => {
            const next = prev.includes(cat)
                ? prev.filter((c) => c !== cat)
                : [...prev, cat]

            if (next.length === 0) {
                setResult(null)
                setError(null)
                setLoading(false)
            }

            return next
        })
    }

    function handlePinnedChange(poemId: string, pinned: boolean) {
        setResult((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                clusters: prev.clusters.map((cluster) => ({
                    ...cluster,
                    poems: cluster.poems.map((poem) =>
                        poem.id === poemId ? { ...poem, pinned } : poem
                    ),
                })),
            }
        })
    }

    useEffect(() => {
        if (selected.length === 0) return

        let cancelled = false

        async function run() {
            setLoading(true)
            setError(null)
            setResult(null)
            try {
                const next = await fetchClusters(selected)
                if (!cancelled) setResult(next)
            } catch (e) {
                if (!cancelled) {
                    setResult(null)
                    setError(e instanceof Error ? e.message : "Request failed")
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [selected])

    const showingClusteredPoems = selected.length > 0 && !!result

    return (
        <Page>
            <LColumn>
                <Header />
                <div className="mb-6">
                    <ClusterCheckboxes selected={selected} toggle={toggle} />
                </div>
                <ClusteringUI
                    initial={initial}
                    selected={selected}
                    loading={loading}
                    error={error}
                    result={result}
                    onPinnedChange={handlePinnedChange}
                />
            </LColumn>
            <RColumn>
                {showingClusteredPoems ? (
                    <TopClusteredPoems result={result} />
                ) : (
                    <RecentPoems recent={recent} />
                )}
            </RColumn>
        </Page>
    )
}