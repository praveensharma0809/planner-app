"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
import { getTodayLocalDate } from "@/lib/tasks/getTasksForDate"
import type { Task } from "@/lib/types/db"

export type GetBacklogResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; tasks: Task[] }

export async function getBacklog(): Promise<GetBacklogResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const todayISO = getTodayLocalDate()

  const { data } = await supabase
    .from("tasks")
    .select("id, user_id, task_type, subject_id, topic_id, title, scheduled_date, duration_minutes, completed, task_source, session_type, plan_snapshot_id, session_number, total_sessions, sort_order, created_at, updated_at")
    .eq("user_id", user.id)
    .lt("scheduled_date", todayISO)
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })

  const tasks = (data ?? []).filter((task) => !isCanonicalIntakeManualTask(task))

  return { status: "SUCCESS", tasks }
}