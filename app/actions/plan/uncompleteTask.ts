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

  // Decrement completed_items on the parent subject (floor at 0).
  const { data: subject } = await supabase
    .from("subjects")
    .select("completed_items")
    .eq("id", updatedTask.subject_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (subject) {
    await supabase
      .from("subjects")
      .update({ completed_items: Math.max(0, subject.completed_items - 1) })
      .eq("id", updatedTask.subject_id)
      .eq("user_id", user.id)
  }

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
}
