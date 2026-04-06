"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
import type { Task } from "@/lib/types/db"

export type GetMonthTasksResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; tasks: Task[] }

/**
 * Returns all tasks for a given month (YYYY-MM).
 * Defaults to the current month if not specified.
 */
export async function getMonthTasks(
  month?: string
): Promise<GetMonthTasksResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const now = new Date()
    const year = month ? parseInt(month.split("-")[0], 10) : now.getFullYear()
    const mon = month ? parseInt(month.split("-")[1], 10) : now.getMonth() + 1

    const firstDay = `${year}-${String(mon).padStart(2, "0")}-01`
    const lastDay = new Date(year, mon, 0)
    const lastDayStr = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`

    const { data, error } = await supabase
      .from("tasks")
      .select("id, user_id, task_type, subject_id, topic_id, title, scheduled_date, duration_minutes, completed, task_source, session_type, plan_snapshot_id, session_number, total_sessions, sort_order, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("scheduled_date", firstDay)
      .lte("scheduled_date", lastDayStr)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    const tasks = (data ?? []).filter((task) => !isCanonicalIntakeManualTask(task))

    return { status: "SUCCESS", tasks }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
