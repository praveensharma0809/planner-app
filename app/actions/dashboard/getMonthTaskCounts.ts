"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
import { normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

export interface DayTaskCount {
  date: string
  count: number
  completed: number
}

export type GetMonthTaskCountsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; days: DayTaskCount[] }

/**
 * Returns task counts per day for a given month (YYYY-MM).
 * Defaults to the current month if not specified.
 */
export async function getMonthTaskCounts(
  month?: string
): Promise<GetMonthTaskCountsResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    // Determine first and last day of the month
    const now = new Date()
    const year = month ? parseInt(month.split("-")[0], 10) : now.getFullYear()
    const mon = month ? parseInt(month.split("-")[1], 10) : now.getMonth() + 1

    const firstDay = `${year}-${String(mon).padStart(2, "0")}-01`
    const lastDay = new Date(year, mon, 0) // last day of month
    const lastDayStr = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`

    const { data, error } = await supabase
      .from("tasks")
      .select("scheduled_date, completed, task_source, plan_snapshot_id, session_number, total_sessions")
      .eq("user_id", user.id)
      .gte("scheduled_date", firstDay)
      .lte("scheduled_date", lastDayStr)

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    if (!data) {
      return { status: "SUCCESS", days: [] }
    }

    // Aggregate by date
    const map = new Map<string, { count: number; completed: number }>()
    for (const task of data) {
      if (isCanonicalIntakeManualTask(task)) {
        continue
      }
      const dayKey = normalizeLocalDate(task.scheduled_date)
      if (!dayKey) continue

      const entry = map.get(dayKey) ?? { count: 0, completed: 0 }
      entry.count++
      if (task.completed) entry.completed++
      map.set(dayKey, entry)
    }

    const days: DayTaskCount[] = Array.from(map.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { status: "SUCCESS", days }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
