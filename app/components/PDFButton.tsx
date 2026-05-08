"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { FaEllipsis, FaRegFilePdf } from "react-icons/fa6"

const PDFDialog = dynamic(() => import("./pdf/PDFDialog"), { ssr: false })

export default function PDFButton({
    poemId,
    title,
    onUpdate,
}: {
    poemId: string
    title: string
    onUpdate?: () => void
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Create PDF file of this poem"
                className="button-icon"
            >
                {open ? (
                    <FaEllipsis className="text-base" />
                ) : (
                    <FaRegFilePdf className="text-base" />
                )}
            </button>
            {open && (
                <PDFDialog
                    poemId={poemId}
                    title={title}
                    onClose={() => setOpen(false)}
                    onUpdate={onUpdate}
                />
            )}
        </>
    )
}
