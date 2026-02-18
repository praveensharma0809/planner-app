"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function completeTask(taskId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, user_id, subject_id, completed")
    .eq("id", taskId)
    .maybeSingle()   // 🔥 FIXED HERE

  if (error) {
    console.error("Task fetch error:", error)
    return
  }

  if (!task) return
  if (task.completed) return

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ completed: true })
    .eq("id", taskId)
    .eq("user_id", user.id)

  if (updateError) {
    console.error("Task update error:", updateError)
    return
  }

  const { error: rpcError } = await supabase.rpc(
    "increment_completed_items",
    { subject_id_input: task.subject_id }
  )

  if (rpcError) {
    console.error("RPC error:", rpcError)
  }
}
