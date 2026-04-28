import { FaMedal } from "react-icons/fa"
import type { Award } from "@/lib/types"

const MEDAL_COLOR: Record<string, string> = {
    Gold: "#b8860b",
    Silver: "#888",
    Bronze: "#a0522d",
    "Honorable Mention": "#4a7c59",
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

export default function PoemContestTooltip({ award }: { award: Award }) {
    return (
        <span className="group relative inline-block">
            <FaMedal style={{ color: MEDAL_COLOR[award.medal] ?? "currentColor" }} />
            <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded border border-rule bg-paper px-2.5 py-2 opacity-0 shadow-sm transition-opacity duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100">
                <span className="block font-sans text-[0.72rem] font-semibold uppercase tracking-wider text-muted">
                    {award.medal}
                </span>
                {award.title && (
                    <span className="mt-0.5 block font-sans text-[0.8rem] leading-snug text-accent no-underline hover:underline">
                        {award.title}
                    </span>
                )}
                <span className="mt-0.5 block font-sans text-[0.72rem] text-muted">
                    {formatDate(award.closed)}
                </span>
            </span>
        </span>
    )
}
