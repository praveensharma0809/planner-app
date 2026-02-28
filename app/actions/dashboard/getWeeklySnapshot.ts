"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Task } from "@/lib/types/db"

export type GetWeeklySnapshotResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; tasks: Task[] }

function getWeekRange(base: Date): { startISO: string; endISO: string } {
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diffToMonday = (day + 6) % 7
  start.setDate(start.getDate() - diffToMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startISO = start.toISOString().split("T")[0]
  const endISO = end.toISOString().split("T")[0]
  return { startISO, endISO }
}

/**
 * Fetch tasks for a given week. If `weekOf` is provided (ISO date string),
 * the week containing that date is used. Otherwise defaults to the current week.
 */
export async function getWeeklySnapshot(weekOf?: string): Promise<GetWeeklySnapshotResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const baseDate = weekOf ? new Date(weekOf + "T12:00:00") : new Date()
  if (isNaN(baseDate.getTime())) {
    return { status: "SUCCESS", tasks: [] }
  }

  const { startISO, endISO } = getWeekRange(baseDate)

  const { data } = await supabase
    .from("tasks")
    .select("id, user_id, subject_id, title, scheduled_date, duration_minutes, priority, completed, is_plan_generated, created_at")
    .eq("user_id", user.id)
    .gte("scheduled_date", startISO)
    .lte("scheduled_date", endISO)
    .order("scheduled_date", { ascending: true })

  return {
    status: "SUCCESS",
    tasks: data ?? []
  }
}