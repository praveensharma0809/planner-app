"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface SubjectProgress {
  id: string
  name: string
  topic_count: number
  total_tasks: number
  completed_tasks: number
  earliest_deadline: string | null
  /** 0–100 */
  percent: number
  /** days until earliest deadline (negative = overdue), null if no deadline */
  daysLeft: number | null
  /** "on_track" | "behind" | "at_risk" | "overdue" | "no_deadline" */
  health: "on_track" | "behind" | "at_risk" | "overdue" | "no_deadline"
}

export type GetSubjectProgressResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; subjects: SubjectProgress[] }

export async function getSubjectProgress(): Promise<GetSubjectProgressResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  if (!subjects || subjects.length === 0) {
    return { status: "SUCCESS", subjects: [] }
  }

  const subjectIds = subjects.map((s) => s.id)

  // Count topics per subject
  const { data: topics } = await supabase
    .from("topics")
    .select("id, subject_id")
    .in("subject_id", subjectIds)

  const topicsBySubject = new Map<string, string[]>()
  for (const t of topics ?? []) {
    const list = topicsBySubject.get(t.subject_id) ?? []
    list.push(t.id)
    topicsBySubject.set(t.subject_id, list)
  }

  // Get earliest deadline per subject from topic_params
  const allTopicIds = (topics ?? []).map((t) => t.id)
  const { data: params } = await supabase
    .from("topic_params")
    .select("topic_id, deadline")
    .in("topic_id", allTopicIds.length > 0 ? allTopicIds : ["__none__"])
    .not("deadline", "is", null)

  const topicSubjectMap = new Map<string, string>()
  for (const t of topics ?? []) {
    topicSubjectMap.set(t.id, t.subject_id)
  }

  const earliestDeadlineBySubject = new Map<string, string>()
  for (const p of params ?? []) {
    const sid = topicSubjectMap.get(p.topic_id)
    if (!sid || !p.deadline) continue
    const current = earliestDeadlineBySubject.get(sid)
    if (!current || p.deadline < current) {
      earliestDeadlineBySubject.set(sid, p.deadline)
    }
  }

  // Count tasks per subject
  const { data: tasks } = await supabase
    .from("tasks")
    .select("subject_id, completed")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds)

  const taskCountBySubject = new Map<string, { total: number; completed: number }>()
  for (const t of tasks ?? []) {
    const entry = taskCountBySubject.get(t.subject_id) ?? { total: 0, completed: 0 }
    entry.total++
    if (t.completed) entry.completed++
    taskCountBySubject.set(t.subject_id, entry)
  }

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const result: SubjectProgress[] = subjects.map((s) => {
    const topicIds = topicsBySubject.get(s.id) ?? []
    const counts = taskCountBySubject.get(s.id) ?? { total: 0, completed: 0 }
    const percent =
      counts.total === 0
        ? 0
        : Math.round((counts.completed / counts.total) * 100)
    const deadline = earliestDeadlineBySubject.get(s.id) ?? null

    let daysLeft: number | null = null
    let health: SubjectProgress["health"] = "no_deadline"

    if (deadline) {
      const deadlineMs = new Date(deadline + "T23:59:59").getTime()
      daysLeft = Math.ceil((deadlineMs - todayMs) / 86_400_000)

      if (daysLeft < 0 && percent < 100) {
        health = "overdue"
      } else if (daysLeft <= 3 && percent < 80) {
        health = "at_risk"
      } else if (daysLeft <= 7 && percent < 60) {
        health = "behind"
      } else {
        health = "on_track"
      }
    }

    return {
      id: s.id,
      name: s.name,
      topic_count: topicIds.length,
      total_tasks: counts.total,
      completed_tasks: counts.completed,
      earliest_deadline: deadline,
      percent,
      daysLeft,
      health,
    }
  })

  return { status: "SUCCESS", subjects: result }
}
