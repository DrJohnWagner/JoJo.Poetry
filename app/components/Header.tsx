import Link from "next/link"

export default function Header() {
    const readOnly = process.env.READ_ONLY !== "false"
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
            {!readOnly && (
                <Link
                    href="/poems/new"
                    className="eyebrow border-b border-muted pb-1 transition-colors hover:border-ink hover:text-ink hover:no-underline"
                >
                    New poem
                </Link>
            )}
        </header>
    )
}
