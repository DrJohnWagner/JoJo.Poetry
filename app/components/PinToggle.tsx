"use client"

import { useState, useTransition } from "react"
import { patchPoem } from "@/lib/api"

/** A small, text-forward pin control. Visually secondary to the title.
 *  Server-confirmed: local state flips only after PATCH returns 200.
 */
export default function PinToggle({
    id,
    initialPinned,
    onChange,
}: {
    id: string
    initialPinned: boolean
    onChange?: (next: boolean) => void
}) {
    const [pinned, setPinned] = useState(initialPinned)
    const [pending, startTransition] = useTransition()
    const [err, setErr] = useState<string | null>(null)

    function toggle() {
        setErr(null)
        const next = !pinned
        startTransition(async () => {
            try {
                const updated = await patchPoem(id, { pinned: next })
                setPinned(updated.pinned)
                onChange?.(updated.pinned)
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Failed")
            }
        })
    }

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={pinned}
            title={pinned ? "Unpin" : "Pin to top"}
            className={`font-sans text-[0.72rem] uppercase tracking-wider2 transition-colors ${
                pinned ? "text-accent" : "text-muted hover:text-ink"
            } disabled:opacity-60`}
        >
            {pending ? "…" : pinned ? "◆ pinned" : "◇ pin"}
            {err && <span className="ml-2 text-red-700">{err}</span>}
        </button>
    )
}
