"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { TopicParams } from "@/lib/types/db"

export type GetTopicParamsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; params: TopicParams[] }

export async function getTopicParams(): Promise<GetTopicParamsResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("topic_params")
    .select("id, user_id, topic_id, estimated_hours, priority, deadline, earliest_start, depends_on, revision_sessions, practice_sessions, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency, tier, created_at, updated_at")
    .eq("user_id", user.id)

  if (error) return { status: "SUCCESS", params: [] }

  return { status: "SUCCESS", params: (data ?? []) as TopicParams[] }
}
