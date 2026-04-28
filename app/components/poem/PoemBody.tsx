"use client"

import { Fragment, useState, type ReactNode } from "react"
import { fetchPoem } from "@/lib/api"
import ErrorMessage from "../ErrorMessage"

function renderInline(line: string, lineIndex: number): ReactNode[] {
    const nodes: ReactNode[] = []
    const tokenRe = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
    let last = 0
    let match: RegExpExecArray | null
    let tokenIndex = 0

    while ((match = tokenRe.exec(line)) !== null) {
        const [raw, linkText, linkHref, boldText, italicText] = match
        const start = match.index

        if (start > last) {
            nodes.push(line.slice(last, start))
        }

        if (linkText && linkHref) {
            nodes.push(
                <a
                    key={`l-${lineIndex}-${tokenIndex}`}
                    href={linkHref}
                    target="_blank"
                    rel="noreferrer"
                >
                    {linkText.trim()} ↗
                </a>
            )
        } else if (boldText) {
            nodes.push(
                <strong key={`b-${lineIndex}-${tokenIndex}`}>{boldText}</strong>
            )
        } else if (italicText) {
            nodes.push(
                <em key={`i-${lineIndex}-${tokenIndex}`}>{italicText}</em>
            )
        }

        last = start + raw.length
        tokenIndex += 1
    }

    if (last < line.length) {
        nodes.push(line.slice(last))
    }

    return nodes
}

function renderBody(body: string): ReactNode[] {
    const normalised = body.replace(/<br\s*\/?>\n?/gi, "\n")
    const lines = normalised.split(/\r?\n/)

    return lines.map((line, index) => (
        <Fragment key={`line-${index}`}>
            {renderInline(line, index)}
            {index < lines.length - 1 ? "\n" : null}
        </Fragment>
    ))
}

export default function PoemBody({ poemId }: { poemId: string }) {
    const [open, setOpen] = useState(false)
    const [body, setBody] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleOpen() {
        setOpen(true)
        if (body !== null) return
        setLoading(true)
        setError(null)
        try {
            const poem = await fetchPoem(poemId)
            setBody(poem.body)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load poem")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="my-3">
            <button
                onClick={() => (open ? setOpen(false) : void handleOpen())}
                className="label-text hover:text-ink"
            >
                {open ? "Hide poem" : "Show poem"}
            </button>
            {open && loading && (
                <p className="label-text mt-3 text-muted">Loading…</p>
            )}
            {open && <ErrorMessage message={error} />}
            {open && body !== null && (
                <div className="mt-4">
                    <div className="poem-body">{renderBody(body)}</div>
                </div>
            )}
        </div>
    )
}
