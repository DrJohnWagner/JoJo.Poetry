import Link from "next/link"
import { FaMedal } from "react-icons/fa"
import type { Award, PoemSummaryData } from "@/lib/types"

function medalColor(medal: string): string {
    if (medal === "Gold") return "#b8860b"
    if (medal === "Silver") return "#888"
    if (medal === "Bronze") return "#a0522d"
    if (medal === "Honorable Mention") return "#4a7c59"
    return "currentColor"
}

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
            <span className="label-text self-baseline justify-self-center">
                {medalLabel}
            </span>
            <p className="label-text col-span-2">{formatDate(award.closed)}</p>

            {/* Row 2: medal icon | poem title | contest title */}
            <FaMedal
                className="self-center justify-self-center"
                style={{ color: medalColor(award.medal), fontSize: "1.7em" }}
            />
            <h3 className="self-center font-sans text-[0.9rem] text-ink/80">
                <Link
                    href={`/poems/${poem.id}`}
                    className="self-center font-sans text-[0.9rem] text-ink/80"
                >
                    {poem.title}
                </Link>
            </h3>
            {award.title ? (
                <a
                    href={award.url}
                    target="_blank"
                    rel="noreferrer"
                    className="self-center font-sans text-[0.9rem] text-ink/80"
                >
                    {award.title} ↗
                </a>
            ) : (
                <span />
            )}
        </>
    )
}
