"use client"

import { useRouter } from "next/navigation"
import { useTransition, type MouseEvent } from "react"
import { useToast } from "@/app/components/Toast"
import { setTaskCompletion } from "@/app/actions/plan/setTaskCompletion"
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"

const STATUS_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please sign in again.",
  NOT_FOUND: "Task no longer exists.",
}

function messageFor(status: string, fallback: string) {
  return STATUS_MESSAGES[status] ?? fallback
}

function findRow(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  return target.closest<HTMLElement>("[data-task-row]")
}

function hideRow(row: HTMLElement | null) {
  if (!row) return
  row.style.transition = "opacity 120ms ease, transform 120ms ease"
  row.style.opacity = "0"
  row.style.transform = "translateX(4px)"
  row.style.pointerEvents = "none"
}

function restoreRow(row: HTMLElement | null) {
  if (!row) return
  row.style.opacity = ""
  row.style.transform = ""
  row.style.pointerEvents = ""
}

export function DashboardTaskToggle({
  taskId,
  mode,
}: {
  taskId: string
  mode: "pending" | "completed"
}) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (isPending) return
    const nextCompleted = mode === "pending"
    const row = findRow(e.currentTarget)
    hideRow(row)
    startTransition(async () => {
      const result = await setTaskCompletion(taskId, nextCompleted)
      if (result.status === "SUCCESS") {
        router.refresh()
        return
      }
      restoreRow(row)
      const fallback = result.status === "ERROR" ? result.message : "Could not update task."
      addToast(messageFor(result.status, fallback), "error")
    })
  }

  if (mode === "pending") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label="Complete task"
        aria-disabled={isPending}
        className="ui-checkbox shrink-0"
      >
        <span className="sr-only">Complete</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Mark task as not completed"
      aria-disabled={isPending}
      title="Mark as not completed"
      className="ui-checkbox ui-checkbox-checked shrink-0"
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 12 12" aria-hidden="true">
        <polyline points="2 6 5 9 10 3" />
      </svg>
    </button>
  )
}

export function DashboardTaskDelete({ taskId }: { taskId: string }) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (isPending) return
    const row = findRow(e.currentTarget)
    hideRow(row)
    startTransition(async () => {
      const result = await deleteScheduleTask(taskId)
      if (result.status === "SUCCESS") {
        router.refresh()
        return
      }
      restoreRow(row)
      const fallback = result.status === "ERROR" ? result.message : "Could not delete task."
      addToast(messageFor(result.status, fallback), "error")
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Delete task"
      aria-disabled={isPending}
      title="Delete"
      className="task-icon-delete-button shrink-0"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
      </svg>
      <span className="sr-only">Delete</span>
    </button>
  )
}
