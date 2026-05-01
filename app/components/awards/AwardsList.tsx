"use client"

import { useState } from "react"
import type { Award, PoemSummaryData } from "@/lib/types"
import AwardEntry from "./AwardEntry"
import AwardsSortBar, { DEFAULT_AWARD_SORT, type AwardSortState } from "./AwardsSortBar"
import { MEDAL_SCORE } from "@/lib/format"

interface AwardWithPoem {
    poem: PoemSummaryData
    award: Award
    closedMs: number
}

function sortEntries(entries: AwardWithPoem[], sort: AwardSortState): AwardWithPoem[] {
    const sorted = [...entries].sort((a, b) => {
        let cmp = 0
        switch (sort.field) {
            case "date":
                cmp = a.closedMs - b.closedMs
                break
            case "medal":
                cmp = (MEDAL_SCORE[a.award.medal] ?? 0) - (MEDAL_SCORE[b.award.medal] ?? 0)
                if (cmp === 0) return b.closedMs - a.closedMs
                break
            case "poem_title":
                cmp = a.poem.title.localeCompare(b.poem.title)
                if (cmp === 0)
                    cmp = (MEDAL_SCORE[b.award.medal] ?? 0) - (MEDAL_SCORE[a.award.medal] ?? 0)
                if (cmp === 0) return b.closedMs - a.closedMs
                break
            case "contest_title":
                cmp = (a.award.title ?? "").localeCompare(b.award.title ?? "")
                if (cmp === 0) return b.closedMs - a.closedMs
                break
        }
        return sort.dir === "asc" ? cmp : -cmp
    })
    return sorted
}

export default function AwardsList({ poems }: { poems: PoemSummaryData[] }) {
    const [sort, setSort] = useState<AwardSortState>(DEFAULT_AWARD_SORT)

    const entries: AwardWithPoem[] = poems.flatMap((poem) =>
        poem.awards.map((award) => ({
            poem,
            award,
            closedMs: new Date(award.closed).getTime(),
        }))
    )

    const sorted = sortEntries(entries, sort)

    if (sorted.length === 0) return null

    return (
        <section aria-label="Awards">
            <AwardsSortBar sort={sort} onChange={setSort} />
            {sorted.map(({ poem, award }) => (
                <div key={`${poem.id}-${award.url}`}>
                    <div className="grid grid-cols-[1fr_3fr_5fr] items-center gap-x-3 gap-y-1">
                        <AwardEntry poem={poem} award={award} />
                    </div>
                    <div className="my-5" />
                </div>
            ))}
        </section>
    )
}
