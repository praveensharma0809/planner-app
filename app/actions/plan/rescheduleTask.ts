"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isISODate } from "@/lib/planner/contracts"
import { getTodayLocalDate } from "@/lib/tasks/getTasksForDate"

export type RescheduleTaskResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "INVALID_DATE" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function rescheduleTask(taskId: string, newDate: string): Promise<RescheduleTaskResponse> {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { status: "NOT_FOUND" }
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const todayIso = getTodayLocalDate()

    if (!newDate || !isISODate(newDate) || newDate < todayIso) {
      return { status: "INVALID_DATE" }
    }

    const { data: existing } = await supabase
      .from("tasks")
      .select("id, task_type, subject_id, topic_id")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      return { status: "NOT_FOUND" }
    }

    const isStandalone = existing.task_type === "standalone" || !existing.subject_id

    if (!isStandalone) {
      const { data: subject } = await supabase
        .from("subjects")
        .select("deadline, archived")
        .eq("id", existing.subject_id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (subject?.archived) {
        return { status: "ERROR", message: "Cannot reschedule tasks for archived subjects." }
      }

      if (subject?.deadline && newDate > subject.deadline) {
        return {
          status: "ERROR",
          message: `Cannot schedule beyond subject deadline (${subject.deadline}).`,
        }
      }

      if (existing.topic_id) {
        const { data: topic } = await supabase
          .from("topics")
          .select("deadline, earliest_start, archived")
          .eq("id", existing.topic_id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (topic?.archived) {
          return { status: "ERROR", message: "Cannot reschedule tasks for archived topics." }
        }

        if (topic?.earliest_start && newDate < topic.earliest_start) {
          return {
            status: "ERROR",
            message: `Cannot schedule before topic start date (${topic.earliest_start}).`,
          }
        }

        if (topic?.deadline && newDate > topic.deadline) {
          return {
            status: "ERROR",
            message: `Cannot schedule beyond topic deadline (${topic.deadline}).`,
          }
        }
      }
    }

    const { error } = await supabase
      .from("tasks")
      .update({ scheduled_date: newDate })
      .eq("id", taskId)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }

    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")
    return { status: "SUCCESS" }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
