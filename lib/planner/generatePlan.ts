"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { analyzePlan } from "@/lib/planner/analyzePlan"
import type { OverloadResult } from "@/lib/planner/overloadAnalyzer"
import type { SchedulerMode } from "@/lib/planner/scheduler"

type GeneratePlanResult =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_PROFILE" }
  | { status: "NO_SUBJECTS" }
  | ({ status: "OVERLOAD" } & OverloadResult)
  | { status: "SUCCESS"; taskCount: number }

export async function generatePlan(mode: SchedulerMode): Promise<GeneratePlanResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const today = new Date()

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_available_minutes, exam_date")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { status: "NO_PROFILE" }
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, created_at")
    .eq("user_id", user.id)

  if (!subjects || subjects.length === 0) {
    return { status: "NO_SUBJECTS" }
  }

  const analysis = analyzePlan(
    subjects,
    profile.daily_available_minutes,
    today,
    mode,
    profile.exam_date ?? undefined
  )

  if (analysis.status === "NO_SUBJECTS") {
    return { status: "NO_SUBJECTS" }
  }

  if (analysis.status === "OVERLOAD") {
    return { status: "OVERLOAD", ...analysis }
  }

  await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id)
    .gte("scheduled_date", today.toISOString().split("T")[0])
    .eq("is_plan_generated", true)

  const tasksToInsert = analysis.tasks.map(task => ({
    user_id: user.id,
    subject_id: task.subject_id,
    scheduled_date: task.scheduled_date,
    duration_minutes: task.duration_minutes,
    title: task.title,
    priority: task.priority,
    completed: false,
    is_plan_generated: true
  }))

  if (tasksToInsert.length > 0) {
    await supabase.from("tasks").insert(tasksToInsert)
  }

  return {
    status: "SUCCESS",
    taskCount: tasksToInsert.length
  }
}
