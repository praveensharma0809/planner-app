"use server"

import { revalidatePath } from "next/cache"
import {
  buildDaySlots,
  generatePlan,
  schedule,
  type GlobalConstraints,
  type ReservedSlot,
  type ScheduledSession,
  type PlanResult,
} from "@/lib/planner/engine"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"
import { isISODate, normalizeSessionType } from "@/lib/planner/contracts"
import {
  buildDroppedReasons,
  buildReoptimizeUnits,
  buildSubjectMaps,
  buildTaskSourceByTopic,
  buildTopicParamMap,
  buildUnitsFromActiveTopics,
  buildPendingUnitsAndMeta,
  mapScheduledToSnapshotTasks,
  resolveSessionTaskTitle,
  sortTopicsBySubjectOrder,
  type DroppedReason,
  type PlannerTaskSourceRow,
  type TaskToMove,
} from "@/lib/planner/planTransforms"
import {
  commitPlanAtomic,
  deletePendingPlanTasks,
  getExistingTasksInRange,
  getOffDaysForUser,
  getOpenManualTasksByTopic,
  getPendingPlanTasks,
  getPlanSnapshots,
  getPlannerSettings,
  getRescheduleContext,
  getSubjectsForUser,
  getTopicParamsForUser,
  getTopicsForUser,
  insertPlanSnapshot,
  insertTasks,
} from "@/lib/planner/repository"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type {
  PlanSnapshot,
  Topic,
} from "@/lib/types/db"

const PLANNER_SETTINGS_SELECT =
  "study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, max_active_subjects, day_of_week_capacity, custom_day_capacity, flexibility_minutes, max_daily_minutes"

const TOPIC_SELECT = "id, user_id, subject_id, name, sort_order, created_at"

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
  task_source: "plan"
  plan_snapshot_id: string | null
}

interface PlanConfig {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order?: string
  final_revision_days?: number
  buffer_percentage?: number
  max_active_subjects: number
  day_of_week_capacity?: (number | null)[] | null
  custom_day_capacity?: Record<string, number> | null
  plan_order_stack?: string[] | null
  flexibility_minutes?: number
  max_daily_minutes?: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
}

export type GeneratePlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_CONFIG" }
  | { status: "NO_TOPICS" }
  | { status: "ERROR"; message: string }
  | PlanResult

export type KeepPreviousMode = "future" | "until" | "none" | "merge"

const KEEP_MODES = ["future", "until", "none", "merge"] as const

export type CommitPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskCount: number; snapshotId: string }

export type GetPlanHistoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; snapshots: PlanSnapshot[] }

