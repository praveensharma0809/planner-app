"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

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

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function resolveSubjectId(
  userId: string,
  requestedSubjectId: string
): Promise<{ ok: true; subjectId: string } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient()

  if (requestedSubjectId === "others") {
    const { data: existingRows, error: existingError } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", userId)
      .eq("archived", false)
      .ilike("name", "others")
      .order("sort_order", { ascending: true })
      .limit(1)

    if (existingError) {
      return { ok: false, message: existingError.message }
    }

    const existing = existingRows?.[0]
    if (existing?.id) {
      return { ok: true, subjectId: existing.id }
    }

    const { data: lastSubject, error: lastSubjectError } = await supabase
      .from("subjects")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSubjectError) {
      return { ok: false, message: lastSubjectError.message }
    }

    const nextSortOrder = (lastSubject?.sort_order ?? -1) + 1

    const { data: createdSubject, error: createError } = await supabase
      .from("subjects")
      .insert({
        user_id: userId,
        name: "Others",
        sort_order: nextSortOrder,
        archived: false,
      })
      .select("id")
      .single()

    if (createError || !createdSubject) {
      return { ok: false, message: createError?.message ?? "Could not create Others subject." }
    }

    return { ok: true, subjectId: createdSubject.id }
  }

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id")
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

  return { ok: true, subjectId: subject.id }
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

  const payload = {
    title,
    subject_id: resolvedSubject.subjectId,
    scheduled_date: input.scheduledDate,
    duration_minutes: Math.round(input.durationMinutes),
  }

  if (input.taskId) {
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
      subject_id: resolvedSubject.subjectId,
      topic_id: null,
      scheduled_date: input.scheduledDate,
      duration_minutes: Math.round(input.durationMinutes),
      session_type: "core",
      priority: 3,
      completed: false,
      is_plan_generated: false,
      session_number: null,
      total_sessions: null,
      plan_version: null,
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
