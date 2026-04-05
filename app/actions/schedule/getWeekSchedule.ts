"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isCanonicalIntakeManualTask } from "@/lib/planner/contracts"
import { STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

type SessionType = "core" | "revision" | "practice"

type ScheduleTaskRow = {
  id: string
  subject_id: string | null
  task_type: "subject" | "standalone"
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: SessionType
  completed: boolean
  task_source: "manual" | "plan"
  plan_snapshot_id: string | null
  session_number: number
  total_sessions: number
  created_at: string
}

type SubjectRow = {
  id: string
  name: string
  sort_order: number | null
}

export type ScheduleWeekTask = Omit<ScheduleTaskRow, "task_source"> & {
  is_planner_task: boolean
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

function getWeekRange(baseDate: Date) {
  const weekStart = new Date(baseDate)
  weekStart.setHours(12, 0, 0, 0)

  const day = weekStart.getDay()
  const diffToMonday = (day + 6) % 7
  weekStart.setDate(weekStart.getDate() - diffToMonday)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const weekStartISO = normalizeLocalDate(weekStart) ?? getTodayLocalDate()
  const weekEndISO = normalizeLocalDate(weekEnd) ?? weekStartISO

  return {
    weekStartISO,
    weekEndISO,
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
        .not("name", "ilike", "others")
        .not("name", "ilike", "__deprecated_others__")
      .order("sort_order", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, subject_id, task_type, title, scheduled_date, duration_minutes, session_type, completed, task_source, plan_snapshot_id, session_number, total_sessions, created_at"
      )
      .eq("user_id", user.id)
      .gte("scheduled_date", weekStartISO)
      .lte("scheduled_date", weekEndISO)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ])

  if (subjectError) {
    return { status: "ERROR", message: subjectError.message }
  }

  if (taskError) {
    return { status: "ERROR", message: taskError.message }
  }

  const subjects = (subjectRows ?? []) as SubjectRow[]
  const tasks = ((taskRows ?? []) as ScheduleTaskRow[])
    .filter((task) => !isCanonicalIntakeManualTask(task))

  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]))

  const resolvedTasks: ScheduleWeekTask[] = tasks.map((task) => ({
    ...(task.task_type === "standalone" || !task.subject_id
      ? { subject_id: null, subject_name: STANDALONE_SUBJECT_LABEL }
      : { subject_id: task.subject_id, subject_name: subjectNameById.get(task.subject_id) ?? "Unknown subject" }),
    is_planner_task: task.task_source === "plan",
    id: task.id,
    title: task.title,
    scheduled_date: task.scheduled_date,
    duration_minutes: task.duration_minutes,
    session_type: task.session_type,
    completed: task.completed,
    plan_snapshot_id: task.plan_snapshot_id,
    session_number: task.session_number,
    total_sessions: task.total_sessions,
    created_at: task.created_at,
    task_type: task.task_type,
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
