"use client"

import { useEffect, useState } from "react"
import { fetchFeatures } from "@/lib/api"
import { Labelled } from "./PoemMetadataEditor"

export type FeatureGroup =
    | "themes"
    | "moods"
    | "poetic_forms"
    | "techniques"
    | "tones_voices"

const selectCls =
    "mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-1 font-sans text-sm"

export default function FeaturesEditor({
    label,
    group,
    value,
    onChange,
}: {
    label: string
    group: FeatureGroup
    value: string
    onChange: (v: string) => void
}) {
    const [options, setOptions] = useState<string[]>([])

    useEffect(() => {
        fetchFeatures(group)
            .then(setOptions)
            .catch(() => {})
    }, [group])

    const selected = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const values = Array.from(e.target.selectedOptions, (o) => o.value)
        onChange(values.join(", "))
    }

    return (
        <Labelled label={label}>
            <select
                multiple
                value={selected}
                onChange={handleChange}
                size={10}
                className={selectCls}
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </Labelled>
    )
}
