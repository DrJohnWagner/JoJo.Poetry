import { FaMedal } from "react-icons/fa"
import type { Contest } from "@/lib/types"

function medalColor(award: string): string {
    if (award === "Gold") return "#b8860b"
    if (award === "Silver") return "#888"
    if (award === "Bronze") return "#a0522d"
    if (award === "Honorable Mention") return "#4a7c59"
    return "currentColor"
}

export default function PoemContest({ contest }: { contest: Contest }) {
    return (
        <div className="flex items-center gap-1.5">
            <FaMedal
                style={{ color: medalColor(contest.award), flexShrink: 0 }}
            />
            <span className="font-sans text-[0.78rem] text-ink/80">
                {contest.award}
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
