import { FaMedal } from "react-icons/fa"
import type { Award } from "@/lib/types"
import { medalColor } from "@/lib/format"

const MAX_AWARD_TITLE_LENGTH = 28

function truncateAwardTitle(
    title: string,
    length: number = MAX_AWARD_TITLE_LENGTH
): string {
    if (title.length <= length) return title
    return `${title.slice(0, length)}...`
}

export default function PoemAward({ award }: { award: Award }) {
    const medal = award.medal === "Honorable Mention" ? "HM" : award.medal
    return (
        <div className="contents text-meta">
            <FaMedal style={{ color: medalColor(award.medal) }} />
            <span>{medal}</span>
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
        </div>
    )
}
