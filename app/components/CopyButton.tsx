"use client"

import { useState } from "react"
import {
    IoCopyOutline, IoCheckmarkOutline, IoEllipsisHorizontalOutline,
    IoCopy, IoCheckmark, IoEllipsisHorizontal,
} from "react-icons/io5"

type State = "idle" | "loading" | "copied"

export default function CopyButton({
    getText,
    variant = "outline",
}: {
    getText: () => Promise<string>
    variant?: "outline" | "filled"
}) {
    const [state, setState] = useState<State>("idle")

    async function handleCopy() {
        if (state !== "idle") return
        setState("loading")
        try {
            const text = await getText()
            await navigator.clipboard.writeText(text)
            setState("copied")
            setTimeout(() => setState("idle"), 2000)
        } catch {
            setState("idle")
        }
    }

    const Copy     = variant === "filled" ? IoCopy                : IoCopyOutline
    const Check    = variant === "filled" ? IoCheckmark           : IoCheckmarkOutline
    const Ellipsis = variant === "filled" ? IoEllipsisHorizontal  : IoEllipsisHorizontalOutline

    return (
        <button
            type="button"
            onClick={handleCopy}
            title="Copy poem as markdown"
            className="text-muted hover:text-ink transition-colors"
        >
            {state === "copied"  && <Check    className="text-[1rem]" />}
            {state === "loading" && <Ellipsis className="text-[1rem]" />}
            {state === "idle"    && <Copy     className="text-[1rem]" />}
        </button>
    )
}
