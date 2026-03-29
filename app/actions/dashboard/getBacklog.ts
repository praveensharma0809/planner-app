"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
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

  const todayISO = new Date().toISOString().split("T")[0]

  const { data } = await supabase
    .from("tasks")
    .select("id, user_id, subject_id, topic_id, title, scheduled_date, duration_minutes, priority, completed, task_source, session_type, plan_snapshot_id, session_number, total_sessions, sort_order, created_at, updated_at")
    .eq("user_id", user.id)
    .lt("scheduled_date", todayISO)
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })

  const tasks = (data ?? []).filter((task) => !isCanonicalIntakeManualTask(task))

  return { status: "SUCCESS", tasks }
}