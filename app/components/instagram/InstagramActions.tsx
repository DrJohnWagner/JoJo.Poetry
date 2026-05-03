import { FaInstagram } from "react-icons/fa"
import { HiOutlineRefresh } from "react-icons/hi"

export default function InstagramActions({
    onRegenerate,
    onPost,
}: {
    onRegenerate: () => void
    onPost: () => void
}) {
    return (
        <div className="flex justify-center gap-8">
            <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-2 text-label hover:text-ink transition-colors text-sm"
            >
                <HiOutlineRefresh className="text-base" />
                Regenerate Image
            </button>
            <button
                type="button"
                onClick={onPost}
                className="flex items-center gap-2 text-label hover:text-ink transition-colors text-sm"
            >
                <FaInstagram className="text-base" />
                Post to Instagram
            </button>
        </div>
    )
}
