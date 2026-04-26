import { FaMedal } from "react-icons/fa"
import type { Award } from "@/lib/types"

const MAX_AWARD_TITLE_LENGTH = 28

function truncateAwardTitle(
    title: string,
    length: number = MAX_AWARD_TITLE_LENGTH
): string {
    if (title.length <= length) return title
    return `${title.slice(0, length)}...`
}

function medalColor(medal: string): string {
    if (medal === "Gold") return "#b8860b"
    if (medal === "Silver") return "#888"
    if (medal === "Bronze") return "#a0522d"
    if (medal === "Honorable Mention") return "#4a7c59"
    if (medal === "HM") return "#4a7c59"
    return "currentColor"
}

export default function PoemAward({ award }: { award: Award }) {
    const medal = award.medal === "Honorable Mention" ? "HM" : award.medal
    return (
        <>
            <FaMedal style={{ color: medalColor(award.medal) }} />
            <span className="poem-award-text">{medal}</span>
            {award.title ? (
                <a href={award.url} target="_blank" rel="noreferrer">
                    {truncateAwardTitle(
                        award.title,
                        MAX_AWARD_TITLE_LENGTH - medal.length
                    )}
                    {" ↗"}
                </a>
            ) : (
                <span />
            )}
        </>
    )
}
