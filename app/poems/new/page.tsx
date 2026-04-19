import Link from "next/link"
import Header from "@/components/Header"
import PoemCreateForm from "@/components/PoemCreateForm"

export const dynamic = "force-dynamic"

export default function NewPoemPage() {
    return (
        <div className="mx-auto max-w-prose">
        <Header />
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
        </div>
    )
}
