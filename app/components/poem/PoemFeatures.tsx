import { Fragment } from "react"
import Link from "next/link"
import { toLabel } from "@/lib/format"

type Item = { label: string; href: string | null }

function parse(s: string): Item {
    if (s.startsWith("/?")) {
        const raw = new URLSearchParams(s.slice(2)).values().next().value ?? ""
        return { label: toLabel(raw), href: s }
    }
    return { label: toLabel(s), href: null }
}

function dedupeByLabel(items: Item[]): Item[] {
    return [...new Map(items.map((item) => [item.label, item])).values()]
}

const PoemFeatures = ({
    features,
    className = "",
}: {
    features?: string[]
    className?: string
}) => {
    if (!features || features.length === 0) return null

    const items = dedupeByLabel(features.map(parse)).sort((a, b) =>
        a.label.localeCompare(b.label)
    )

    return (
        <div className={`text-meta ${className}`}>
            {items.map((item, i) => (
                <Fragment key={item.label}>
                    {i > 0 && " · "}
                    {item.href ? (
                        <Link href={item.href}>{item.label}</Link>
                    ) : (
                        item.label
                    )}
                </Fragment>
            ))}
        </div>
    )
}

export default PoemFeatures
