import type { Author } from "@/lib/types"

export default function PoemAuthor({ author }: { author: Author }) {
    return (
        <div className="poem-author-text">
            {author.pen_name}{" "}
            <span className="text-muted">({author.full_name})</span>
        </div>
    )
}
