"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isISODate } from "@/lib/planner/contracts"
import {
  STANDALONE_SUBJECT_ID,
  assertValidSubjectAssignment,
  isReservedSubjectName,
} from "@/lib/constants"

type UpsertTaskInput = {
  taskId?: string
  title: string
  subjectId: string
  scheduledDate: string
  durationMinutes: number
}

export type UpsertScheduleTaskResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "INVALID_INPUT"; message: string }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskId: string }

async function resolveSubjectId(
  userId: string,
  requestedSubjectId: string
): Promise<
  | { ok: true; subjectId: string | null; taskType: "subject" | "standalone" }
  | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient()

  if (requestedSubjectId === STANDALONE_SUBJECT_ID) {
    return { ok: true, subjectId: null, taskType: "standalone" }
  }

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", requestedSubjectId)
    .eq("user_id", userId)
    .eq("archived", false)
    .maybeSingle()

  if (subjectError) {
    return { ok: false, message: subjectError.message }
  }

  if (!subject) {
    return { ok: false, message: "Subject not found." }
  }

  assertValidSubjectAssignment(subject.name)

  if (isReservedSubjectName(subject.name)) {
    return { ok: false, message: "'Others' is reserved for standalone tasks." }
  }

  return { ok: true, subjectId: subject.id, taskType: "subject" }
}

export async function upsertScheduleTask(
  input: UpsertTaskInput
): Promise<UpsertScheduleTaskResponse> {
  const title = input.title.trim()

  if (!title) {
    return { status: "INVALID_INPUT", message: "Title is required." }
  }

  if (!isISODate(input.scheduledDate)) {
    return { status: "INVALID_INPUT", message: "A valid date is required." }
  }

  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 15) {
    return { status: "INVALID_INPUT", message: "Duration must be at least 15 minutes." }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const resolvedSubject = await resolveSubjectId(user.id, input.subjectId)
  if (!resolvedSubject.ok) {
    return { status: "ERROR", message: resolvedSubject.message }
  }

  const payload: {
    title: string
    task_type: "subject" | "standalone"
    subject_id: string | null
    scheduled_date: string
    duration_minutes: number
    topic_id?: null
  } = {
    title,
    task_type: resolvedSubject.taskType,
    subject_id: resolvedSubject.subjectId,
    scheduled_date: input.scheduledDate,
    duration_minutes: Math.round(input.durationMinutes),
  }

  if (resolvedSubject.taskType === "standalone") {
    payload.topic_id = null
  }

  if (input.taskId) {
    const { data: existingTask, error: existingTaskError } = await supabase
      .from("tasks")
      .select("id, task_source")
      .eq("id", input.taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingTaskError) {
      return { status: "ERROR", message: existingTaskError.message }
    }

    if (!existingTask) {
      return { status: "NOT_FOUND" }
    }

    if (existingTask.task_source === "plan" && resolvedSubject.taskType === "standalone") {
      return {
        status: "INVALID_INPUT",
        message: "Planner-generated tasks must stay linked to a subject.",
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", input.taskId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }

    if (!updated) {
      return { status: "NOT_FOUND" }
    }

    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/calendar")

    return { status: "SUCCESS", taskId: updated.id }
  }

  const { data: created, error: createError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      task_type: resolvedSubject.taskType,
      subject_id: resolvedSubject.subjectId,
      topic_id: null,
      scheduled_date: input.scheduledDate,
      duration_minutes: Math.round(input.durationMinutes),
      session_type: "core",
      completed: false,
      task_source: "manual",
      plan_snapshot_id: null,
    })
    .select("id")
    .single()

  if (createError || !created) {
    return { status: "ERROR", message: createError?.message ?? "Could not create task." }
  }

  revalidatePath("/schedule")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")

  return { status: "SUCCESS", taskId: created.id }
}
