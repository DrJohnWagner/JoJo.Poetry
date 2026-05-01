const KEY = "jojo:pins"

function load(): Set<string> {
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
        return new Set()
    }
}

function save(pins: Set<string>): void {
    try {
        localStorage.setItem(KEY, JSON.stringify([...pins]))
    } catch {}
}

export function getPins(): Set<string> {
    return load()
}

export function isPinned(id: string): boolean {
    return load().has(id)
}

export function setPin(id: string, pinned: boolean): void {
    const pins = load()
    if (pinned) pins.add(id); else pins.delete(id)
    save(pins)
}
