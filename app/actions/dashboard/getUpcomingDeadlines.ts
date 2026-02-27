"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject } from "@/lib/types/db"

export type GetUpcomingDeadlinesResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; subjects: Subject[] }

export async function getUpcomingDeadlines(): Promise<GetUpcomingDeadlinesResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data } = await supabase
    .from("subjects")
    .select("id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, created_at")
    .eq("user_id", user.id)
    .not("deadline", "is", null)
    .order("deadline", { ascending: true })

  return {
    status: "SUCCESS",
    subjects: data ?? []
  }
}