export type ReoptimizePreviewResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_CONFIG" }
  | { status: "NO_TOPICS" }
  | { status: "ERROR"; message: string }
  | {
      status: "SUCCESS"
      schedule: ScheduledSession[]
      droppedSessions: number
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

function sortPreviewSessions(sessions: ScheduledSession[]) {
  return [...sessions].sort((aSession, bSession) => {
    const dateCompare = aSession.scheduled_date.localeCompare(
      bSession.scheduled_date
    )
    if (dateCompare !== 0) return dateCompare
    if (Boolean(bSession.is_pinned) !== Boolean(aSession.is_pinned)) {
      return Number(Boolean(bSession.is_pinned)) - Number(Boolean(aSession.is_pinned))
    }
    if (Boolean(bSession.is_manual) !== Boolean(aSession.is_manual)) {
      return Number(Boolean(bSession.is_manual)) - Number(Boolean(aSession.is_manual))
    }
    const subjectCompare = aSession.subject_id.localeCompare(bSession.subject_id)
    if (subjectCompare !== 0) return subjectCompare
    const topicCompare = aSession.topic_id.localeCompare(bSession.topic_id)
    if (topicCompare !== 0) return topicCompare
    return (aSession.session_number ?? 0) - (bSession.session_number ?? 0)
  })
}

function normalizeKeepMode(value: KeepPreviousMode | string | null | undefined): KeepPreviousMode {
  const candidate = value as KeepPreviousMode | null | undefined
  return candidate && KEEP_MODES.includes(candidate) ? candidate : "future"
}

function sanitizeSummary(summary: string | undefined, sessionCount: number): string {
  const trimmed = summary?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : `Committed ${sessionCount} sessions`
}

async function normalizePlannerTaskSourceAfterCommit(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  snapshotId: string
): Promise<void> {
  try {
    // Primary correction: rows linked to the new snapshot must always be planner tasks.
    await supabase
      .from("tasks")
      .update({ task_source: "plan" })
      .eq("user_id", userId)
      .eq("plan_snapshot_id", snapshotId)

    // Safety sweep: historical leaked planner rows occasionally ended up as "manual".
    // Canonical manual tasks in this app are session_number=0 and total_sessions=1.
    await supabase
      .from("tasks")
      .update({ task_source: "plan" })
      .eq("user_id", userId)
      .eq("task_source", "manual")
      .not("plan_snapshot_id", "is", null)
  } catch {
    // Do not fail commit response if cleanup step cannot run.
  }
}

function sanitizeSessionsForCommit(
  sessions: ScheduledSession[]
): { ok: true; sessions: ScheduledSession[] } | { ok: false; message: string } {
  const sanitized: ScheduledSession[] = []

  for (const [index, session] of sessions.entries()) {
    if (!session.subject_id || session.subject_id.trim().length === 0) {
      return {
        ok: false,
        message: `Session ${index + 1} is missing subject_id.`,
      }
    }

    if (!session.topic_id || session.topic_id.trim().length === 0) {
      return {
        ok: false,
        message: `Session ${index + 1} is missing topic_id.`,
      }
    }

    if (!isISODate(session.scheduled_date)) {
      return {
        ok: false,
        message: `Session ${index + 1} has invalid scheduled_date. Use YYYY-MM-DD.`,
      }
    }

    if (!Number.isFinite(session.duration_minutes) || session.duration_minutes <= 0) {
      return {
        ok: false,
        message: `Session ${index + 1} must have duration_minutes > 0.`,
      }
    }

    const sessionNumber = Math.max(1, Math.floor(session.session_number ?? 1))
    const totalSessions = Math.max(1, Math.floor(session.total_sessions ?? 1))

    if (sessionNumber > totalSessions) {
      return {
        ok: false,
        message: `Session ${index + 1} has session_number greater than total_sessions.`,
      }
    }

    sanitized.push({
      ...session,
      title: session.title?.trim() || "Study session",
      session_type: normalizeSessionType(session.session_type),
      priority: Number.isFinite(session.priority) ? session.priority : 3,
      duration_minutes: Math.floor(session.duration_minutes),
      session_number: sessionNumber,
      total_sessions: totalSessions,
    })
  }

  return { ok: true, sessions: sanitized }
}

function buildConstraintsFromPlanConfig(
  planConfig: Pick<
    PlanConfig,
    | "study_start_date"
    | "exam_date"
    | "weekday_capacity_minutes"
    | "weekend_capacity_minutes"
    | "plan_order"
    | "final_revision_days"
    | "buffer_percentage"
    | "max_active_subjects"
    | "day_of_week_capacity"
    | "custom_day_capacity"
    | "plan_order_stack"
    | "flexibility_minutes"
    | "max_daily_minutes"
    | "max_topics_per_subject_per_day"
    | "min_subject_gap_days"
    | "subject_ordering"
    | "flexible_threshold"
  >
): GlobalConstraints {
  const normalizedPlanOrder =
    planConfig.plan_order === "priority" ||
    planConfig.plan_order === "deadline" ||
    planConfig.plan_order === "subject" ||
    planConfig.plan_order === "balanced"
      ? planConfig.plan_order
      : "balanced"

  return {
    study_start_date: planConfig.study_start_date,
    exam_date: planConfig.exam_date,
    weekday_capacity_minutes: planConfig.weekday_capacity_minutes,
    weekend_capacity_minutes: planConfig.weekend_capacity_minutes,
    plan_order: normalizedPlanOrder,
    final_revision_days: Math.max(0, planConfig.final_revision_days ?? 0),
    buffer_percentage: Math.max(0, planConfig.buffer_percentage ?? 0),
    max_active_subjects: planConfig.max_active_subjects ?? 0,
    ...(planConfig.day_of_week_capacity && {
      day_of_week_capacity: planConfig.day_of_week_capacity,
    }),
    ...(planConfig.custom_day_capacity && {
      custom_day_capacity: planConfig.custom_day_capacity,
    }),
    ...(planConfig.plan_order_stack && {
      plan_order_stack:
        planConfig.plan_order_stack as GlobalConstraints["plan_order_stack"],
    }),
    ...(planConfig.flexibility_minutes != null && {
      flexibility_minutes: planConfig.flexibility_minutes,
    }),
    ...(planConfig.max_daily_minutes != null && {
      max_daily_minutes: planConfig.max_daily_minutes,
    }),
    ...(planConfig.max_topics_per_subject_per_day != null && {
      max_topics_per_subject_per_day:
        planConfig.max_topics_per_subject_per_day,
    }),
    ...(planConfig.min_subject_gap_days != null && {
      min_subject_gap_days: planConfig.min_subject_gap_days,
    }),
    ...(planConfig.subject_ordering && {
      subject_ordering:
        planConfig.subject_ordering as GlobalConstraints["subject_ordering"],
    }),
    ...(planConfig.flexible_threshold && {
      flexible_threshold: planConfig.flexible_threshold,
    }),
  }
}

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(isoDate: string, days: number) {
  const parts = isoDate.split("-")
  if (parts.length !== 3) return isoDate

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return isoDate
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function getPlanHistory(): Promise<GetPlanHistoryResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await getPlanSnapshots(supabase, user.id, 20)

  if (error) return { status: "SUCCESS", snapshots: [] }

  return { status: "SUCCESS", snapshots: (data ?? []) as PlanSnapshot[] }
}

export async function generatePlanAction(): Promise<GeneratePlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.generate",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  const track = async (
    status: "success" | "warning" | "error",
    metadata: Record<string, unknown>
  ) => {
    await trackServerEvent({
      supabase,
      eventName: "planner.generate",
      status,
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata,
    })
  }

  const { data: config } = await getPlannerSettings(supabase, user.id)

  if (!config) {
    await track("error", { reason: "no_config" })
    return { status: "NO_CONFIG" }
  }
  const planConfig = config as PlanConfig

  const { data: topics, error: topicsError } = await getTopicsForUser(
    supabase,
    user.id,
    TOPIC_SELECT
  )

  if (topicsError) {
    return { status: "ERROR", message: `topics query failed: ${topicsError.message}` }
  }

  if (!topics || topics.length === 0) {
    await track("warning", { reason: "no_topics_raw" })
    return { status: "NO_TOPICS" }
  }

  const { data: subjects, error: subjectsError } = await getSubjectsForUser(
    supabase,
    user.id
  )

  if (subjectsError) {
    await track("error", { reason: "subjects_query_failed", message: subjectsError.message })
    return { status: "ERROR", message: `subjects query failed: ${subjectsError.message}` }
  }

  const activeSubjects = ((subjects ?? []) as Array<{
    id: string
    name: string
    sort_order: number
    deadline?: string | null
    archived?: boolean | null
  }>).filter((subject) => subject.archived !== true)

  const {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
    
  } = buildSubjectMaps(
    activeSubjects
  )

  const activeSubjectIds = new Set(activeSubjects.map((subject) => subject.id))
  const activeTopics = sortTopicsBySubjectOrder(
    (topics as Topic[]).filter(
      (topic) => activeSubjectIds.has(topic.subject_id) && topic.archived !== true
    ),
    subjectOrderMap
  )

  if (activeTopics.length === 0) {
    await track("warning", { reason: "no_topics_active_subjects" })
    return { status: "NO_TOPICS" }
  }

  const topicIds = activeTopics.map((topic) => topic.id)
  const topicNameMap = new Map(activeTopics.map((topic) => [topic.id, topic.name]))
  const [{ data: topicParamRows }, { data: topicTasks }] = await Promise.all([
    getTopicParamsForUser(supabase, user.id, topicIds),
    getOpenManualTasksByTopic(supabase, user.id, undefined, topicIds),
  ])

  const paramMap = buildTopicParamMap((topicParamRows ?? []) as Array<Record<string, unknown>>)

  const topicTaskSourceMap = buildTaskSourceByTopic(
    (topicTasks ?? []) as PlannerTaskSourceRow[]
  )

  const { data: offDayRows } = await getOffDaysForUser(supabase, user.id)

  const units = buildUnitsFromActiveTopics({
    activeTopics,
    paramMap,
    topicTaskSourceMap,
    subjectNameMap,
    subjectDeadlineMap,
    examDate: planConfig.exam_date,
  })

  if (units.length === 0) {
    await track("warning", {
      reason: "no_tasks_to_schedule",
      activeTopics: activeTopics.length,
    })
    return { status: "NO_TOPICS" }
  }

  const result = generatePlan({
    units,
    constraints: buildConstraintsFromPlanConfig(planConfig),
    offDays: new Set<string>(
      ((offDayRows ?? []) as Array<{ date: string }>).map((row) => row.date)
    ),
  })

  const hasFeasibility =
    result.status === "READY" ||
    result.status === "INFEASIBLE" ||
    result.status === "PARTIAL"
  const hasSchedule = result.status === "READY" || result.status === "PARTIAL"

  await track(result.status === "READY" ? "success" : "warning", {
    resultStatus: result.status,
    unitCount: units.length,
    sessionCount: hasSchedule ? result.schedule.length : 0,
    feasible: hasFeasibility ? result.feasibility.feasible : null,
    droppedSessions: result.status === "PARTIAL" ? result.droppedSessions : 0,
  })

  if (result.status === "READY" || result.status === "PARTIAL") {
    const titledSchedule = result.schedule.map((session) => {
      const topicName = topicNameMap.get(session.topic_id) ?? session.title
      const sourceTasks = topicTaskSourceMap.get(session.topic_id) ?? []

      return {
        ...session,
        title: resolveSessionTaskTitle(
          topicName,
          sourceTasks,
          session.session_number,
          session.total_sessions
        ),
      }
    })

    if (result.status === "READY") {
      return { ...result, schedule: titledSchedule }
    }

    return { ...result, schedule: titledSchedule }
  }

  return result
}

