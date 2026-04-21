import { FaMedal } from "react-icons/fa"
import type { Contest } from "@/lib/types"

function medalColor(medal: string): string {
    if (medal === "Gold") return "#b8860b"
    if (medal === "Silver") return "#888"
    if (medal === "Bronze") return "#a0522d"
    if (medal === "Honorable Mention") return "#4a7c59"
    return "currentColor"
}

export default function PoemContest({ contest }: { contest: Contest }) {
    return (
        <div className="flex items-center gap-1.5">
            <FaMedal
                style={{ color: medalColor(contest.medal), flexShrink: 0 }}
            />
            <span className="font-sans text-[0.78rem] text-ink/80">
                {contest.medal}
            </span>
            {contest.title && (
                <>
                    <span>—</span>
                    <a href={contest.url} target="_blank" rel="noreferrer">
                        {contest.title} ↗
                    </a>
                </>
            )}
        </div>
    )
}
