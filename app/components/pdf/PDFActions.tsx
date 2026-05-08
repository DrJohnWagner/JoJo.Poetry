"use client"

import { useState } from "react"
import { FaCheck, FaCopy, FaDownload, FaEllipsis, FaFloppyDisk, FaShareNodes } from "react-icons/fa6"
import ActionButton from "../ActionButton"

export default function PDFActions({
    onDownload,
    onSave,
    onCopy,
    onPublish,
}: {
    onDownload: () => void
    onSave: () => Promise<void>
    onCopy: () => Promise<void>
    onPublish: () => void
}) {
    const [copyState, setCopyState] = useState<"idle" | "loading" | "copied">("idle")
    const [saving, setSaving] = useState(false)
    const [downloaded, setDownloaded] = useState(false)

    function handleDownloadClick() {
        onDownload()
        setDownloaded(true)
        setTimeout(() => setDownloaded(false), 2000)
    }

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

    async function handleSave() {
        if (saving) return
        setSaving(true)
        try {
            await onSave()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex justify-center gap-5">
            <ActionButton
                icon={downloaded ? FaCheck : FaDownload}
                label={downloaded ? "Downloaded" : "Download"}
                onClick={handleDownloadClick}
            />
            <ActionButton
                icon={saving ? FaEllipsis : FaFloppyDisk}
                label="Save"
                onClick={handleSave}
            />
            <ActionButton
                icon={copyState === "copied" ? FaCheck : copyState === "loading" ? FaEllipsis : FaCopy}
                label={copyState === "copied" ? "Copied" : "Copy"}
                onClick={handleCopy}
            />
            <ActionButton icon={FaShareNodes} label="Publish" onClick={onPublish} />
        </div>
    )
}
