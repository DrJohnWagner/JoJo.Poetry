export default function HorizontalRule({
    show = true,
    margin = 5,
}: {
    show?: boolean
    margin?: number
}) {
    if (!show) return null
    const my = `${margin * 0.25}rem`
    return (
        <div
            className="rule"
            style={{
                marginTop: my,
                marginBottom: my,
            }}
        />
    )
}
