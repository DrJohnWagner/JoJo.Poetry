const KEY = "instagram_mru_fonts"
const MAX = 16

export function getMruFonts(): string[] {
    if (typeof window === "undefined") return []
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? "[]")
    } catch {
        return []
    }
}

export function addMruFont(name: string): void {
    const list = [name, ...getMruFonts().filter((f) => f !== name)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(list))
}

export function getDefaultFont(availableFonts: { filename: string }[]): string {
    const mru = getMruFonts()
    return (
        mru.find((f) => availableFonts.some((af) => af.filename === f))
        ?? availableFonts[0]?.filename
        ?? ""
    )
}
