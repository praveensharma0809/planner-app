"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface PlanConfigInput {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  session_length_minutes: number
  final_revision_days: number
  buffer_percentage: number
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
  if (config.session_length_minutes < 1) {
    return { status: "ERROR", message: "Session length must be at least 1 minute." }
  }

  const { error } = await supabase
    .from("plan_config")
    .upsert(
      {
        user_id: user.id,
        study_start_date: config.study_start_date,
        exam_date: config.exam_date,
        weekday_capacity_minutes: config.weekday_capacity_minutes,
        weekend_capacity_minutes: config.weekend_capacity_minutes,
        session_length_minutes: config.session_length_minutes,
        final_revision_days: Math.max(0, config.final_revision_days),
        buffer_percentage: Math.min(50, Math.max(0, config.buffer_percentage)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (error) return { status: "ERROR", message: error.message }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
