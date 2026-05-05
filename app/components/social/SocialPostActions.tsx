import { HiOutlineRefresh, HiOutlineShare } from "react-icons/hi"

export default function SocialPostActions({
    onRegenerate,
    onPost,
    canPost,
}: {
    onRegenerate: () => void
    onPost: () => void
    canPost: boolean
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
                disabled={!canPost}
                className="flex items-center gap-2 text-label hover:text-ink transition-colors text-sm disabled:pointer-events-none disabled:opacity-30"
            >
                <HiOutlineShare className="text-base" />
                Publish
            </button>
        </div>
    )
}
