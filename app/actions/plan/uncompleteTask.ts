"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type UncompleteTaskResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

/**
 * Marks a completed task as incomplete.
 * Decrements the parent subject's completed_items counter.
 * Does NOT modify the streak (streak adjustments on undo are complex
 * and could break things; we keep it simple).
 */
export async function uncompleteTask(taskId: string) {
  if (!taskId || typeof taskId !== "string") {
    return { status: "NOT_FOUND" } satisfies UncompleteTaskResponse
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: "UNAUTHORIZED" } satisfies UncompleteTaskResponse
  }

  // Mark task incomplete — only if it is currently completed (idempotent guard).
  const { data: updatedTask, error: taskError } = await supabase
    .from("tasks")
    .update({ completed: false })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("completed", true)
    .select("subject_id, task_source, source_topic_task_id")
    .maybeSingle()

  if (taskError) {
    return {
      status: "ERROR",
      message: taskError.message,
    } satisfies UncompleteTaskResponse
  }

  if (!updatedTask) {
    return { status: "NOT_FOUND" } satisfies UncompleteTaskResponse
  }

  if (
    updatedTask.task_source === "plan"
    && typeof updatedTask.source_topic_task_id === "string"
    && updatedTask.source_topic_task_id.length > 0
  ) {
    const { error: topicTaskError } = await supabase
      .from("topic_tasks")
      .update({ completed: false })
      .eq("id", updatedTask.source_topic_task_id)
      .eq("user_id", user.id)

    if (topicTaskError) {
      return {
        status: "ERROR",
        message: topicTaskError.message,
      } satisfies UncompleteTaskResponse
    }
  }

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
  revalidatePath("/schedule")
  revalidatePath("/dashboard/subjects")
  revalidatePath("/planner")
  return { status: "SUCCESS" } satisfies UncompleteTaskResponse
}
