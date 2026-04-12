"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"
import type { Task } from "@/lib/types/db"

export type GetWeeklySnapshotResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; tasks: Task[] }

function getWeekRange(base: Date): { startISO: string; endISO: string } {
  const start = new Date(base)
  start.setHours(12, 0, 0, 0)
  const day = start.getDay()
  const diffToMonday = (day + 6) % 7
  start.setDate(start.getDate() - diffToMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startISO = normalizeLocalDate(start) ?? getTodayLocalDate()
  const endISO = normalizeLocalDate(end) ?? startISO
  return { startISO, endISO }
}

/**
 * Fetch tasks for a given week. If `weekOf` is provided (ISO date string),
 * the week containing that date is used. Otherwise defaults to the current week.
 */
export async function getWeeklySnapshot(weekOf?: string): Promise<GetWeeklySnapshotResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const baseDate = weekOf ? new Date(weekOf + "T12:00:00") : new Date()
    if (isNaN(baseDate.getTime())) {
      return { status: "SUCCESS", tasks: [] }
    }

    const { startISO, endISO } = getWeekRange(baseDate)

    const { data, error } = await supabase
      .from("tasks")
      .select("id, user_id, task_type, subject_id, topic_id, title, scheduled_date, duration_minutes, completed, task_source, session_type, plan_snapshot_id, session_number, total_sessions, sort_order, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("scheduled_date", startISO)
      .lte("scheduled_date", endISO)
      .order("scheduled_date", { ascending: true })

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    const tasks = (data ?? []).filter((task) => !isCanonicalIntakeManualTask(task))

    return {
      status: "SUCCESS",
      tasks
    }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
