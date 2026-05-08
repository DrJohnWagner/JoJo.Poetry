"use client"

import { useState } from "react"
import { FaEllipsis, FaInstagram } from "react-icons/fa6"
import SocialPostDialog from "./social/SocialPostDialog"
import SocialPostSuccessDialog from "./SocialPostSuccessDialog"
import type { SocialCostEstimate } from "@/lib/types"

export default function SocialPostButton({
    poemId,
    title,
    initialExcerpt,
    onUpdate,
}: {
    poemId: string
    title: string
    initialExcerpt?: string
    onUpdate?: () => void
}) {
    const [open, setOpen] = useState(false)
    const [postResult, setPostResult] = useState<{
        urls: string[]
        errors: string[]
        cost: SocialCostEstimate
    } | null>(null)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Create social post"
                className="button-icon"
            >
                {open ? (
                    <FaEllipsis className="text-base" />
                ) : (
                    <FaInstagram className="text-base" />
                )}
            </button>
            {open && (
                <SocialPostDialog
                    poemId={poemId}
                    title={title}
                    initialExcerpt={initialExcerpt}
                    onClose={() => setOpen(false)}
                    onPosted={(urls, errors, cost) => {
                        setOpen(false)
                        setPostResult({ urls, errors, cost })
                        if (urls.length > 0) onUpdate?.()
                    }}
                />
            )}
            {postResult && (
                <SocialPostSuccessDialog
                    urls={postResult.urls}
                    errors={postResult.errors}
                    cost={postResult.cost}
                    onClose={() => setPostResult(null)}
                />
            )}
        </>
    )
}
