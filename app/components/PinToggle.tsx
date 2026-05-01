"use client"

import { useEffect, useState } from "react"
import { isPinned, setPin } from "@/lib/pins"

export default function PinToggle({
    id,
    initialPinned = false,
    onChange,
}: {
    id: string
    initialPinned?: boolean
    onChange?: (next: boolean) => void
}) {
    const [pinned, setPinned] = useState(initialPinned)

    useEffect(() => {
        setPinned(isPinned(id))
    }, [id])

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
