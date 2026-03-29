"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isISODate, normalizeSessionType } from "@/lib/planner/contracts"

interface CreateTaskInput {
  subject_id: string
  topic_id?: string
  title: string
  scheduled_date: string // YYYY-MM-DD
  duration_minutes: number
  session_type?: "core" | "revision" | "practice"
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
  if (!isISODate(input.scheduled_date)) {
    return { status: "ERROR", message: "Date must be in YYYY-MM-DD format" }
  }

  const todayIso = new Date().toISOString().split("T")[0]
  if (input.scheduled_date < todayIso) {
    return { status: "ERROR", message: "Date cannot be in the past" }
  }

  // Verify subject belongs to user
  const { data: subject, error: subjectErr } = await supabase
    .from("subjects")
    .select("id, deadline, archived")
    .eq("id", input.subject_id)
    .eq("user_id", user.id)
    .single()

  if (subjectErr || !subject) {
    return { status: "ERROR", message: "Subject not found" }
  }

  if (subject.archived) {
    return { status: "ERROR", message: "Cannot create tasks for archived subjects" }
  }

  if (subject.deadline && input.scheduled_date > subject.deadline) {
    return {
      status: "ERROR",
      message: `Date cannot be after subject deadline (${subject.deadline})`,
    }
  }

  if (input.topic_id) {
    const { data: topic, error: topicErr } = await supabase
      .from("topics")
      .select("id, subject_id, deadline, earliest_start, archived")
      .eq("id", input.topic_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (topicErr || !topic) {
      return { status: "ERROR", message: "Topic not found" }
    }

    if (topic.subject_id !== input.subject_id) {
      return { status: "ERROR", message: "Topic does not belong to selected subject" }
    }

    if (topic.archived) {
      return { status: "ERROR", message: "Cannot create tasks for archived topics" }
    }

    if (topic.earliest_start && input.scheduled_date < topic.earliest_start) {
      return {
        status: "ERROR",
        message: `Date cannot be before topic start (${topic.earliest_start})`,
      }
    }

    if (topic.deadline && input.scheduled_date > topic.deadline) {
      return {
        status: "ERROR",
        message: `Date cannot be after topic deadline (${topic.deadline})`,
      }
    }
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      subject_id: input.subject_id,
      topic_id: input.topic_id ?? null,
      title: input.title.trim(),
      scheduled_date: input.scheduled_date,
      duration_minutes: input.duration_minutes,
      session_type: normalizeSessionType(input.session_type),
      priority: 3,
      completed: false,
      task_source: "manual",
      plan_snapshot_id: null,
    })
    .select("id")
    .single()

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
  revalidatePath("/schedule")
  return { status: "SUCCESS", taskId: task.id }
}
