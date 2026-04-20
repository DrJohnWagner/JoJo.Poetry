/** Convert the stored HTML-fragment body into plain text, preserving
 *  line breaks and authored whitespace. Mirrors the backend projection.
 */
export function bodyToPlainText(body: string): string {
    return (
        body
            // Consume a single optional trailing \n so stored "<br/>\n" collapses
            // to one line break, matching the backend projection.
            .replace(/<br\s*\/?>\n?/gi, "\n")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
    )
}

/** Inverse of bodyToPlainText for editor round-trips.
 *
 *  Writes back the canonical stored form: every \n becomes `<br/>\n`.
 *  Indentation / trailing whitespace on each line is left untouched,
 *  so leading spaces and tabs survive byte-for-byte.
 */
export function plainTextToBody(text: string): string {
    return text.replace(/\n/g, "<br/>\n")
}

export function poemToMarkdown(poem: import("./types").Poem): string {
    const body = bodyToPlainText(poem.body)
    const parts: string[] = [`# ${poem.title}`]
    if (poem.project) parts.push(`*${poem.project}*`)
    parts.push(body)
    return parts.join("\n\n")
}

export function formatDate(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}
