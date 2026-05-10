"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import type { PageCallback } from "react-pdf/dist/shared/types.js"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { fetchFonts, fetchPdf, pdfPost } from "@/lib/api"
import { addMruFont, getDefaultFont, getMruFonts } from "@/lib/fonts"
import type { FontOption, PDFOptions, SocialPostResponse } from "@/lib/types"
import DialogTitle from "../DialogTitle"
import ErrorMessage from "../ErrorMessage"
import SocialPostSuccessDialog from "../SocialPostSuccessDialog"
import PDFActions from "./PDFActions"
import PDFControls from "./PDFControls"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString()

const DEFAULT_OPTIONS: PDFOptions = {
    paper: "a4",
    margin: 1.5,
    font: "IBM_Plex_Sans/IBMPlexSans-Regular",
    font_size: 13,
    colour: "#333333",
    columns: 2,
    gutter: 1.2,
    leading: 0.6,
    spacing: 1.2,
}

export default function PDFDialog({
    poemId,
    title,
    onClose,
    onUpdate,
}: {
    poemId: string
    title: string
    onClose: () => void
    onUpdate?: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [options, setOptions] = useState<PDFOptions>(DEFAULT_OPTIONS)
    const [fonts, setFonts] = useState<FontOption[]>([])
    const [mruFonts] = useState(getMruFonts)
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Generating PDF…")
    const [error, setError] = useState<string | null>(null)
    const pdfUrlRef = useRef<string | null>(null)
    const [postResult, setPostResult] = useState<SocialPostResponse | null>(
        null
    )
    const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(
        null
    )

    function releasePdfUrl() {
        if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
            pdfUrlRef.current = null
        }
    }

    const generate = useCallback(
        async (opts: PDFOptions) => {
            setLoadingMessage("Generating PDF…")
            setLoading(true)
            setError(null)
            try {
                const blob = await fetchPdf(poemId, opts)
                releasePdfUrl()
                const url = URL.createObjectURL(blob)
                pdfUrlRef.current = url
                setPdfUrl(url)
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed")
                setLoading(false)
            }
        },
        [poemId]
    )

    const initialised = useRef(false)

    useEffect(() => {
        dialogRef.current?.showModal()
        fetchFonts()
            .then((loaded) => {
                setFonts(loaded)
                const font = getDefaultFont(loaded) || DEFAULT_OPTIONS.font
                const opts = { ...DEFAULT_OPTIONS, font }
                setOptions(opts)
                return generate(opts)
            })
            .catch(() => generate(DEFAULT_OPTIONS))
            .finally(() => {
                initialised.current = true
            })
        return releasePdfUrl
    }, [poemId, generate])

    useEffect(() => {
        if (!initialised.current) return
        generate(options)
    }, [options, generate])

    function pushFont() {
        addMruFont(options.font)
    }

    async function handleCopy() {
        pushFont()
        if (!pdfUrl) return
        const pdf = await pdfjs.getDocument(pdfUrl).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({
            canvasContext: canvas.getContext("2d")!,
            canvas,
            viewport,
        }).promise
        const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
        )
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ])
    }

    function handleDownload() {
        pushFont()
        if (!pdfUrl) return
        const a = document.createElement("a")
        a.href = pdfUrl
        a.download = `${title}.pdf`
        a.click()
    }

    async function handleSave() {
        pushFont()
        if (!pdfUrl) return
        type FilePicker = Window & {
            showSaveFilePicker(opts: {
                suggestedName?: string
                types?: {
                    description?: string
                    accept: Record<string, string[]>
                }[]
            }): Promise<{ createWritable(): Promise<WritableStream> }>
        }
        try {
            const handle = await (
                window as unknown as FilePicker
            ).showSaveFilePicker({
                suggestedName: `${title}.pdf`,
                types: [
                    {
                        description: "PDF",
                        accept: { "application/pdf": [".pdf"] },
                    },
                ],
            })
            const writable = await handle.createWritable()
            const response = await fetch(pdfUrl)
            await response.body!.pipeTo(writable)
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return
            throw e
        }
    }

    async function handlePublish() {
        pushFont()
        setLoadingMessage("Publishing…")
        setLoading(true)
        try {
            const result = await pdfPost(poemId, options)
            setPostResult(result)
            if (result.socials.length > 0) onUpdate?.()
        } catch (e: unknown) {
            setPostResult({
                socials: [],
                errors: [e instanceof Error ? e.message : "Failed"],
            })
        } finally {
            setLoading(false)
        }
    }

    function onFirstPageLoad(page: PageCallback) {
        const [, , w, h] = page.view
        setPageSize({ w: 419, h: Math.round((h * 419) / w) })
    }

    function renderPages() {
        return Array.from({ length: numPages ?? 0 }, (_, i) => (
            <Page
                key={i + 1}
                pageNumber={i + 1}
                width={419}
                loading={null}
                onLoadSuccess={i === 0 ? onFirstPageLoad : undefined}
            />
        ))
    }

    function handleClose() {
        dialogRef.current?.close()
        onClose()
    }

    return (
        <>
            <dialog
                ref={dialogRef}
                onClose={onClose}
                className="w-full rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
                style={{ maxWidth: pageSize ? pageSize.w + 64 : 523 }}
            >
                <div style={{ maxHeight: "90vh", overflowY: "auto" }}>
                    <DialogTitle
                        title="Create PDF"
                        subtitle={`Poem: ${title}`}
                        onClose={handleClose}
                    />
                    <div className="relative">
                        <div
                            className={`flex flex-col gap-6 px-8 py-6${loading ? " pointer-events-none select-none opacity-40" : ""}`}
                        >
                            <div className="flex flex-col gap-6">
                                <PDFControls
                                    value={options}
                                    onChange={setOptions}
                                    fonts={fonts}
                                    mruFonts={mruFonts}
                                />
                            </div>
                            <div
                                className="flex flex-col gap-3"
                                style={
                                    pageSize && numPages
                                        ? { minHeight: pageSize.h * numPages }
                                        : undefined
                                }
                            >
                                <ErrorMessage message={error} />
                                <Document
                                    file={pdfUrl}
                                    loading={null}
                                    onLoadSuccess={({ numPages }) => {
                                        setNumPages(numPages)
                                        setLoading(false)
                                    }}
                                    onLoadError={(e) => {
                                        setError(e.message)
                                        setLoading(false)
                                    }}
                                >
                                    {renderPages()}
                                </Document>
                            </div>
                            <PDFActions
                                onDownload={handleDownload}
                                onSave={handleSave}
                                onCopy={handleCopy}
                                onPublish={handlePublish}
                            />
                        </div>
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-start gap-3 pt-[25%]">
                                <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#d4d0c8] border-t-[#6b6760]" />
                                <span className="text-sm text-muted">
                                    {loadingMessage}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </dialog>
            {postResult && (
                <SocialPostSuccessDialog
                    urls={postResult.socials}
                    errors={postResult.errors}
                    onClose={() => setPostResult(null)}
                />
            )}
        </>
    )
}
