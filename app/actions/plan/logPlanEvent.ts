"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function logPlanEvent(
  eventType: "analyzed" | "committed" | "resolved_overload",
  taskCount: number,
  summary?: string
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("plan_events").insert({
      user_id: user.id,
      event_type: eventType,
      task_count: taskCount,
      summary: summary ?? null,
    })
  } catch {
    // Silently fail — plan_events table may not exist yet
  }
}
