import { FaMedal } from "react-icons/fa"
import type { Award } from "@/lib/types"

function medalColor(medal: string): string {
    if (medal === "Gold") return "#b8860b"
    if (medal === "Silver") return "#888"
    if (medal === "Bronze") return "#a0522d"
    if (medal === "Honorable Mention") return "#4a7c59"
    return "currentColor"
}

export default function PoemAward({ award }: { award: Award }) {
    return (
        <div className="flex items-center gap-1.5">
            <FaMedal
                style={{ color: medalColor(award.medal), flexShrink: 0 }}
            />
            <span className="font-sans text-[0.78rem] text-ink/80">
                {award.medal}
            </span>
            {award.title && (
                <>
                    <span>—</span>
                    <a href={award.url} target="_blank" rel="noreferrer">
                        {award.title} ↗
                    </a>
                </>
            )}
        </div>
    )
}
