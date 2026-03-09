"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface TopicParamInput {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
}

export type SaveTopicParamsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function saveTopicParams(
  params: TopicParamInput[]
): Promise<SaveTopicParamsResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const p of params) {
    if (p.estimated_hours < 0) {
      return { status: "ERROR", message: "Estimated hours must be non-negative." }
    }
    if (p.priority < 1 || p.priority > 5) {
      return { status: "ERROR", message: "Priority must be between 1 and 5." }
    }
    if (p.session_length_minutes < 1) {
      return { status: "ERROR", message: "Session length must be at least 1 minute." }
    }

    const { error } = await supabase
      .from("topic_params")
      .upsert(
        {
          user_id: user.id,
          topic_id: p.topic_id,
          estimated_hours: p.estimated_hours,
          priority: p.priority,
          deadline: p.deadline,
          earliest_start: p.earliest_start,
          depends_on: p.depends_on,
          session_length_minutes: Math.max(1, p.session_length_minutes),
          // keep columns populated for DB compat; not used by planner engine
          revision_sessions: 0,
          practice_sessions: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "topic_id" }
      )

    if (error) return { status: "ERROR", message: error.message }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
