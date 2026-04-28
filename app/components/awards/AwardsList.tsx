"use client"

import { useState } from "react"
import type { Award, PoemSummaryData } from "@/lib/types"
import AwardEntry from "./AwardEntry"
import AwardsSortBar, { DEFAULT_AWARD_SORT, type AwardSortState } from "./AwardsSortBar"
import HorizontalRule from "@/components/HorizontalRule"

interface AwardWithPoem {
    poem: PoemSummaryData
    award: Award
    closedMs: number
}

const MEDAL_RANK: Record<string, number> = {
    "Gold": 4,
    "Silver": 3,
    "Bronze": 2,
    "Honorable Mention": 1,
}

function medalRank(medal: string): number {
    return MEDAL_RANK[medal] ?? 5
}

function sortEntries(entries: AwardWithPoem[], sort: AwardSortState): AwardWithPoem[] {
    const sorted = [...entries].sort((a, b) => {
        let cmp = 0
        switch (sort.field) {
            case "date":
                cmp = a.closedMs - b.closedMs
                break
            case "medal":
                cmp = medalRank(a.award.medal) - medalRank(b.award.medal)
                break
            case "poem_title":
                cmp = a.poem.title.localeCompare(b.poem.title)
                break
            case "contest_title":
                cmp = (a.award.title ?? "").localeCompare(b.award.title ?? "")
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
            {/* <h2 className="label-text mb-4">Awards</h2> */}
            <AwardsSortBar sort={sort} onChange={setSort} />
            {sorted.map(({ poem, award }, i) => (
                <div key={`${poem.id}-${award.url}`}>
                    <div className="grid grid-cols-[1fr_3fr_5fr] items-baseline gap-x-3 gap-y-1">
                        <AwardEntry poem={poem} award={award} />
                    </div>
                    <div className="my-5" />
                    {/* <HorizontalRule show={i < sorted.length - 1} margin={3} /> */}
                </div>
            ))}
        </section>
    )
}
