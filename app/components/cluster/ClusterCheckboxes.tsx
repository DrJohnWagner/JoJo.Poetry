export const CLUSTER_GROUPS = [
    { id: "themes", label: "Themes" },
    { id: "emotional_registers", label: "Emotional Registers" },
    // { id: "formal_modes", label: "Formal Modes" },
    { id: "craft_features", label: "Craft Features" },
    { id: "stylistic_postures", label: "Stylistic Postures" },
] as const

export default function ClusterCheckboxes({
    selected,
    toggle,
}: {
    selected: string[]
    toggle: (cat: string) => void
}) {
    return (
        <div>
            <p className="eyebrow">Cluster by:</p>
            <ul className="mt-3 grid w-fit grid-cols-2 justify-items-start gap-x-4 gap-y-2 md:w-auto md:flex md:flex-wrap md:items-center">
                {CLUSTER_GROUPS.map(({ id, label }) => (
                    <li key={id}>
                        <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={selected.includes(id)}
                                onChange={() => toggle(id)}
                                className="accent-ink"
                            />
                            {label}
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    )
}
