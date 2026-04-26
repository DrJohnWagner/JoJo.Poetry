import { Fragment, type ReactNode } from "react"

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

export default function PoemBody({
    body,
    open,
    onOpenChange,
}: {
    body: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    if (onOpenChange !== undefined && open !== undefined) {
        return (
            <div className="my-3">
                <button
                    onClick={() => onOpenChange(!open)}
                    className="label-text hover:text-ink"
                >
                    {open ? "Hide poem" : "Show poem"}
                </button>
                {open && (
                    <div className="mt-4">
                        <div className="poem-body">{renderBody(body)}</div>
                    </div>
                )}
            </div>
        )
    }

    return <div className="poem-body">{renderBody(body)}</div>
}
