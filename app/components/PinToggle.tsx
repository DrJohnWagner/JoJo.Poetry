"use client"

import { useMemo, useState } from "react"
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
    const [pinVersion, setPinVersion] = useState(0)
    const pinned = useMemo(() => {
        if (pinVersion === 0) return initialPinned
        return isPinned(id)
    }, [id, initialPinned, pinVersion])

    function toggle() {
        const next = !pinned
        setPin(id, next)
        setPinVersion((v) => v + 1)
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
