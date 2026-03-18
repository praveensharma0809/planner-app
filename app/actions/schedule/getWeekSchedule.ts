"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

type SessionType = "core" | "revision" | "practice"

type ScheduleTaskRow = {
  id: string
  subject_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: SessionType
  priority: number
  completed: boolean
  is_plan_generated: boolean
  created_at: string
}

type SubjectRow = {
  id: string
  name: string
  sort_order: number | null
}

export type ScheduleWeekTask = ScheduleTaskRow & {
  subject_name: string
}

export type ScheduleSubjectOption = {
  id: string
  name: string
}

export type GetScheduleWeekDataResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "INVALID_WEEK" }
  | { status: "ERROR"; message: string }
  | {
      status: "SUCCESS"
      weekStartISO: string
      weekEndISO: string
      tasks: ScheduleWeekTask[]
      subjects: ScheduleSubjectOption[]
    }

function toISODateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWeekRange(baseDate: Date) {
  const weekStart = new Date(baseDate)
  weekStart.setHours(12, 0, 0, 0)

  const day = weekStart.getDay()
  const diffToMonday = (day + 6) % 7
  weekStart.setDate(weekStart.getDate() - diffToMonday)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return {
    weekStartISO: toISODateLocal(weekStart),
    weekEndISO: toISODateLocal(weekEnd),
  }
}

export async function getScheduleWeekData(
  weekOfISO?: string
): Promise<GetScheduleWeekDataResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const baseDate = weekOfISO ? new Date(`${weekOfISO}T12:00:00`) : new Date()
  if (isNaN(baseDate.getTime())) {
    return { status: "INVALID_WEEK" }
  }

  const { weekStartISO, weekEndISO } = getWeekRange(baseDate)

  const [{ data: subjectRows, error: subjectError }, { data: taskRows, error: taskError }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, sort_order")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, subject_id, title, scheduled_date, duration_minutes, session_type, priority, completed, is_plan_generated, created_at"
      )
      .eq("user_id", user.id)
      .gte("scheduled_date", weekStartISO)
      .lte("scheduled_date", weekEndISO)
      .order("scheduled_date", { ascending: true })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
  ])

  if (subjectError) {
    return { status: "ERROR", message: subjectError.message }
  }

  if (taskError) {
    return { status: "ERROR", message: taskError.message }
  }

  const subjects = (subjectRows ?? []) as SubjectRow[]
  const tasks = (taskRows ?? []) as ScheduleTaskRow[]

  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]))

  const resolvedTasks: ScheduleWeekTask[] = tasks.map((task) => ({
    ...task,
    subject_name: task.subject_id
      ? subjectNameById.get(task.subject_id) ?? "Others"
      : "Others",
  }))

  return {
    status: "SUCCESS",
    weekStartISO,
    weekEndISO,
    tasks: resolvedTasks,
    subjects: subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
    })),
  }
}
