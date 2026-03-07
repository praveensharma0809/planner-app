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
  revision_sessions: number
  practice_sessions: number
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
          revision_sessions: Math.max(0, p.revision_sessions),
          practice_sessions: Math.max(0, p.practice_sessions),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "topic_id" }
      )

    if (error) return { status: "ERROR", message: error.message }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
