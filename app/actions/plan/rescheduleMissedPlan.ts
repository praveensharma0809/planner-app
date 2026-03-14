"use server"

import { revalidatePath } from "next/cache"
import { buildDaySlots } from "@/lib/planner/feasibility"
import { schedule } from "@/lib/planner/scheduler"
import type { GlobalConstraints, PlannableUnit, ReservedSlot } from "@/lib/planner/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"
import type { PlanConfig, Topic, TopicParams } from "@/lib/types/db"

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

interface PendingUnitMeta {
  unitId: string
  topicId: string | null
  subjectId: string
  subjectName: string
  topicName: string
  titleFallback: string
  sessionType: "core" | "revision" | "practice"
  expectedSessions: number
  originalTotalSessions: number
  remainingSessionNumbers: number[]
  sessionLengthMinutes: number
  dependsOn: string[]
}

interface DroppedReason {
  topicId: string | null
  title: string
  droppedSessions: number
  reason: string
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
      droppedReasons: DroppedReason[]
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
  const [
    { data: profile },
    { data: config },
    { data: offDaysRows },
    { data: subjects },
    { data: topics },
    { data: topicParams },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_available_minutes, exam_date")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("plan_config")
      .select(
        "study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, plan_order, final_revision_days, buffer_percentage, max_active_subjects, day_of_week_capacity, custom_day_capacity, plan_order_stack, flexibility_minutes, max_daily_minutes, max_topics_per_subject_per_day, min_subject_gap_days, subject_ordering, flexible_threshold"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("off_days").select("date").eq("user_id", user.id),
    supabase
      .from("subjects")
      .select("id, name, sort_order, deadline")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase
      .from("topics")
      .select("id, user_id, subject_id, name, sort_order, created_at")
      .eq("user_id", user.id),
    supabase.from("topic_params").select("*").eq("user_id", user.id),
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

  const planConfig = config as PlanConfig | null

  const constraints: GlobalConstraints = {
    study_start_date: today,
    exam_date: examDate,
    weekday_capacity_minutes: Math.max(0, planConfig?.weekday_capacity_minutes ?? dailyMinutes),
    weekend_capacity_minutes: Math.max(0, planConfig?.weekend_capacity_minutes ?? dailyMinutes),
    plan_order: (planConfig?.plan_order as GlobalConstraints["plan_order"]) ?? "balanced",
    final_revision_days: Math.max(0, planConfig?.final_revision_days ?? 0),
    buffer_percentage: Math.max(0, Math.min(50, planConfig?.buffer_percentage ?? 0)),
    max_active_subjects: Math.max(0, planConfig?.max_active_subjects ?? 0),
    ...(planConfig?.day_of_week_capacity && { day_of_week_capacity: planConfig.day_of_week_capacity }),
    ...(planConfig?.custom_day_capacity && { custom_day_capacity: planConfig.custom_day_capacity }),
    ...(planConfig?.plan_order_stack && { plan_order_stack: planConfig.plan_order_stack as GlobalConstraints["plan_order_stack"] }),
    ...(planConfig?.flexibility_minutes != null && { flexibility_minutes: planConfig.flexibility_minutes }),
    ...(planConfig?.max_daily_minutes != null && { max_daily_minutes: planConfig.max_daily_minutes }),
    ...(planConfig?.max_topics_per_subject_per_day != null && { max_topics_per_subject_per_day: planConfig.max_topics_per_subject_per_day }),
    ...(planConfig?.min_subject_gap_days != null && { min_subject_gap_days: planConfig.min_subject_gap_days }),
    ...(planConfig?.subject_ordering && { subject_ordering: planConfig.subject_ordering as GlobalConstraints["subject_ordering"] }),
    ...(planConfig?.flexible_threshold && { flexible_threshold: planConfig.flexible_threshold }),
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

  const reservedSlots: ReservedSlot[] = Array.from(reservedMinutesByDate.entries()).map(([date, minutes]) => ({
    date,
    minutes,
  }))

  const subjectNameMap = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]))
  const subjectDeadlineMap = new Map(
    (subjects ?? []).filter((s) => s.deadline).map((s) => [s.id, s.deadline as string])
  )
  const topicMap = new Map<string, Topic>()
  for (const topic of (topics ?? []) as Topic[]) {
    topicMap.set(topic.id, topic)
  }

  const topicParamMap = new Map<string, TopicParams>()
  for (const param of (topicParams ?? []) as TopicParams[]) {
    topicParamMap.set(param.topic_id, param)
  }

  const pendingUnits: PlannableUnit[] = []
  const pendingUnitMeta = new Map<string, PendingUnitMeta>()

  const tasksByTopic = new Map<string, TaskToMove[]>()
  const adHocTasks: TaskToMove[] = []

  for (const task of pendingTasks) {
    if (task.topic_id && topicMap.has(task.topic_id) && topicParamMap.has(task.topic_id)) {
      const list = tasksByTopic.get(task.topic_id) ?? []
      list.push(task)
      tasksByTopic.set(task.topic_id, list)
    } else {
      adHocTasks.push(task)
    }
  }

