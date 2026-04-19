export default function PoemSocial({ url }: { url: string }) {
    let label: string
    try {
        label = new URL(url).hostname + " ↗"
    } catch {
        label = url + " ↗"
    }
    return (
        <div>
            <a href={url} target="_blank" rel="noreferrer">
                {label}
            </a>
        </div>
    )
}
