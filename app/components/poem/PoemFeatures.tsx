import { Fragment } from "react"
import Link from "next/link"
import { toLabel } from "@/lib/format"

type Item = { label: string; href: string | null }

function parse(s: string): Item {
    if (s.startsWith("/?")) {
        const eq = s.indexOf("=")
        const raw = eq === -1 ? "" : decodeURIComponent(s.slice(eq + 1))
        return { label: toLabel(raw), href: s }
    }
    return { label: toLabel(s), href: null }
}

const PoemFeatures = ({
    features,
    className = "",
}: {
    features?: string[]
    className?: string
}) => {
    if (!features || features.length === 0) return null

    const items = [
        ...new Map(
            features.map(parse).map((item) => [item.label, item])
        ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label))

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
