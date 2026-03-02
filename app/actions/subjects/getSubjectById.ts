"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject } from "@/lib/types/db"

export type GetSubjectByIdResponse =
  | { status: "SUCCESS"; subject: Subject }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function getSubjectById(subjectId: string): Promise<GetSubjectByIdResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("subjects")
    .select("id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, archived, urgency_score, health_state, remaining_minutes, estimated_completion_date, created_at")
    .eq("id", subjectId)
    .eq("user_id", user.id)
    .single()

  if (error || !data) {
    return { status: "ERROR", message: "Subject not found." }
  }

  return { status: "SUCCESS", subject: data as Subject }
}