export async function commitPlan(
  sessions: ScheduledSession[],
  keepMode: KeepPreviousMode = "future",
  summary?: string
): Promise<CommitPlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  const { data: config } = await getPlannerSettings(supabase, user.id)

  const normalizedKeepMode = normalizeKeepMode(keepMode)
  const sanitizedSessionsResult = sanitizeSessionsForCommit(sessions)
  if (!sanitizedSessionsResult.ok) {
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "warning",
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata: {
        reason: "invalid_session_payload",
        keepMode: normalizedKeepMode,
        sessionCount: sessions.length,
      },
    })
    return {
      status: "ERROR",
      message: sanitizedSessionsResult.message,
    }
  }

  const sanitizedSessions = sanitizedSessionsResult.sessions
  const snapshotSummary = sanitizeSummary(summary, sanitizedSessions.length)

  const newPlanStartDate =
    sanitizedSessions.length > 0
      ? sanitizedSessions.reduce(
          (earliest, session) =>
            session.scheduled_date < earliest ? session.scheduled_date : earliest,
          sanitizedSessions[0].scheduled_date
        )
      : null

  const { data, error } = await commitPlanAtomic(supabase, {
    userId: user.id,
    tasks: sanitizedSessions,
    summary: snapshotSummary,
    configSnapshot: config ?? {},
    keepMode: normalizedKeepMode,
    newPlanStartDate,
  })

  if (error) {
    console.error("commitPlan error:", error.message)
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata: {
        reason: "rpc_error",
        keepMode: normalizedKeepMode,
        sessionCount: sanitizedSessions.length,
        message: error.message,
      },
    })
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  const result = data as {
    status: string
    task_count: number
    snapshot_id: string
  } | null

  if (!result || result.status !== "SUCCESS") {
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata: {
        reason: "rpc_non_success",
        keepMode: normalizedKeepMode,
        sessionCount: sanitizedSessions.length,
        rpcStatus: result?.status ?? null,
      },
    })
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  await normalizePlannerTaskSourceAfterCommit(supabase, user.id, result.snapshot_id)

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard/timetable")
  revalidatePath("/schedule")
  revalidatePath("/planner")

  await trackServerEvent({
    supabase,
    eventName: "planner.commit",
    status: "success",
    userId: user.id,
    durationMs: durationSince(startedAt),
    metadata: {
      keepMode: normalizedKeepMode,
      sessionCount: sanitizedSessions.length,
      taskCount: result.task_count,
      snapshotId: result.snapshot_id,
    },
  })

  return {
    status: "SUCCESS",
    taskCount: result.task_count,
    snapshotId: result.snapshot_id,
  }
}

