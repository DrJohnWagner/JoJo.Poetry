"use client"

import { useState } from "react"
import { FaInstagram } from "react-icons/fa"
import InstagramDialog from "./InstagramDialog"

export default function InstagramButton({
    poemId,
    initialExcerpt,
}: {
    poemId: string
    initialExcerpt?: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Create Instagram post"
                className="button-icon"
            >
                <FaInstagram className="text-base" />
            </button>
            {open && (
                <InstagramDialog
                    poemId={poemId}
                    initialExcerpt={initialExcerpt}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    )
}
