"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Marks a completed task as incomplete.
 * Decrements the parent subject's completed_items counter.
 * Does NOT modify the streak (streak adjustments on undo are complex
 * and could break things; we keep it simple).
 */
export async function uncompleteTask(taskId: string) {
  if (!taskId || typeof taskId !== "string") return

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Mark task incomplete — only if it is currently completed (idempotent guard).
  const { data: updatedTask, error: taskError } = await supabase
    .from("tasks")
    .update({ completed: false })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("completed", true)
    .select("subject_id")
    .maybeSingle()

  if (taskError || !updatedTask) return

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
  revalidatePath("/schedule")
}
