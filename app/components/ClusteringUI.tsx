"use client"

import { useState } from "react"
import Link from "next/link"
import { fetchClusters } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { ClusterResponse } from "@/lib/types"

const CATEGORIES = [
    { id: "themes",             label: "themes" },
    { id: "emotional_register", label: "emotional register" },
    { id: "form_and_craft",     label: "form & craft" },
    { id: "images",             label: "images" },
    { id: "contest_fit",        label: "contest fit" },
] as const

const CATEGORY_LABELS: Record<string, string> = {
    themes:             "themes",
    emotional_register: "emotional register",
    form_and_craft:     "form & craft",
    images:             "images",
    contest_fit:        "contest fit",
}

export default function ClusteringUI() {
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading]   = useState(false)
    const [error, setError]       = useState<string | null>(null)
    const [result, setResult]     = useState<ClusterResponse | null>(null)

    function toggle(cat: string) {
        setSelected((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        )
    }

    async function submit() {
        if (selected.length === 0) return
        setLoading(true)
        setError(null)
        try {
            setResult(await fetchClusters(selected))
        } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed")
        } finally {
            setLoading(false)
        }
    }

    function clear() {
        setSelected([])
        setResult(null)
        setError(null)
    }

    const totalPoems = result
        ? result.clusters.reduce((s, c) => s + c.size, 0)
        : 0

    return (
        <section>
            {/* Controls */}
            <div>
                <p className="eyebrow">Cluster by:</p>
                <ul className="mt-3 space-y-2">
                    {CATEGORIES.map(({ id, label }) => (
                        <li key={id}>
                            <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(id)}
                                    onChange={() => toggle(id)}
                                    className="accent-ink"
                                />
                                {label}
                            </label>
                        </li>
                    ))}
                </ul>
                <div className="mt-5 flex items-center gap-5">
                    <button
                        onClick={submit}
                        disabled={selected.length === 0 || loading}
                        className="eyebrow border-b border-muted pb-1 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading ? "Clustering\u2026" : "Cluster"}
                    </button>
                    {(selected.length > 0 || result !== null) && (
                        <button
                            onClick={clear}
                            className="eyebrow text-muted transition-colors hover:text-ink"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Placeholder */}
            {!result && !loading && !error && (
                <p className="mt-10 font-sans text-sm text-muted">
                    Select one or more categories and click Cluster.
                </p>
            )}

            {/* Error */}
            {error && (
                <p className="mt-8 font-sans text-sm text-red-700">{error}</p>
            )}

            {/* Results */}
            {result && (
                <>
                    <div className="rule mt-8 mb-6" />

                    {/* Summary */}
                    <p className="eyebrow">
                        {result.categories_used
                            .map((c) => CATEGORY_LABELS[c] ?? c)
                            .join(", ")}
                        {" · "}
                        {result.clusters.length}{" "}
                        {result.clusters.length === 1 ? "cluster" : "clusters"}
                        {" · "}
                        {totalPoems}{" "}
                        {totalPoems === 1 ? "poem" : "poems"}
                        {result.excluded.length > 0 &&
                            ` · ${result.excluded.length} excluded`}
                    </p>

                    {/* Clusters */}
                    <div className="mt-8 space-y-10">
                        {result.clusters.map((cluster, i) => (
                            <div key={i}>
                                <div className="flex items-baseline gap-3">
                                    <h3 className="font-serif text-[1.1rem] font-semibold leading-tight">
                                        {cluster.label}
                                    </h3>
                                    <span className="eyebrow">
                                        {cluster.size}{" "}
                                        {cluster.size === 1 ? "poem" : "poems"}
                                    </span>
                                </div>
                                {cluster.features.length > 0 && (
                                    <p className="taglist mt-1">
                                        {cluster.features
                                            .map((f) => f.split(":").slice(1).join(":") || f)
                                            .join(" · ")}
                                    </p>
                                )}
                                <ul className="mt-4 space-y-3">
                                    {cluster.poems.map((p) => (
                                        <li key={p.id}>
                                            <h4 className="font-serif text-[1rem] leading-tight">
                                                <Link
                                                    href={`/poems/${p.id}`}
                                                    className="font-semibold text-ink hover:text-accent hover:underline"
                                                >
                                                    {p.title}
                                                </Link>
                                            </h4>
                                            <p className="eyebrow mt-0.5">
                                                {formatDate(p.date)}
                                                {" · "}
                                                {p.rating}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Excluded */}
                    {result.excluded.length > 0 && (
                        <div className="mt-10">
                            <div className="rule mb-6" />
                            <p className="eyebrow mb-4">
                                Unclustered — cluster too small
                            </p>
                            <ul className="space-y-3">
                                {result.excluded.map((e) => (
                                    <li key={String(e.id)}>
                                        <h4 className="font-serif text-[1rem] leading-tight">
                                            <Link
                                                href={`/poems/${e.id}`}
                                                className="font-semibold text-ink hover:text-accent hover:underline"
                                            >
                                                {e.title}
                                            </Link>
                                        </h4>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
