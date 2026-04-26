// import { FaMedal } from "react-icons/fa"
import type { Award } from "@/lib/types"
import PoemAward from "./PoemAward"

export default function PoemAwards({ awards }: { awards: Award[] }) {
    if (awards.length === 0) return null
    return (
        <div className="grid grid-cols-[max-content_max-content_max-content] items-center gap-x-1.5 gap-y-1">
            {awards.map((award) => (
                <PoemAward key={award.url} award={award} />
            ))}
        </div>
    )
}