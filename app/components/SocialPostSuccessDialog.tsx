"use client"

import { useEffect, useRef } from "react"
import type { SocialCostEstimate } from "@/lib/types"

function usd(n: number): string {
    return `$${n.toFixed(4)}`
}

export default function SocialPostSuccessDialog({
    urls,
    errors,
    cost,
    onClose,
}: {
    urls: string[]
    errors: string[]
    cost?: SocialCostEstimate
    onClose: () => void
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    const title =
        urls.length > 0 && errors.length > 0
            ? "Partially posted"
            : urls.length > 0
              ? "Posted"
              : "Posting failed"

    const textCost = cost
        ? cost.input_cost_usd + cost.output_cost_usd + cost.cached_input_cost_usd
        : null
    const imageCost = cost
        ? cost.image_input_cost_usd + cost.image_output_cost_usd
        : null

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-md rounded-none border border-[#d4d0c8] bg-paper p-0 text-ink backdrop:bg-ink/20"
        >
            <div className="flex items-baseline justify-between border-b border-[#d4d0c8] px-8 pb-4 pt-7">
                <h2 className="text-title text-title-lg">{title}</h2>
            </div>
            <div className="space-y-4 px-8 py-6">
                {urls.length > 0 && (
                    <>
                        <p className="text-meta">Posted to:</p>
                        <ul className="space-y-2">
                            {urls.map((url) => (
                                <li key={url}>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm underline hover:text-ink"
                                    >
                                        {url}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {errors.length > 0 && (
                    <>
                        <p className="text-meta">Failed:</p>
                        <ul className="space-y-2">
                            {errors.map((err, i) => (
                                <li
                                    key={i}
                                    className="text-meta text-sm text-[#b94a48]"
                                >
                                    {err}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {cost && textCost !== null && imageCost !== null && (
                    <div className="text-meta flex gap-6 border-t border-[#d4d0c8] pt-4 text-sm tabular-nums">
                        <span>Text: {usd(textCost)}</span>
                        <span>Image: {usd(imageCost)}</span>
                        <span className="font-medium">
                            Total: {usd(cost.total_cost_usd)}
                        </span>
                    </div>
                )}
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => {
                            dialogRef.current?.close()
                            onClose()
                        }}
                        className="button-primary"
                    >
                        OK
                    </button>
                </div>
            </div>
        </dialog>
    )
}
