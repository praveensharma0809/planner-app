"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

type SessionType = "core" | "revision" | "practice"

type PlannerImportRow = {
  id: string
  subject_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: SessionType
  completed: boolean
  created_at: string
}

export type PlannerImportTask = PlannerImportRow & {
  subject_name: string
}

export type ImportPlannerScheduleResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | {
      status: "SUCCESS"
      weekStartISO: string
      weekEndISO: string
      tasks: PlannerImportTask[]
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

/**
 * Imports planner-generated daily tasks for the current week.
 * Optional `weekOfISO` allows importing another week when needed.
 */
export async function importPlannerSchedule(
  weekOfISO?: string
): Promise<ImportPlannerScheduleResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" }
    }

    const baseDate = weekOfISO ? new Date(`${weekOfISO}T12:00:00`) : new Date()
    if (isNaN(baseDate.getTime())) {
      return { status: "ERROR", message: "Invalid week date provided." }
    }

    const { weekStartISO, weekEndISO } = getWeekRange(baseDate)

    const { data: rows, error: taskError } = await supabase
      .from("tasks")
      .select(
        "id, subject_id, title, scheduled_date, duration_minutes, session_type, completed, created_at"
      )
      .eq("user_id", user.id)
      .eq("task_source", "plan")
      .gte("scheduled_date", weekStartISO)
      .lte("scheduled_date", weekEndISO)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: true })

    if (taskError) {
      return { status: "ERROR", message: taskError.message }
    }

    const tasks = (rows ?? []) as PlannerImportRow[]
    const subjectNameById = new Map<string, string>()

    const subjectIds = [
      ...new Set(
        tasks
          .map((task) => task.subject_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ]

    if (subjectIds.length > 0) {
      const { data: subjectRows, error: subjectError } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", subjectIds)

      if (subjectError) {
        return { status: "ERROR", message: subjectError.message }
      }

      for (const subject of subjectRows ?? []) {
        subjectNameById.set(subject.id, subject.name)
      }
    }

    const resolvedTasks: PlannerImportTask[] = tasks.map((task) => ({
      ...task,
      subject_name: task.subject_id
        ? subjectNameById.get(task.subject_id) ?? "Unknown"
        : "Unknown",
    }))

    return {
      status: "SUCCESS",
      weekStartISO,
      weekEndISO,
      tasks: resolvedTasks,
    }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}