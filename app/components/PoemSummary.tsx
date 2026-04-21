import Link from "next/link"

export default function PoemSummary({ id, title, project }: { id: string; title: string; project: string }) {
    return (
        <li>
            <h3 className="font-serif text-[1rem] leading-tight">
                <Link href={`/poems/${id}`} className="text-ink font-semibold hover:text-accent hover:underline">
                    {title}
                </Link>
            </h3>
            {project && (
                <p className="font-sans text-[0.8rem] text-muted mt-1 line-clamp-2">
                    {project}
                </p>
            )}
        </li>
    )
}
