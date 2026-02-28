"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { PlanEvent } from "@/lib/types/db"

export type GetPlanHistoryResponse =
  | { status: "SUCCESS"; events: PlanEvent[] }
  | { status: "UNAUTHORIZED" }

export async function getPlanHistory(): Promise<GetPlanHistoryResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    const { data, error } = await supabase
      .from("plan_events")
      .select("id, user_id, event_type, task_count, summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    // Table may not exist yet — return empty gracefully
    if (error) return { status: "SUCCESS", events: [] }

    return { status: "SUCCESS", events: (data ?? []) as PlanEvent[] }
  } catch {
    return { status: "SUCCESS", events: [] }
  }
}
