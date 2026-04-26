import Link from "next/link"
import Header from "@/components/Header"
import PoemCreateForm from "@/components/PoemCreateForm"

export const dynamic = "force-dynamic"

export default function NewPoemPage() {
    return (
        <div className="mx-auto max-w-prose">
            <Header />
            <article>
                <header className="mb-10">
                    <h1 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
                        New poem
                    </h1>
                </header>
                <PoemCreateForm />
            </article>
        </div>
    )
}
