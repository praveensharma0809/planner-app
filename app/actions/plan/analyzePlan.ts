"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { analyzePlan, type AnalyzePlanStatus } from "@/lib/planner/analyzePlan"
import type { OverloadResult } from "@/lib/planner/overloadAnalyzer"
import type { ScheduledTask, SchedulerMode } from "@/lib/planner/scheduler"

export type AnalyzePlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_PROFILE" }
  | { status: "NO_SUBJECTS" }
  | ({ status: "OVERLOAD" } & OverloadResult)
  | ({
      status: "READY"
      tasks: ScheduledTask[]
      taskCount: number
      overload: OverloadResult
      effectiveCapacity?: number
    })

export async function analyzePlanAction(
  mode: SchedulerMode = "strict"
): Promise<AnalyzePlanResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

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
    .select(
      "id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, created_at"
    )
    .eq("user_id", user.id)

  if (!subjects || subjects.length === 0) {
    return { status: "NO_SUBJECTS" }
  }

  const analysis: AnalyzePlanStatus = analyzePlan(
    subjects,
    profile.daily_available_minutes,
    today,
    mode,
    profile.exam_date ?? undefined
  )

  if (analysis.status === "OVERLOAD") {
    return analysis
  }

  if (analysis.status === "NO_SUBJECTS") {
    return { status: "NO_SUBJECTS" }
  }

  return analysis
}