"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { PlanConfig } from "@/lib/types/db"

export type GetPlanConfigResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; config: PlanConfig | null }

export async function getPlanConfig(): Promise<GetPlanConfigResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("plan_config")
    .select("id, user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, plan_order, final_revision_days, buffer_percentage, max_active_subjects, day_of_week_capacity, custom_day_capacity, plan_order_stack, flexibility_minutes, max_daily_minutes, max_topics_per_subject_per_day, min_subject_gap_days, subject_ordering, flexible_threshold, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return { status: "SUCCESS", config: null }

  return { status: "SUCCESS", config: data as PlanConfig | null }
}
