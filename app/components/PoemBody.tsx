function prepareHtml(body: string): string {
    return body
        .replace(/<br\s*\/?>\n?/gi, "<br/>")
        .replace(
            /<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
            (_, href: string, text: string) =>
                `<a href="${href}" target="_blank" rel="noreferrer">${text.trim()} ↗</a>`
        )
}

export default function PoemBody({ body }: { body: string }) {
    return (
        <div
            className="poem-body"
            dangerouslySetInnerHTML={{ __html: prepareHtml(body) }}
        />
    )
}
