export default function PoemProject({
    project,
    clamp,
}: {
    project: string
    clamp?: number
}) {
    if (!project) return null
    return (
        <p
            className={`poem-project-text ${clamp ? `line-clamp-${clamp}` : ""}`}
        >
            {project}
        </p>
    )
}
