"use client"

import { useEffect, useRef } from "react"

export default function SocialPostSuccessDialog({
    urls,
    onClose,
}: {
    urls: string[]
    onClose: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-md rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
        >
            <div className="flex items-baseline justify-between border-b border-[#d4d0c8] px-8 pb-4 pt-7">
                <h2 className="text-title text-title-lg">Posted</h2>
            </div>
            <div className="space-y-4 px-8 py-6">
                <p className="text-meta">Your poem has been posted to the following platforms:</p>
                <ul className="space-y-2">
                    {urls.map((url) => (
                        <li key={url}>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-label text-sm underline hover:text-ink"
                            >
                                {url}
                            </a>
                        </li>
                    ))}
                </ul>
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => { dialogRef.current?.close(); onClose() }}
                        className="button-primary"
                    >
                        OK
                    </button>
                </div>
            </div>
        </dialog>
    )
}
