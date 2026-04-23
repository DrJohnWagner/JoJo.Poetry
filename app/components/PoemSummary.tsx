import PoemProject from "./poem/PoemProject"
import PoemTitle from "./poem/PoemTitle"

export default function PoemSummary({
    id,
    title,
    project,
}: {
    id: string
    title: string
    project: string
}) {
    return (
        <li>
            <PoemTitle id={id} title={title} />
            <PoemProject project={project} clamp={2} />
        </li>
    )
}
