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
                <p className="label-text mt-2">Collected poems</p>
            </Link>
            <div className="flex items-end gap-5">
                <Link href="/" className="button-primary hover:no-underline">
                    Home
                </Link>
                <Link
                    href="/clusters"
                    className="button-primary hover:no-underline"
                >
                    Clusters
                </Link>
                {!readOnly && (
                    <Link
                        href="/poems/new"
                        className="button-primary hover:no-underline"
                    >
                        New poem
                    </Link>
                )}
            </div>
        </header>
    )
}
