"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type SetSubjectTaskCompletionResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

type SyncTopicTaskCompletionRow = {
  status: "SUCCESS" | "UNAUTHORIZED" | "NOT_FOUND"
  synced_execution_count: number
}

function revalidateSubjectToggleViews() {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/schedule")
  revalidatePath("/dashboard/subjects")
  revalidatePath("/planner")
}

export async function setSubjectTaskCompletion(
  taskId: string,
  nextCompleted: boolean
): Promise<SetSubjectTaskCompletionResponse> {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { status: "NOT_FOUND" }
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { data, error } = await supabase.rpc("sync_topic_task_completion", {
      p_topic_task_id: taskId,
      p_next_completed: nextCompleted,
    })

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    const row = (Array.isArray(data) ? data[0] : null) as SyncTopicTaskCompletionRow | null
    if (!row) {
      return { status: "ERROR", message: "Unexpected sync response." }
    }

    if (row.status === "UNAUTHORIZED") {
      return { status: "UNAUTHORIZED" }
    }

    if (row.status === "NOT_FOUND") {
      return { status: "NOT_FOUND" }
    }

    revalidateSubjectToggleViews()
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
