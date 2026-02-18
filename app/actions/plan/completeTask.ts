"use server"

import { supabase } from "@/lib/supabase"

export async function completeTask(taskId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single()

  if (!task || task.completed) return

  await supabase
    .from("tasks")
    .update({ completed: true })
    .eq("id", taskId)

  await supabase.rpc("increment_completed_items", {
    subject_id_input: task.subject_id
  })
}
