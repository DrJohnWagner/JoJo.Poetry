import { bodyToPlainText } from "@/lib/format"

/** Renders a poem body faithfully: preserves line breaks and indentation. */
export default function PoemBody({ body }: { body: string }) {
    return <div className="poem-body">{bodyToPlainText(body)}</div>
}
