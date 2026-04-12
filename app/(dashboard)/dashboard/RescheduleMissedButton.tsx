"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { rescheduleMissedPlan } from "@/app/actions/planner/plan"

export function RescheduleMissedButton() {
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const result = await rescheduleMissedPlan()

      if (result.status === "SUCCESS") {
        const baseMessage = `Rescheduled ${result.movedTaskCount} session${
          result.movedTaskCount === 1 ? "" : "s"
        }.`

        if (result.unscheduledTaskCount > 0) {
          const firstDropped = result.droppedReasons[0]
          const detail = firstDropped
            ? ` ${firstDropped.title}: ${firstDropped.reason}.`
            : ""

          addToast(
            `${baseMessage} ${result.unscheduledTaskCount} could not fit before exam date.${detail}`,
            "info"
          )
        } else {
          addToast(baseMessage, "success")
        }

        router.refresh()
        return
      }

      if (result.status === "NO_PLAN_TASKS") {
        addToast("No pending generated tasks to reschedule.", "info")
        return
      }

      if (result.status === "NO_CAPACITY") {
        addToast(result.message, "error")
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Session expired. Please sign in again.", "error")
        return
      }

      addToast(result.message, "error")
    } catch {
      addToast("Could not reschedule right now. Please try again.", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-red-400/70 hover:text-red-400 transition-colors shrink-0 font-medium disabled:opacity-40 disabled:cursor-wait"
    >
      {loading ? "Rescheduling..." : "Reschedule"}
    </button>
  )
}
