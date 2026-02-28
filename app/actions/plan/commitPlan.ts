"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logPlanEvent } from "./logPlanEvent"
import type { ScheduledTask } from "@/lib/planner/scheduler"

export type CommitPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskCount: number }

interface CommitPlanInput {
  tasks: ScheduledTask[]
}

export async function commitPlan({ tasks }: CommitPlanInput): Promise<CommitPlanResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const today = new Date()
  const todayISO = today.toISOString().split("T")[0]

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id)
    .gte("scheduled_date", todayISO)
    .eq("is_plan_generated", true)

  if (deleteError) {
    console.error("commitPlan: delete error:", deleteError.message)
    return { status: "ERROR", message: "Failed to clear old tasks." }
  }

  const upcomingTasks = (tasks || []).filter(task => task.scheduled_date >= todayISO)

  if (upcomingTasks.length > 0) {
    const { error: insertError } = await supabase.from("tasks").insert(
      upcomingTasks.map(task => ({
        user_id: user.id,
        subject_id: task.subject_id,
        scheduled_date: task.scheduled_date,
        duration_minutes: task.duration_minutes,
        title: task.title,
        priority: task.priority,
        completed: false,
        is_plan_generated: true
      }))
    )

    if (insertError) {
      console.error("commitPlan: insert error:", insertError.message)
      return { status: "ERROR", message: "Failed to insert new tasks." }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")

  await logPlanEvent("committed", upcomingTasks.length, `Committed ${upcomingTasks.length} tasks`)

  return {
    status: "SUCCESS",
    taskCount: upcomingTasks.length
  }
}