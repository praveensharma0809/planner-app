"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
} from "@/lib/planner/constants"
import { findDependencyCycle } from "@/lib/planner/validation"
import { revalidatePath } from "next/cache"

interface TopicParamInput {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  // v2 fields
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
  tier?: number
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

  const normalizedParams = params.map((param) => ({
    ...param,
    depends_on: [...new Set(param.depends_on.filter((depId) => depId !== param.topic_id))],
    session_length_minutes: Math.trunc(param.session_length_minutes),
    rest_after_days: Math.max(0, param.rest_after_days ?? 0),
    max_sessions_per_day: Math.max(0, param.max_sessions_per_day ?? 0),
    study_frequency: param.study_frequency === "spaced" ? "spaced" : "daily",
  }))

  for (const p of normalizedParams) {
    if (p.estimated_hours < 0) {
      return { status: "ERROR", message: "Estimated hours must be non-negative." }
    }
    if (p.session_length_minutes < MIN_SESSION_LENGTH_MINUTES) {
      return {
        status: "ERROR",
        message: `Session length must be at least ${MIN_SESSION_LENGTH_MINUTES} minutes.`,
      }
    }
    if (p.session_length_minutes > MAX_SESSION_LENGTH_MINUTES) {
      return {
        status: "ERROR",
        message: `Session length must be ${MAX_SESSION_LENGTH_MINUTES} minutes or less.`,
      }
    }
  }

  const topicIds = [...new Set(normalizedParams.map((param) => param.topic_id))]
  const { data: topicRows, error: topicError } = await supabase
    .from("topics")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", topicIds)

  if (topicError) return { status: "ERROR", message: topicError.message }

  const knownTopics = topicRows ?? []
  const knownTopicIds = new Set(knownTopics.map((topic) => topic.id))
  const topicNameMap = new Map(knownTopics.map((topic) => [topic.id, topic.name]))

  for (const param of normalizedParams) {
    if (!knownTopicIds.has(param.topic_id)) {
      return { status: "ERROR", message: "A selected topic could not be found." }
    }
    if (param.depends_on.some((depId) => !knownTopicIds.has(depId))) {
      return {
        status: "ERROR",
        message: "Dependencies must point to topics in the current plan.",
      }
    }
  }

  const cycle = findDependencyCycle(
    new Map(normalizedParams.map((param) => [param.topic_id, param.depends_on]))
  )

  if (cycle) {
    const cycleLabel = cycle
      .map((topicId) => topicNameMap.get(topicId) ?? "Unknown topic")
      .join(" -> ")
    return {
      status: "ERROR",
      message: `Dependency loop detected: ${cycleLabel}. Remove one dependency and try again.`,
    }
  }

  for (const p of normalizedParams) {
    const { error } = await supabase
      .from("topic_params")
      .upsert(
        {
          user_id: user.id,
          topic_id: p.topic_id,
          estimated_hours: p.estimated_hours,
          priority: 3,
          deadline: p.deadline,
          earliest_start: p.earliest_start,
          depends_on: p.depends_on,
          session_length_minutes: p.session_length_minutes,
          // v2 fields
          rest_after_days: p.rest_after_days,
          max_sessions_per_day: p.max_sessions_per_day,
          study_frequency: p.study_frequency,
          tier: 0,
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