  for (const [topicId, tasks] of tasksByTopic.entries()) {
    const topic = topicMap.get(topicId)
    const paramsForTopic = topicParamMap.get(topicId)
    if (!topic || !paramsForTopic) continue

    const sessionLength = paramsForTopic.session_length_minutes ?? tasks[0]?.duration_minutes ?? 60
    const expectedSessions = tasks.length
    const totalSessions = Math.max(
      ...tasks.map((task) => task.total_sessions ?? 0),
      Math.ceil((Math.round(paramsForTopic.estimated_hours * 60)) / sessionLength)
    )

    pendingUnits.push({
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: tasks.reduce((sum, task) => sum + task.duration_minutes, 0),
      session_length_minutes: sessionLength,
      priority: paramsForTopic.priority,
      deadline: paramsForTopic.deadline ?? subjectDeadlineMap.get(topic.subject_id) ?? examDate,
      earliest_start: today,
      depends_on: paramsForTopic.depends_on ?? [],
      rest_after_days: paramsForTopic.rest_after_days,
      max_sessions_per_day: paramsForTopic.max_sessions_per_day,
      study_frequency: paramsForTopic.study_frequency as PlannableUnit["study_frequency"],
      tier: paramsForTopic.tier,
    })

    pendingUnitMeta.set(topic.id, {
      unitId: topic.id,
      topicId: topic.id,
      subjectId: topic.subject_id,
      subjectName: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topicName: topic.name,
      titleFallback: tasks[0]?.title ?? topic.name,
      sessionType: tasks[0]?.session_type ?? "core",
      expectedSessions,
      originalTotalSessions: totalSessions,
      remainingSessionNumbers: tasks
        .map((task) => task.session_number ?? 0)
        .filter((num) => num > 0)
        .sort((a, b) => a - b),
      sessionLengthMinutes: sessionLength,
      dependsOn: paramsForTopic.depends_on ?? [],
    })
  }

  for (const [index, task] of adHocTasks.entries()) {
    const unitId = `adhoc-${index}`
    const subjectName = subjectNameMap.get(task.subject_id) ?? task.subject_id
    pendingUnits.push({
      id: unitId,
      subject_id: task.subject_id,
      subject_name: subjectName,
      topic_name: task.title,
      estimated_minutes: task.duration_minutes,
      session_length_minutes: task.duration_minutes,
      priority: task.priority,
      deadline: examDate,
      earliest_start: today,
      depends_on: [],
    })
    pendingUnitMeta.set(unitId, {
      unitId,
      topicId: task.topic_id,
      subjectId: task.subject_id,
      subjectName,
      topicName: task.title,
      titleFallback: task.title,
      sessionType: task.session_type,
      expectedSessions: 1,
      originalTotalSessions: Math.max(1, task.total_sessions ?? 1),
      remainingSessionNumbers: task.session_number && task.session_number > 0 ? [task.session_number] : [],
      sessionLengthMinutes: task.duration_minutes,
      dependsOn: [],
    })
  }

  const scheduledSessions = schedule(pendingUnits, constraints, offDays, reservedSlots)
  const scheduledCountByUnit = new Map<string, number>()
  const maxAvailableSlot = daySlots.reduce((max, day) => Math.max(max, day.flexCapacity), 0)

  const scheduled: SnapshotTask[] = scheduledSessions.map((session) => {
    const meta = pendingUnitMeta.get(session.topic_id)
    const scheduledCount = scheduledCountByUnit.get(session.topic_id) ?? 0
    scheduledCountByUnit.set(session.topic_id, scheduledCount + 1)

    if (!meta) {
      return {
        subject_id: session.subject_id,
        topic_id: session.topic_id,
        title: session.title,
        scheduled_date: session.scheduled_date,
        duration_minutes: session.duration_minutes,
        session_type: session.session_type,
        priority: session.priority,
        session_number: session.session_number,
        total_sessions: session.total_sessions,
      }
    }

    const sessionNumber = meta.remainingSessionNumbers[scheduledCount] ?? session.session_number
    const totalSessions = meta.originalTotalSessions > 0 ? meta.originalTotalSessions : session.total_sessions
    const title =
      meta.topicId && totalSessions > 1
        ? `${meta.subjectName} – ${meta.topicName} (${sessionNumber}/${totalSessions})`
        : meta.titleFallback

    return {
      subject_id: meta.subjectId,
      topic_id: meta.topicId,
      title,
      scheduled_date: session.scheduled_date,
      duration_minutes: session.duration_minutes,
      session_type: meta.sessionType,
      priority: session.priority,
      session_number: sessionNumber,
      total_sessions: totalSessions,
    }
  })

  const droppedReasons: DroppedReason[] = []
  for (const meta of pendingUnitMeta.values()) {
    const placedSessions = scheduledCountByUnit.get(meta.unitId) ?? 0
    const droppedSessionsForUnit = Math.max(0, meta.expectedSessions - placedSessions)
    if (droppedSessionsForUnit <= 0) continue

    let reason = "no slot before deadline after preserving existing tasks"
    if (meta.dependsOn.length > 0) {
      reason = "dependency ordering left no room before the deadline"
    } else if (meta.sessionLengthMinutes > maxAvailableSlot) {
      reason = "session is longer than any remaining available day capacity"
    }

    droppedReasons.push({
      topicId: meta.topicId,
      title: meta.topicName,
      droppedSessions: droppedSessionsForUnit,
      reason,
    })
  }

  const unscheduledTaskCount = droppedReasons.reduce(
    (sum, item) => sum + item.droppedSessions,
    0
  )

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
        flexibility_minutes: constraints.flexibility_minutes,
        max_daily_minutes: constraints.max_daily_minutes,
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
    droppedReasons,
  })

  return {
    status: "SUCCESS",
    movedTaskCount: scheduled.length,
    unscheduledTaskCount,
    keptCompletedCount,
    droppedReasons,
  }
}
