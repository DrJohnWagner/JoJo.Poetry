import Link from "next/link"
import { FaMedal } from "react-icons/fa"
import type { Award, PoemSummaryData } from "@/lib/types"
import { medalColor } from "@/lib/format"

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

export default function AwardEntry({
    poem,
    award,
}: {
    poem: PoemSummaryData
    award: Award
}) {
    const medalLabel = award.medal === "Honorable Mention" ? "HM" : award.medal
    return (
        <>
            {/* Row 1: medal text | date spanning cols 2–3 */}
            <span className="text-label self-baseline justify-self-center">
                {medalLabel}
            </span>
            <p className="text-label col-span-2">{formatDate(award.closed)}</p>

            {/* Row 2: medal icon | poem title | contest title */}
            <FaMedal
                className="self-center justify-self-center"
                style={{ color: medalColor(award.medal), fontSize: "1.7em" }}
            />
            <Link href={`/poems/${poem.id}`} className="text-entry">
                {poem.title}
            </Link>
            {/* <h3 className="self-center">
                <Link href={`/poems/${poem.id}`} className="text-entry">
                    {poem.title}
                </Link>
            </h3> */}
            {award.title ? (
                <a
                    href={award.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-entry"
                >
                    {award.title} ↗
                </a>
            ) : (
                <span />
            )}
        </>
    )
}
