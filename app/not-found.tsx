import Link from "next/link"

export default function NotFound() {
    return (
        <div className="py-16">
            <h2 className="font-display text-2xl mb-3">Not here.</h2>
            <p className="text-muted leading-relaxed">
                That poem isn’t in the collection.{" "}
                <Link href="/">Return to index</Link>.
            </p>
        </div>
    )
}