export async function reoptimizePreviewPlan(
  reservedSessions: ScheduledSession[]
): Promise<ReoptimizePreviewResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "UNAUTHORIZED" }

  const { data: config } = await getPlannerSettings(supabase, user.id)

  if (!config) {
    return { status: "NO_CONFIG" }
  }

  const planConfig = config as PlanConfig

  const { data: topics } = await getTopicsForUser(supabase, user.id, TOPIC_SELECT)

  if (!topics || topics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const [{ data: subjects, error: subjectsError }, { data: topicParamRows }, { data: offDayRows }, { data: topicTasks }] = await Promise.all([
    getSubjectsForUser(supabase, user.id),
    getTopicParamsForUser(supabase, user.id),
    getOffDaysForUser(supabase, user.id),
    getOpenManualTasksByTopic(supabase, user.id),
  ])

  if (subjectsError) {
    return { status: "NO_TOPICS" }
  }

  const activeSubjects = ((subjects ?? []) as Array<{
    id: string
    name: string
    sort_order: number
    deadline?: string | null
    archived?: boolean | null
  }>).filter((subject) => subject.archived !== true)

  const {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
    
  } = buildSubjectMaps(activeSubjects)
  const activeSubjectIds = new Set(activeSubjects.map((subject) => subject.id))
  const activeTopics = sortTopicsBySubjectOrder(
    (topics as Topic[]).filter(
      (topic) => activeSubjectIds.has(topic.subject_id) && topic.archived !== true
    ),
    subjectOrderMap
  )

  if (activeTopics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const topicNameMap = new Map(activeTopics.map((topic) => [topic.id, topic.name]))
  const paramMap = buildTopicParamMap((topicParamRows ?? []) as Array<Record<string, unknown>>)

  const topicTaskSourceMap = buildTaskSourceByTopic(
    (topicTasks ?? []) as PlannerTaskSourceRow[]
  )

  const reservedByDate = new Map<string, number>()
  const reservedGeneratedMinutesByTopic = new Map<string, number>()
  const reservedGeneratedCountByTopic = new Map<string, number>()

  for (const session of reservedSessions) {
    reservedByDate.set(
      session.scheduled_date,
      (reservedByDate.get(session.scheduled_date) ?? 0) + session.duration_minutes
    )

    if (session.is_manual) continue
    reservedGeneratedMinutesByTopic.set(
      session.topic_id,
      (reservedGeneratedMinutesByTopic.get(session.topic_id) ?? 0) +
        session.duration_minutes
    )
    reservedGeneratedCountByTopic.set(
      session.topic_id,
      (reservedGeneratedCountByTopic.get(session.topic_id) ?? 0) + 1
    )
  }

  const { units, totalSessionsByTopic } = buildReoptimizeUnits({
    activeTopics,
    paramMap,
    topicTaskSourceMap,
    subjectNameMap,
    subjectDeadlineMap,
    examDate: planConfig.exam_date,
    reservedGeneratedMinutesByTopic,
  })

  const offDays = new Set<string>(
    ((offDayRows ?? []) as Array<{ date: string }>).map((row) => row.date)
  )
  const reservedSlots: ReservedSlot[] = Array.from(reservedByDate.entries()).map(
    ([date, minutes]) => ({ date, minutes })
  )

  const regenerated = schedule(
    units,
    buildConstraintsFromPlanConfig(planConfig),
    offDays,
    reservedSlots
  ).map((session) => {
    const offset = reservedGeneratedCountByTopic.get(session.topic_id) ?? 0
    const totalSessions =
      totalSessionsByTopic.get(session.topic_id) ??
      session.total_sessions + offset
    const nextSessionNumber = session.session_number + offset
    const topicName = topicNameMap.get(session.topic_id) ?? session.title
    const sourceTasks = topicTaskSourceMap.get(session.topic_id) ?? []

    return {
      ...session,
      title: resolveSessionTaskTitle(
        topicName,
        sourceTasks,
        nextSessionNumber,
        totalSessions
      ),
      session_number: nextSessionNumber,
      total_sessions: totalSessions,
      topic_completion_after:
        totalSessions > 0
          ? Math.round((nextSessionNumber / totalSessions) * 100) / 100
          : session.topic_completion_after,
      is_topic_final_session:
        nextSessionNumber >= totalSessions || undefined,
    }
  })

  const combined = sortPreviewSessions([
    ...reservedSessions.map((session) => ({
      ...session,
      is_pinned: session.is_pinned || session.is_manual || undefined,
      is_manual: session.is_manual || undefined,
    })),
    ...regenerated,
  ])

  const placedCounts = new Map<string, number>()
  for (const session of combined) {
    if (session.is_manual) continue
    placedCounts.set(session.topic_id, (placedCounts.get(session.topic_id) ?? 0) + 1)
  }

  const droppedSessions = Array.from(totalSessionsByTopic.entries()).reduce(
    (sum, [topicId, total]) => sum + Math.max(0, total - (placedCounts.get(topicId) ?? 0)),
    0
  )

  return {
    status: "SUCCESS",
    schedule: combined,
    droppedSessions,
  }
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

  const track = async (
    status: "started" | "success" | "warning" | "error",
    metadata: Record<string, unknown>
  ) => {
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

  const { data: pendingGeneratedRows, error: pendingError } = await getPendingPlanTasks(
    supabase,
    user.id
  )

  if (pendingError) {
    await track("error", {
      reason: "pending_tasks_load_failed",
      message: pendingError.message,
    })
    return { status: "ERROR", message: pendingError.message }
  }

  const pendingTasks = (pendingGeneratedRows ?? []) as TaskToMove[]
  if (pendingTasks.length === 0) {
    await track("warning", { reason: "no_pending_generated_tasks" })
    return { status: "NO_PLAN_TASKS" }
  }

  const [
    { data: profile },
    { data: config },
    { data: offDaysRows },
    { data: subjects },
    { data: topics },
    { data: topicParamRows },
  ] = await getRescheduleContext(
    supabase,
    user.id,
    PLANNER_SETTINGS_SELECT,
    TOPIC_SELECT
  )

  const examDate =
    config?.exam_date ??
    (profile?.exam_date && profile.exam_date >= today
      ? profile.exam_date
      : addDays(today, 90))

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
    weekday_capacity_minutes: Math.max(
      0,
      planConfig?.weekday_capacity_minutes ?? dailyMinutes
    ),
    weekend_capacity_minutes: Math.max(
      0,
      planConfig?.weekend_capacity_minutes ?? dailyMinutes
    ),
    plan_order:
      (planConfig?.plan_order as GlobalConstraints["plan_order"]) ?? "balanced",
    final_revision_days: Math.max(0, planConfig?.final_revision_days ?? 0),
    buffer_percentage: Math.max(
      0,
      Math.min(50, planConfig?.buffer_percentage ?? 0)
    ),
    max_active_subjects: Math.max(0, planConfig?.max_active_subjects ?? 0),
    ...(planConfig?.day_of_week_capacity && {
      day_of_week_capacity: planConfig.day_of_week_capacity,
    }),
    ...(planConfig?.custom_day_capacity && {
      custom_day_capacity: planConfig.custom_day_capacity,
    }),
    ...(planConfig?.plan_order_stack && {
      plan_order_stack:
        planConfig.plan_order_stack as GlobalConstraints["plan_order_stack"],
    }),
    ...(planConfig?.flexibility_minutes != null && {
      flexibility_minutes: planConfig.flexibility_minutes,
    }),
    ...(planConfig?.max_daily_minutes != null && {
      max_daily_minutes: planConfig.max_daily_minutes,
    }),
    ...(planConfig?.max_topics_per_subject_per_day != null && {
      max_topics_per_subject_per_day:
        planConfig.max_topics_per_subject_per_day,
    }),
    ...(planConfig?.min_subject_gap_days != null && {
      min_subject_gap_days: planConfig.min_subject_gap_days,
    }),
    ...(planConfig?.subject_ordering && {
      subject_ordering:
        planConfig.subject_ordering as GlobalConstraints["subject_ordering"],
    }),
    ...(planConfig?.flexible_threshold && {
      flexible_threshold: planConfig.flexible_threshold,
    }),
  }

  const offDays = new Set<string>(
    ((offDaysRows ?? []) as Array<{ date: string }>).map((row) => row.date)
  )
  const daySlots = buildDaySlots(constraints, offDays)

  if (daySlots.length === 0) {
    await track("error", { reason: "no_day_slots", examDate, today })
    return {
      status: "NO_CAPACITY",
      message: "No available study days found between today and your exam date.",
    }
  }

  const { data: existingRows, error: existingError } = await getExistingTasksInRange(
    supabase,
    user.id,
    today,
    examDate
  )

  if (existingError) {
    await track("error", {
      reason: "existing_tasks_load_failed",
      message: existingError.message,
    })
    return { status: "ERROR", message: existingError.message }
  }

  const reservedMinutesByDate = new Map<string, number>()
  let keptCompletedCount = 0

  for (const row of existingRows ?? []) {
    if (row.task_source !== "plan" || row.completed) {
      const used = reservedMinutesByDate.get(row.scheduled_date) ?? 0
      reservedMinutesByDate.set(row.scheduled_date, used + row.duration_minutes)
      if (row.completed) keptCompletedCount += 1
    }
  }

  const reservedSlots: ReservedSlot[] = Array.from(
    reservedMinutesByDate.entries()
  ).map(([date, minutes]) => ({ date, minutes }))

  const activeSubjects = ((subjects ?? []) as Array<{
    id: string
    name: string
    sort_order: number
    deadline?: string | null
    archived?: boolean | null
  }>).filter((subject) => subject.archived !== true)
  const activeSubjectIds = new Set(activeSubjects.map((subject) => subject.id))

  const { subjectNameMap, subjectOrderMap, subjectDeadlineMap } = buildSubjectMaps(
    activeSubjects
  )
  const topicMap = new Map<string, Topic>()
  for (const topic of sortTopicsBySubjectOrder(
    ((topics ?? []) as Topic[]).filter(
      (topic) => activeSubjectIds.has(topic.subject_id) && topic.archived !== true
    ),
    subjectOrderMap
  )) {
    topicMap.set(topic.id, topic)
  }

  const filteredPendingTasks = pendingTasks.filter(
    (task) => activeSubjectIds.has(task.subject_id)
  )

  if (filteredPendingTasks.length === 0) {
    await track("warning", {
      reason: "no_pending_generated_tasks_after_archive_filter",
      pendingTaskCount: pendingTasks.length,
    })
    return { status: "NO_PLAN_TASKS" }
  }

  const topicParamMap = buildTopicParamMap((topicParamRows ?? []) as Array<Record<string, unknown>>)

  const { pendingUnits, pendingUnitMeta } = buildPendingUnitsAndMeta({
    pendingTasks: filteredPendingTasks,
    topicMap,
    topicParamMap,
    subjectNameMap,
    subjectDeadlineMap,
    examDate,
    today,
  })

  const scheduledSessions = schedule(
    pendingUnits,
    constraints,
    offDays,
    reservedSlots
  )
  const maxAvailableSlot = daySlots.reduce(
    (max, day) => Math.max(max, day.flexCapacity),
    0
  )

  const { scheduled, scheduledCountByUnit } = mapScheduledToSnapshotTasks(
    scheduledSessions,
    pendingUnitMeta
  )

  const droppedReasons = buildDroppedReasons({
    pendingUnitMeta,
    scheduledCountByUnit,
    maxAvailableSlot,
  })

  const unscheduledTaskCount = droppedReasons.reduce(
    (sum, item) => sum + item.droppedSessions,
    0
  )

  const { error: deleteError } = await deletePendingPlanTasks(supabase, user.id)

  if (deleteError) {
    await track("error", {
      reason: "delete_old_generated_failed",
      message: deleteError.message,
    })
    return { status: "ERROR", message: deleteError.message }
  }

  const { data: snapshotData } = await insertPlanSnapshot(supabase, {
    user_id: user.id,
    task_count: scheduled.length,
    schedule_json: scheduled,
    settings_snapshot: {
      study_start_date: constraints.study_start_date,
      exam_date: constraints.exam_date,
      weekday_capacity_minutes: constraints.weekday_capacity_minutes,
      weekend_capacity_minutes: constraints.weekend_capacity_minutes,
      final_revision_days: constraints.final_revision_days,
      buffer_percentage: constraints.buffer_percentage,
      flexibility_minutes: constraints.flexibility_minutes,
      max_daily_minutes: constraints.max_daily_minutes,
    },
    summary: `Rescheduled ${filteredPendingTasks.length} pending plan sessions`,
  })

  const snapshotId = snapshotData?.id ?? null

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
      task_source: "plan",
      plan_snapshot_id: snapshotId,
    }))

    const { error: insertError } = await insertTasks(supabase, insertPayload)
    if (insertError) {
      await track("error", {
        reason: "insert_rescheduled_failed",
        message: insertError.message,
      })
      return { status: "ERROR", message: insertError.message }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard/timetable")
  revalidatePath("/schedule")
  revalidatePath("/planner")

  await track(unscheduledTaskCount > 0 ? "warning" : "success", {
    pendingTaskCount: filteredPendingTasks.length,
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

