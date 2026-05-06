"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import DialogTitle from "../DialogTitle"
import ErrorMessage from "../ErrorMessage"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString()

export default function PDFDialog({
    poemId,
    title,
    onClose,
}: {
    poemId: string
    title: string
    onClose: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [numPages, setNumPages] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    function handleClose() {
        dialogRef.current?.close()
        onClose()
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-3xl rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
        >
            <DialogTitle
                title="Create PDF"
                subtitle={`Poem: ${title}`}
                onClose={handleClose}
            />
            <div className="relative">
                <div className={`flex flex-col items-center gap-4 px-8 py-6${loading ? " pointer-events-none select-none opacity-40" : ""}`}>
                    <ErrorMessage message={error} />
                    <Document
                        file={`/api/pdf/${encodeURIComponent(poemId)}`}
                        onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoading(false) }}
                        onLoadError={(e) => { setError(e.message); setLoading(false) }}
                    >
                        {Array.from({ length: numPages ?? 0 }, (_, i) => (
                            <Page key={i + 1} pageNumber={i + 1} />
                        ))}
                    </Document>
                </div>
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#d4d0c8] border-t-[#6b6760]" />
                        <span className="text-muted text-sm">Loading PDF…</span>
                    </div>
                )}
            </div>
        </dialog>
    )
}
