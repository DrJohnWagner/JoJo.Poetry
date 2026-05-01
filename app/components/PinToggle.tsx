"use client"

import { useState } from "react"
import { setPin } from "@/lib/pins"

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

    function toggle() {
        const next = !pinned
        setPin(id, next)
        setPinned(next)
        onChange?.(next)
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={pinned}
            title={pinned ? "Unpin" : "Pin to top"}
            className={`button-text button-text-standard ${
                pinned
                    ? "button-text-accent"
                    : "button-text-default button-text-hoverable"
            }`}
        >
            {pinned ? "◆ pinned" : "◇ pin"}
        </button>
    )
}
