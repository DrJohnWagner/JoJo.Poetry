"use client"

import { useState } from "react"
import { IoCopyOutline, IoCheckmarkOutline, IoEllipsisHorizontalOutline } from "react-icons/io5"

type State = "idle" | "loading" | "copied"

export default function CopyButton({ getText }: { getText: () => Promise<string> }) {
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

    return (
        <button
            type="button"
            onClick={handleCopy}
            title="Copy poem as markdown"
            className="text-muted hover:text-ink transition-colors"
        >
            {state === "copied"  && <IoCheckmarkOutline className="text-[1rem]" />}
            {state === "loading" && <IoEllipsisHorizontalOutline className="text-[1rem]" />}
            {state === "idle"    && <IoCopyOutline className="text-[1rem]" />}
        </button>
    )
}
