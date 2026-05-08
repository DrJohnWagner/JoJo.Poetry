"use client"

import { useState } from "react"
import { FaArrowsRotate, FaCheck, FaCopy, FaEllipsis, FaShareNodes } from "react-icons/fa6"
import ActionButton from "../ActionButton"

export default function SocialPostActions({
    onRegenerate,
    onCopy,
    onPost,
    canPost,
}: {
    onRegenerate: () => void
    onCopy: () => Promise<void>
    onPost: () => void
    canPost: boolean
}) {
    const [copyState, setCopyState] = useState<"idle" | "loading" | "copied">("idle")

    async function handleCopy() {
        if (copyState !== "idle") return
        setCopyState("loading")
        try {
            await onCopy()
            setCopyState("copied")
            setTimeout(() => setCopyState("idle"), 2000)
        } catch {
            setCopyState("idle")
        }
    }

    return (
        <div className="flex justify-center gap-5">
            <ActionButton
                icon={FaArrowsRotate}
                label="Regenerate Image"
                onClick={onRegenerate}
            />
            <ActionButton
                icon={copyState === "copied" ? FaCheck : copyState === "loading" ? FaEllipsis : FaCopy}
                label={copyState === "copied" ? "Copied" : "Copy"}
                onClick={handleCopy}
            />
            <ActionButton
                icon={FaShareNodes}
                label="Publish"
                onClick={onPost}
                disabled={!canPost}
            />
        </div>
    )
}
