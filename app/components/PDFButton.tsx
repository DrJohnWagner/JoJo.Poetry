"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { FaRegFilePdf } from "react-icons/fa6"

const PDFDialog = dynamic(() => import("./pdf/PDFDialog"), { ssr: false })

export default function PDFButton({
    poemId,
    title,
}: {
    poemId: string
    title: string
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
                <FaRegFilePdf className="text-base" />
            </button>
            {open && (
                <PDFDialog
                    poemId={poemId}
                    title={title}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    )
}
