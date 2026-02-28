"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface CreateTaskInput {
  subject_id: string
  title: string
  scheduled_date: string // YYYY-MM-DD
  duration_minutes: number
}

export type CreateTaskResponse =
  | { status: "SUCCESS"; taskId: string }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function createTask(input: CreateTaskInput): Promise<CreateTaskResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  if (!input.title.trim()) {
    return { status: "ERROR", message: "Title is required" }
  }
  if (input.duration_minutes < 1) {
    return { status: "ERROR", message: "Duration must be at least 1 minute" }
  }
  if (!input.scheduled_date) {
    return { status: "ERROR", message: "Date is required" }
  }

  // Verify subject belongs to user
  const { data: subject, error: subjectErr } = await supabase
    .from("subjects")
    .select("id, priority")
    .eq("id", input.subject_id)
    .eq("user_id", user.id)
    .single()

  if (subjectErr || !subject) {
    return { status: "ERROR", message: "Subject not found" }
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      scheduled_date: input.scheduled_date,
      duration_minutes: input.duration_minutes,
      priority: subject.priority,
      completed: false,
      is_plan_generated: false,
    })
    .select("id")
    .single()

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
  return { status: "SUCCESS", taskId: task.id }
}
