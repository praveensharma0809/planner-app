"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export type RescheduleTaskResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "INVALID_DATE" }
  | { status: "NOT_FOUND" }
  | { status: "SUCCESS" }

export async function rescheduleTask(taskId: string, newDate: string): Promise<RescheduleTaskResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const parsed = new Date(newDate)
  const todayIso = new Date().toISOString().split("T")[0]

  if (!newDate || isNaN(parsed.getTime()) || newDate < todayIso) {
    return { status: "INVALID_DATE" }
  }

  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!existing) {
    return { status: "NOT_FOUND" }
  }

  const { error } = await supabase
    .from("tasks")
    .update({ scheduled_date: newDate })
    .eq("id", taskId)
    .eq("user_id", user.id)

  if (error) {
    console.error("Reschedule error:", error)
    return { status: "INVALID_DATE" }
  }

  return { status: "SUCCESS" }
}