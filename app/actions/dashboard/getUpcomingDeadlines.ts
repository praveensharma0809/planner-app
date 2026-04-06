"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface UpcomingDeadline {
  topic_id: string
  topic_name: string
  subject_id: string
  subject_name: string
  deadline: string
  estimated_hours: number
}

export type GetUpcomingDeadlinesResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; deadlines: UpcomingDeadline[] }

export async function getUpcomingDeadlines(): Promise<GetUpcomingDeadlinesResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, name, subject_id, deadline, estimated_hours")
      .eq("user_id", user.id)
      .not("deadline", "is", null)

    if (topicsError) {
      return { status: "ERROR", message: topicsError.message }
    }

    if (!topics || topics.length === 0) {
      return { status: "SUCCESS", deadlines: [] }
    }

    const topicMap = new Map<string, { name: string; subject_id: string }>()
    for (const t of topics ?? []) {
      topicMap.set(t.id, { name: t.name, subject_id: t.subject_id })
    }

    const subjectIds = [...new Set((topics ?? []).map((t) => t.subject_id))]

    let subjects: Array<{ id: string; name: string }> = []
    if (subjectIds.length > 0) {
      const { data: subjectRows, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("archived", false)
        .not("name", "ilike", "others")
        .not("name", "ilike", "__deprecated_others__")
        .in("id", subjectIds)

      if (subjectsError) {
        return { status: "ERROR", message: subjectsError.message }
      }

      subjects = (subjectRows ?? []) as Array<{ id: string; name: string }>
    }

    const subjectNameMap = new Map<string, string>()
    for (const s of subjects ?? []) {
      subjectNameMap.set(s.id, s.name)
    }

    const deadlines: UpcomingDeadline[] = topics
      .map((topic) => {
        const mapped = topicMap.get(topic.id)
        if (!mapped || !topic.deadline) return null
        return {
          topic_id: topic.id,
          topic_name: mapped.name,
          subject_id: mapped.subject_id,
          subject_name: subjectNameMap.get(mapped.subject_id) ?? "Unknown",
          deadline: topic.deadline,
          estimated_hours: topic.estimated_hours,
        }
      })
      .filter((d): d is UpcomingDeadline => d !== null)
      .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))

    return { status: "SUCCESS", deadlines }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}