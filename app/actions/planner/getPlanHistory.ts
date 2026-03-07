"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { PlanSnapshot } from "@/lib/types/db"

export type GetPlanHistoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; snapshots: PlanSnapshot[] }

export async function getPlanHistory(): Promise<GetPlanHistoryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("plan_snapshots")
    .select("id, user_id, task_count, schedule_json, config_snapshot, summary, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return { status: "SUCCESS", snapshots: [] }

  return { status: "SUCCESS", snapshots: (data ?? []) as PlanSnapshot[] }
}
