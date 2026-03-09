"use server"

import { revalidatePath } from "next/cache"
import { buildDaySlots } from "@/lib/planner/feasibility"
import type { GlobalConstraints } from "@/lib/planner/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"

interface TaskToMove {
  subject_id: string
  topic_id: string | null
  title: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number | null
  total_sessions: number | null
  scheduled_date: string
}

interface SnapshotTask {
  subject_id: string
  topic_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number
  total_sessions: number
}

interface InsertTaskRow {
  user_id: string
  subject_id: string
  topic_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number
  total_sessions: number
  completed: boolean
  is_plan_generated: boolean
  plan_version: string | null
}

export type RescheduleMissedPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_PLAN_TASKS" }
  | { status: "NO_CAPACITY"; message: string }
  | { status: "ERROR"; message: string }
  | {
      status: "SUCCESS"
      movedTaskCount: number
      unscheduledTaskCount: number
      keptCompletedCount: number
    }

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate + "T12:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

export async function rescheduleMissedPlan(): Promise<RescheduleMissedPlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.reschedule_missed",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  const track = async (status: "started" | "success" | "warning" | "error", metadata: Record<string, unknown>) => {
    await trackServerEvent({
      supabase,
      eventName: "planner.reschedule_missed",
      status,
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata,
    })
  }

  await track("started", {})

  const today = todayISO()

  // Move only incomplete generated tasks. Completed and manual tasks stay untouched.
  const { data: pendingGeneratedRows, error: pendingError } = await supabase
    .from("tasks")
    .select(
      "subject_id, topic_id, title, duration_minutes, session_type, priority, session_number, total_sessions, scheduled_date"
    )
    .eq("user_id", user.id)
    .eq("is_plan_generated", true)
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })
    .order("priority", { ascending: true })

  if (pendingError) {
    await track("error", { reason: "pending_tasks_load_failed", message: pendingError.message })
    return { status: "ERROR", message: pendingError.message }
  }

  const pendingTasks = (pendingGeneratedRows ?? []) as TaskToMove[]
  if (pendingTasks.length === 0) {
    await track("warning", { reason: "no_pending_generated_tasks" })
    return { status: "NO_PLAN_TASKS" }
  }

  // Use plan config if available, else fallback to profile defaults.
  const [{ data: profile }, { data: config }, { data: offDaysRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_available_minutes, exam_date")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("plan_config")
      .select(
        "study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, plan_order, final_revision_days, buffer_percentage, max_active_subjects"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("off_days").select("date").eq("user_id", user.id),
  ])

  const examDate =
    config?.exam_date ??
    (profile?.exam_date && profile.exam_date >= today ? profile.exam_date : addDays(today, 90))

  if (examDate < today) {
    await track("error", { reason: "exam_date_in_past", examDate, today })
    return {
      status: "NO_CAPACITY",
      message: "Exam date is in the past. Update your deadline in settings first.",
    }
  }

  const dailyMinutes = Math.max(15, profile?.daily_available_minutes ?? 120)

  const constraints: GlobalConstraints = {
    study_start_date: today,
    exam_date: examDate,
    weekday_capacity_minutes: Math.max(0, config?.weekday_capacity_minutes ?? dailyMinutes),
    weekend_capacity_minutes: Math.max(0, config?.weekend_capacity_minutes ?? dailyMinutes),
    plan_order: "balanced",
    final_revision_days: Math.max(0, config?.final_revision_days ?? 0),
    buffer_percentage: Math.max(0, Math.min(50, config?.buffer_percentage ?? 0)),
    max_active_subjects: Math.max(0, config?.max_active_subjects ?? 0),
  }

  const offDays = new Set((offDaysRows ?? []).map((row) => row.date))
  const daySlots = buildDaySlots(constraints, offDays)

  if (daySlots.length === 0) {
    await track("error", { reason: "no_day_slots", examDate, today })
    return {
      status: "NO_CAPACITY",
      message: "No available study days found between today and your exam date.",
    }
  }

  // Reserve capacity for tasks that must remain on the calendar.
  const { data: existingRows, error: existingError } = await supabase
    .from("tasks")
    .select("scheduled_date, duration_minutes, is_plan_generated, completed")
    .eq("user_id", user.id)
    .gte("scheduled_date", today)
    .lte("scheduled_date", examDate)

  if (existingError) {
    await track("error", { reason: "existing_tasks_load_failed", message: existingError.message })
    return { status: "ERROR", message: existingError.message }
  }

  const reservedMinutesByDate = new Map<string, number>()
  let keptCompletedCount = 0

  for (const row of existingRows ?? []) {
    if (!row.is_plan_generated || row.completed) {
      const used = reservedMinutesByDate.get(row.scheduled_date) ?? 0
      reservedMinutesByDate.set(row.scheduled_date, used + row.duration_minutes)
      if (row.completed) keptCompletedCount += 1
    }
  }

  for (const day of daySlots) {
    const reserved = reservedMinutesByDate.get(day.date) ?? 0
    day.remainingMinutes = Math.max(0, day.capacity - reserved)
  }

  const scheduled: SnapshotTask[] = []
  let unscheduledTaskCount = 0

  for (const task of pendingTasks) {
    let placed = false

    for (const day of daySlots) {
      if (day.remainingMinutes < task.duration_minutes) continue

      scheduled.push({
        subject_id: task.subject_id,
        topic_id: task.topic_id,
        title: task.title,
        scheduled_date: day.date,
        duration_minutes: task.duration_minutes,
        session_type: task.session_type,
        priority: task.priority,
        session_number: task.session_number ?? 0,
        total_sessions: task.total_sessions ?? 0,
      })

      day.remainingMinutes -= task.duration_minutes
      placed = true
      break
    }

    if (!placed) {
      unscheduledTaskCount += 1
    }
  }

  // Remove only incomplete generated tasks. Completed generated tasks stay preserved.
  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id)
    .eq("is_plan_generated", true)
    .eq("completed", false)

  if (deleteError) {
    await track("error", { reason: "delete_old_generated_failed", message: deleteError.message })
    return { status: "ERROR", message: deleteError.message }
  }

  let snapshotId: string | null = null
  const { data: snapshotData } = await supabase
    .from("plan_snapshots")
    .insert({
      user_id: user.id,
      task_count: scheduled.length,
      schedule_json: scheduled,
      config_snapshot: {
        study_start_date: constraints.study_start_date,
        exam_date: constraints.exam_date,
        weekday_capacity_minutes: constraints.weekday_capacity_minutes,
        weekend_capacity_minutes: constraints.weekend_capacity_minutes,
        final_revision_days: constraints.final_revision_days,
        buffer_percentage: constraints.buffer_percentage,
      },
      summary: `Rescheduled ${pendingTasks.length} pending plan sessions`,
    })
    .select("id")
    .maybeSingle()

  snapshotId = snapshotData?.id ?? null

  if (scheduled.length > 0) {
    const insertPayload: InsertTaskRow[] = scheduled.map((session) => ({
      user_id: user.id,
      subject_id: session.subject_id,
      topic_id: session.topic_id,
      title: session.title,
      scheduled_date: session.scheduled_date,
      duration_minutes: session.duration_minutes,
      session_type: session.session_type,
      priority: session.priority,
      session_number: session.session_number,
      total_sessions: session.total_sessions,
      completed: false,
      is_plan_generated: true,
      plan_version: snapshotId,
    }))

    const { error: insertError } = await supabase.from("tasks").insert(insertPayload)
    if (insertError) {
      await track("error", { reason: "insert_rescheduled_failed", message: insertError.message })
      return { status: "ERROR", message: insertError.message }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/planner")

  await track(unscheduledTaskCount > 0 ? "warning" : "success", {
    pendingTaskCount: pendingTasks.length,
    movedTaskCount: scheduled.length,
    unscheduledTaskCount,
    keptCompletedCount,
  })

  return {
    status: "SUCCESS",
    movedTaskCount: scheduled.length,
    unscheduledTaskCount,
    keptCompletedCount,
  }
}
