import type { SimilarityBundle } from "@/lib/types"
import PoemListSection from "./PoemListSection"

const CATEGORIES: { key: keyof SimilarityBundle; label: string }[] = [
    { key: "overall", label: "Overall" },
    { key: "theme", label: "Theme" },
    { key: "form", label: "Form & Craft" },
    { key: "emotion", label: "Emotion" },
    { key: "imagery", label: "Imagery" },
]

export default function SimilarPoems({ bundle }: { bundle: SimilarityBundle }) {
    const hasAny = CATEGORIES.some((c) => bundle[c.key].neighbours.length > 0)
    if (!hasAny) return null
    return (
        <div className="space-y-6">
            <h2 className="label-text text-center">Similar Poems</h2>
            {CATEGORIES.map(({ key, label }) => (
                <PoemListSection
                    key={key}
                    label={label}
                    poems={bundle[key].neighbours}
                />
            ))}
        </div>
    )
}
