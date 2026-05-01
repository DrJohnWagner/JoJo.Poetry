import React from "react"
import FeaturesEditor from "./FeaturesEditor"

export const inputCls =
    "mt-1 w-full bg-transparent border-b border-rule focus:border-accent outline-none py-1"
export const inputMonoCls = inputCls + " font-mono text-sm"
export const textareaCls =
    "mt-1 w-full bg-transparent border border-rule focus:border-accent outline-none p-3 font-serif leading-normal resize-y"

export function Labelled({
    label,
    required,
    hint,
    children,
}: {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="block">
            <span className="text-label">
                {label}
                {required && <span className="ml-1 text-accent">⦁</span>}
            </span>
            {children}
            {hint && (
                <span className="block text-[0.76rem] text-muted mt-1">
                    {hint}
                </span>
            )}
        </label>
    )
}

export function FeatureInput({
    label,
    value,
    onChange,
    hint,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    hint?: string
}) {
    return (
        <Labelled label={label} hint={hint ?? "Comma-separated features."}>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={inputCls + " font-sans text-sm"}
            />
        </Labelled>
    )
}

export interface PoemMetadataValues {
    rating: number
    date: string
    url: string
    themes: string
    moods: string
    poetic_forms: string
    techniques: string
    tones_voices: string
    key_images: string
    contest_fit: string
    socials: string
}

export default function PoemMetadataEditor({
    values,
    set,
    urlRequired,
    ratingRequired,
    dateHint,
}: {
    values: PoemMetadataValues
    set: (k: keyof PoemMetadataValues, v: string | number) => void
    urlRequired?: boolean
    ratingRequired?: boolean
    dateHint?: string
}) {
    return (
        <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Labelled label="Rating (0–100)" required={ratingRequired}>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={values.rating}
                        onChange={(e) => set("rating", Number(e.target.value))}
                        required={ratingRequired}
                        className={inputCls}
                    />
                </Labelled>
                <Labelled label="Date" hint={dateHint}>
                    <input
                        type="text"
                        value={values.date}
                        onChange={(e) => set("date", e.target.value)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className={inputMonoCls}
                    />
                </Labelled>
                <Labelled
                    label="URL"
                    required={urlRequired}
                    hint={urlRequired ? "Canonical external link." : undefined}
                >
                    <input
                        type="url"
                        value={values.url}
                        onChange={(e) => set("url", e.target.value)}
                        required={urlRequired}
                        className={inputMonoCls}
                    />
                </Labelled>
            </div>

            <FeaturesEditor
                label="Themes"
                group="themes"
                value={values.themes}
                onChange={(v) => set("themes", v)}
            />
            <FeaturesEditor
                label="Moods"
                group="moods"
                value={values.moods}
                onChange={(v) => set("moods", v)}
            />
            <FeaturesEditor
                label="Poetic forms"
                group="poetic_forms"
                value={values.poetic_forms}
                onChange={(v) => set("poetic_forms", v)}
            />
            <FeaturesEditor
                label="Techniques"
                group="techniques"
                value={values.techniques}
                onChange={(v) => set("techniques", v)}
            />
            <FeaturesEditor
                label="Tones / voices"
                group="tones_voices"
                value={values.tones_voices}
                onChange={(v) => set("tones_voices", v)}
            />
            <FeatureInput
                label="Key images"
                value={values.key_images}
                onChange={(v) => set("key_images", v)}
            />
            <FeatureInput
                label="Contest fit"
                value={values.contest_fit}
                onChange={(v) => set("contest_fit", v)}
            />
            <FeatureInput
                label="Socials"
                value={values.socials}
                onChange={(v) => set("socials", v)}
            />
        </>
    )
}
