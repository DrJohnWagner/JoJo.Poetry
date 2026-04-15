"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { deletePoem } from "@/lib/api"

/** Two-step delete: first click arms, second click confirms. */
export default function DeleteButton({ id }: { id: string }) {
    const router = useRouter()
    const [armed, setArmed] = useState(false)
    const [pending, startTransition] = useTransition()
    const [err, setErr] = useState<string | null>(null)

    function onClick() {
        if (!armed) {
            setArmed(true)
            setTimeout(() => setArmed(false), 4000)
            return
        }
        startTransition(async () => {
            try {
                await deletePoem(id)
                router.push("/")
                router.refresh()
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Failed")
                setArmed(false)
            }
        })
    }

    return (
        <span className="inline-flex items-center gap-3">
            <button
                type="button"
                onClick={onClick}
                disabled={pending}
                className={`font-sans text-[0.72rem] uppercase tracking-wider2 transition-colors ${
                    armed ? "text-red-700" : "text-muted hover:text-ink"
                } disabled:opacity-60`}
            >
                {pending ? "deleting…" : armed ? "confirm delete" : "delete"}
            </button>
            {err && <span className="text-[0.72rem] text-red-700">{err}</span>}
        </span>
    )
}
