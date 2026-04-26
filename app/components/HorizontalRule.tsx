export default function HorizontalRule({ show = true }: { show?: boolean }) {
    if (!show) return null
    return <div className="rule my-5" />
}
