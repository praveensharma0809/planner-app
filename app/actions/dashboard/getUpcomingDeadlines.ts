"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface UpcomingDeadline {
  topic_id: string
  topic_name: string
  subject_id: string
  subject_name: string
  deadline: string
  priority: number
  estimated_hours: number
}

export type GetUpcomingDeadlinesResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; deadlines: UpcomingDeadline[] }

export async function getUpcomingDeadlines(): Promise<GetUpcomingDeadlinesResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: params } = await supabase
    .from("topic_params")
    .select("topic_id, deadline, priority, estimated_hours")
    .eq("user_id", user.id)
    .not("deadline", "is", null)

  if (!params || params.length === 0) {
    return { status: "SUCCESS", deadlines: [] }
  }

  const topicIds = params.map((p) => p.topic_id)

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, subject_id")
    .in("id", topicIds)

  const topicMap = new Map<string, { name: string; subject_id: string }>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, { name: t.name, subject_id: t.subject_id })
  }

  const subjectIds = [...new Set((topics ?? []).map((t) => t.subject_id))]

  let subjects: Array<{ id: string; name: string }> = []
  if (subjectIds.length > 0) {
    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("archived", false)
      .in("id", subjectIds)
    subjects = (subjectRows ?? []) as Array<{ id: string; name: string }>
  }

  const subjectNameMap = new Map<string, string>()
  for (const s of subjects ?? []) {
    subjectNameMap.set(s.id, s.name)
  }

  const deadlines: UpcomingDeadline[] = params
    .map((p) => {
      const topic = topicMap.get(p.topic_id)
      if (!topic) return null
      return {
        topic_id: p.topic_id,
        topic_name: topic.name,
        subject_id: topic.subject_id,
        subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
        deadline: p.deadline!,
        priority: p.priority,
        estimated_hours: p.estimated_hours,
      }
    })
    .filter((d): d is UpcomingDeadline => d !== null)
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))

  return { status: "SUCCESS", deadlines }
}