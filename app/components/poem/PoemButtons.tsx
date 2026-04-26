"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { deletePoem } from "@/lib/api"

const ARM_WINDOW_MS = 4000

export default function PoemButtons({
    onEdit,
    onDelete,
    deleteId,
}: {
    onEdit: () => void
    onDelete?: () => void
    deleteId?: string
}) {
    const router = useRouter()
    const [armed, setArmed] = useState(false)
    const [pending, startTransition] = useTransition()
    const [err, setErr] = useState<string | null>(null)
    const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const canDelete = onDelete !== undefined || deleteId !== undefined

    useEffect(() => {
        return () => {
            if (armTimerRef.current) {
                clearTimeout(armTimerRef.current)
                armTimerRef.current = null
            }
        }
    }, [])

    async function runDeleteAction() {
        if (onDelete !== undefined) {
            await onDelete()
            return
        }
        if (deleteId !== undefined) {
            await deletePoem(deleteId)
            router.push("/")
            router.refresh()
        }
    }

    function onDeleteClick() {
        if (!canDelete) return

        if (!armed) {
            setErr(null)
            setArmed(true)
            if (armTimerRef.current) {
                clearTimeout(armTimerRef.current)
            }
            armTimerRef.current = setTimeout(() => {
                setArmed(false)
                armTimerRef.current = null
            }, ARM_WINDOW_MS)
            return
        }

        startTransition(async () => {
            try {
                await runDeleteAction()
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : "Failed")
                setArmed(false)
            }
        })
    }

    return (
        <div className="flex items-center justify-between gap-6">
            <button onClick={onEdit} className="button-primary">
                Edit Poem
            </button>
            <span className="inline-flex items-center gap-3">
                <button
                    type="button"
                    onClick={onDeleteClick}
                    disabled={pending || !canDelete}
                    className={armed ? "button-primary-armed" : "button-primary"}
                >
                    {pending
                        ? "deleting…"
                        : armed
                          ? "confirm delete poem"
                          : "Delete Poem"}
                </button>
                {err && <span className="button-text button-text-compact button-text-danger">{err}</span>}
            </span>
        </div>
    )
}

