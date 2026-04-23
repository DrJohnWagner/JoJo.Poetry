import { constants } from "buffer"
import { fetchPoem } from "./api"
import type { Poem } from "./types"

/** Convert a snake_case string into a human-readable label. */
export const toLabel = (s: string) =>
    s
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")

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

function poemToMarkdownFromPoem(poem: Poem, full: boolean): string {
    const body = bodyToPlainText(poem.body)

    if (!full) {
        const parts: string[] = [`# ${poem.title}`]
        if (poem.author) parts.push(`by ${poem.author.pen_name}`)
        parts.push(body)
        parts.push("---")
        if (poem.notes.length)
            parts.push(
                `Author's Notes:\n${poem.notes.map((n) => `${n}`).join("\n")}`
            )
        if (poem.author)
            parts.push(
                `Copyright: ${poem.author.pen_name} (${poem.author.full_name})`
            )
        return parts.join("\n\n")
    }

    // Full export: every field
    const parts: string[] = [`# ${poem.title}`]
    if (poem.author) parts.push(`by ${poem.author.pen_name}`)
    parts.push(body)

    parts.push("---")

    if (poem.notes.length)
        parts.push(
            `**Author's Notes:**\n${poem.notes.map((n) => `- ${n}`).join("\n")}`
        )

    const tags: string[] = []
    if (poem.project) tags.push(`**Project:** ${poem.project}`)
    if (poem.themes.length) tags.push(`**Themes:** ${poem.themes.join(", ")}`)
    if (poem.emotional_registers.length)
        tags.push(`**Register:** ${poem.emotional_registers.join(", ")}`)
    if (poem.formal_modes.length)
        tags.push(`**Formal Modes:** ${poem.formal_modes.join(", ")}`)
    if (poem.craft_features.length)
        tags.push(`**Craft Features:** ${poem.craft_features.join(", ")}`)
    if (poem.stylistic_postures.length)
        tags.push(
            `**Stylistic Postures:** ${poem.stylistic_postures.join(", ")}`
        )
    if (poem.key_images.length)
        tags.push(`**Key Images:** ${poem.key_images.join(", ")}`)
    if (poem.contest_fit.length)
        tags.push(`**Contest Fit:** ${poem.contest_fit.join(", ")}`)
    if (tags.length) parts.push(tags.join("\n"))

    parts.push(
        `**Rating:** ${poem.rating}  \n**Date:** ${formatDate(poem.date)}  \n**Lines:** ${poem.lines} · **Words:** ${poem.words}`
    )
    if (poem.awards.length)
        parts.push(
            `**Awards:**\n${poem.awards.map((c) => `- ${c.medal}: ${c.url}${c.title ? ` (${c.title})` : ""}`).join("\n")}`
        )
    if (poem.socials.length)
        parts.push(
            `**Socials:**\n${poem.socials.map((s) => `- ${s}`).join("\n")}`
        )

    parts.push(`**URL:** ${cleanPoetryUrl(poem.url)}`)
    if (poem.author)
        parts.push(
            `**Copyright:** ${poem.author.pen_name} (${poem.author.full_name})`
        )

    return parts.join("\n\n")
}

export async function poemToMarkdown(
    id: string,
    full: boolean
): Promise<string> {
    const poem = await fetchPoem(id)
    return poemToMarkdownFromPoem(poem, full)
}

/** Strip the human-readable slug from an AllPoetry-style URL, keeping only
 *  the numeric ID segment. Safe to call on any URL — non-matching URLs are
 *  returned unchanged.
 *
 *  https://allpoetry.com/poem/19039436-Margin-by-Insta-JoJo
 *  → https://allpoetry.com/poem/19039436
 */
export function cleanPoetryUrl(url: string): string {
    return url.replace(/(\/\d+)[^/]*$/, "$1")
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
