"use client"

import { useState, useTransition } from "react"
import { patchPoem } from "@/lib/api"
import { useAppConfig } from "./AppConfig"
import ErrorMessage from "./ErrorMessage"

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
    const { readOnly } = useAppConfig()
    const [pinned, setPinned] = useState(initialPinned)
    const [pending, startTransition] = useTransition()
    const [err, setErr] = useState<string | null>(null)

    if (readOnly) return null

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
            className={`button-text button-text-standard${
                pending ? "button-text-disabled" : ""
            } ${
                pinned
                    ? "button-text-accent"
                    : "button-text-default button-text-hoverable"
            }`}
        >
            {pending ? "…" : pinned ? "◆ pinned" : "◇ pin"}
            <ErrorMessage message={err} className="ml-2 inline" />
        </button>
    )
}
