"use client"

import Link from "next/link"
import { useAppConfig } from "./AppConfig"

export default function Header() {
    const { readOnly } = useAppConfig()
    return (
        <header className="mb-10 flex items-end justify-between gap-6">
            <Link
                href="/"
                className="inline-block text-ink no-underline hover:no-underline"
            >
                <h1 className="font-display text-3xl leading-none tracking-tight md:text-4xl">
                    JoJo.Poetry
                </h1>
                <p className="eyebrow mt-2">Collected poems</p>
            </Link>
            <div className="flex items-end gap-5">
                <Link
                    href="/"
                    className="eyebrow border-b border-muted pb-1 transition-colors hover:border-ink hover:text-ink hover:no-underline"
                >
                    Home
                </Link>
                <Link
                    href="/clusters"
                    className="eyebrow border-b border-muted pb-1 transition-colors hover:border-ink hover:text-ink hover:no-underline"
                >
                    Clusters
                </Link>
                {!readOnly && (
                    <Link
                        href="/poems/new"
                        className="eyebrow border-b border-muted pb-1 transition-colors hover:border-ink hover:text-ink hover:no-underline"
                    >
                        New poem
                    </Link>
                )}
            </div>
        </header>
    )
}
