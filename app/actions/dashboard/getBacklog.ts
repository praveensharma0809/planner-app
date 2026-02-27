"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
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
    .select("id, user_id, subject_id, title, scheduled_date, duration_minutes, priority, completed, is_plan_generated, created_at")
    .eq("user_id", user.id)
    .lt("scheduled_date", todayISO)
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })

  return { status: "SUCCESS", tasks: data ?? [] }
}