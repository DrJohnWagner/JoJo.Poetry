export default function PoemProject({ project, clamp }: { project: string; clamp?: boolean }) {
    if (!project) return null
    const clampClass = clamp ? "line-clamp-2" : ""
    return <p className={`poem-project-text ${clampClass}`}>{project}</p>
}
