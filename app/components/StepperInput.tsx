export default function StepperInput({
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    smallStep = 1,
    largeStep,
    decimals = 0,
}: {
    value: number
    onChange: (v: number) => void
    min?: number
    max?: number
    smallStep?: number
    largeStep?: number
    decimals?: number
}) {
    const base = "text-label flex h-6 w-6 items-center justify-center border border-[#d4d0c8] text-xs hover:border-ink hover:text-ink"
    const large = "text-label flex h-6 w-6 items-center justify-center border border-[#d4d0c8] text-base font-bold hover:border-ink hover:text-ink"
    return (
        <div className="flex items-center gap-1">
            {largeStep !== undefined && (
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - largeStep))}
                    className={large}
                >
                    −
                </button>
            )}
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - smallStep))}
                className={base}
            >
                −
            </button>
            <span className="text-meta w-6 text-center text-sm">{value.toFixed(decimals)}</span>
            <button
                type="button"
                onClick={() => onChange(Math.min(max, value + smallStep))}
                className={base}
            >
                +
            </button>
            {largeStep !== undefined && (
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + largeStep))}
                    className={large}
                >
                    +
                </button>
            )}
        </div>
    )
}
