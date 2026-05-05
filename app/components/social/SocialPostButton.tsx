"use client"

import { useState } from "react"
import { FaInstagram } from "react-icons/fa"
import SocialPostDialog from "./SocialPostDialog"
import SocialPostSuccessDialog from "./SocialPostSuccessDialog"

export default function SocialPostButton({
    poemId,
    title,
    initialExcerpt,
}: {
    poemId: string
    title: string
    initialExcerpt?: string
}) {
    const [open, setOpen] = useState(false)
    const [postedUrls, setPostedUrls] = useState<string[] | null>(null)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Create social post"
                className="button-icon"
            >
                <FaInstagram className="text-base" />
            </button>
            {open && (
                <SocialPostDialog
                    poemId={poemId}
                    title={title}
                    initialExcerpt={initialExcerpt}
                    onClose={() => setOpen(false)}
                    onPosted={(urls) => { setOpen(false); setPostedUrls(urls) }}
                />
            )}
            {postedUrls !== null && (
                <SocialPostSuccessDialog
                    urls={postedUrls}
                    onClose={() => setPostedUrls(null)}
                />
            )}
        </>
    )
}
