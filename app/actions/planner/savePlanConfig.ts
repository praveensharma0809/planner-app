"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface PlanConfigInput {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: string
  final_revision_days: number
  buffer_percentage: number
  max_active_subjects: number
  // v2 fields (all optional for backward compat)
  day_of_week_capacity?: (number | null)[] | null
  custom_day_capacity?: Record<string, number> | null
  plan_order_stack?: string[] | null
  flexibility_minutes?: number
  max_daily_minutes?: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
}

export type SavePlanConfigResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function savePlanConfig(
  config: PlanConfigInput
): Promise<SavePlanConfigResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  if (!config.study_start_date || !config.exam_date) {
    return { status: "ERROR", message: "Start date and exam date are required." }
  }
  if (config.study_start_date >= config.exam_date) {
    return { status: "ERROR", message: "Study start must be before exam date." }
  }
  if (config.weekday_capacity_minutes < 0 || config.weekend_capacity_minutes < 0) {
    return { status: "ERROR", message: "Capacity cannot be negative." }
  }
  const validOrders = ["priority", "deadline", "subject", "balanced"]
  if (!validOrders.includes(config.plan_order)) {
    return { status: "ERROR", message: "Invalid plan generation order." }
  }

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    plan_order: config.plan_order,
    final_revision_days: Math.max(0, config.final_revision_days),
    buffer_percentage: Math.min(50, Math.max(0, config.buffer_percentage)),
    max_active_subjects: Math.max(0, config.max_active_subjects ?? 0),
    updated_at: new Date().toISOString(),
  }

  // v2 fields — only include if provided
  if (config.day_of_week_capacity !== undefined)
    upsertData.day_of_week_capacity = config.day_of_week_capacity
  if (config.custom_day_capacity !== undefined)
    upsertData.custom_day_capacity = config.custom_day_capacity
  if (config.plan_order_stack !== undefined)
    upsertData.plan_order_stack = config.plan_order_stack
  if (config.flexibility_minutes != null)
    upsertData.flexibility_minutes = Math.max(0, config.flexibility_minutes)
  if (config.max_daily_minutes != null)
    upsertData.max_daily_minutes = Math.min(720, Math.max(30, config.max_daily_minutes))
  if (config.max_topics_per_subject_per_day != null)
    upsertData.max_topics_per_subject_per_day = Math.max(1, config.max_topics_per_subject_per_day)
  if (config.min_subject_gap_days != null)
    upsertData.min_subject_gap_days = Math.max(0, config.min_subject_gap_days)
  if (config.subject_ordering !== undefined)
    upsertData.subject_ordering = config.subject_ordering
  if (config.flexible_threshold !== undefined)
    upsertData.flexible_threshold = config.flexible_threshold

  const { error } = await supabase
    .from("plan_config")
    .upsert(upsertData, { onConflict: "user_id" })

  if (error) return { status: "ERROR", message: error.message }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
