import Link from "next/link"
import PoemCreateForm from "@/components/PoemCreateForm"

export const dynamic = "force-dynamic"

export default function NewPoemPage() {
    return (
        <article>
            <nav className="mb-10 eyebrow">
                <Link href="/">← Index</Link>
            </nav>
            <header className="mb-10">
                <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight">
                    New poem
                </h1>
            </header>
            <PoemCreateForm />
        </article>
    )
}
