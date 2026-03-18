"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type DeleteScheduleTaskResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function deleteScheduleTask(taskId: string): Promise<DeleteScheduleTaskResponse> {
  if (!taskId) {
    return { status: "NOT_FOUND" }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (!existing) {
    return { status: "NOT_FOUND" }
  }

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id)

  if (deleteError) {
    return { status: "ERROR", message: deleteError.message }
  }

  revalidatePath("/schedule")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")

  return { status: "SUCCESS" }
}
