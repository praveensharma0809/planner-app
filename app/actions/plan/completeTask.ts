"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function completeTask(taskId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase.rpc("complete_task_with_streak", {
    p_task_id: taskId
  })

  if (error) {
    console.error("Complete task error:", error)
  }
}
