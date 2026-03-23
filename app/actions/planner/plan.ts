"use server"

import { revalidatePath } from "next/cache"
import {
  buildDaySlots,
  generatePlan,
  schedule,
  type GlobalConstraints,
  type PlannableUnit,
  type ReservedSlot,
  type ScheduledSession,
  type PlanResult,
} from "@/lib/planner/engine"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type {
  PlanConfig,
  PlanSnapshot,
  Topic,
  TopicParams,
} from "@/lib/types/db"

const PLAN_CONFIG_SELECT =
  "study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, plan_order, final_revision_days, buffer_percentage, max_active_subjects, day_of_week_capacity, custom_day_capacity, plan_order_stack, flexibility_minutes, max_daily_minutes, max_topics_per_subject_per_day, min_subject_gap_days, subject_ordering, flexible_threshold"

const TOPIC_SELECT = "id, user_id, subject_id, name, sort_order, created_at"

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

export interface DroppedReason {
  topicId: string | null
  title: string
  droppedSessions: number
  reason: string
}

export type GeneratePlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_CONFIG" }
  | { status: "NO_TOPICS" }
  | PlanResult

export type KeepPreviousMode = "future" | "until" | "none" | "merge"

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
    return aSession.title.localeCompare(bSession.title)
  })
}

function mapStudyFrequency(value: string | null | undefined): PlannableUnit["study_frequency"] {
  if (!value) return undefined
  return value === "spaced" ? "spaced" : "daily"
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
  return {
    study_start_date: planConfig.study_start_date,
    exam_date: planConfig.exam_date,
    weekday_capacity_minutes: planConfig.weekday_capacity_minutes,
    weekend_capacity_minutes: planConfig.weekend_capacity_minutes,
    plan_order:
      (planConfig.plan_order as GlobalConstraints["plan_order"]) ?? "balanced",
    final_revision_days: planConfig.final_revision_days,
    buffer_percentage: planConfig.buffer_percentage,
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

function buildSubjectMaps(
  subjects: Array<
    Pick<PlanConfig, never> & {
      id: string
      name: string
      sort_order: number
      deadline?: string | null
      start_date?: string | null
      rest_after_days?: number | null
    }
  >
) {
  const subjectNameMap = new Map<string, string>()
  const subjectOrderMap = new Map<string, number>()
  const subjectDeadlineMap = new Map<string, string>()
  const subjectStartMap = new Map<string, string>()
  const subjectRestAfterMap = new Map<string, number>()

  for (const subject of subjects) {
    subjectNameMap.set(subject.id, subject.name)
    subjectOrderMap.set(subject.id, subject.sort_order ?? 0)
    if (subject.deadline) subjectDeadlineMap.set(subject.id, subject.deadline)
    if (subject.start_date) subjectStartMap.set(subject.id, subject.start_date)
    if (subject.rest_after_days != null) {
      subjectRestAfterMap.set(subject.id, Math.max(0, subject.rest_after_days))
    }
  }

  return {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
    subjectStartMap,
    subjectRestAfterMap,
  }
}

function sortTopicsBySubjectOrder(
  topics: Topic[],
  subjectOrderMap: Map<string, number>
): Topic[] {
  return [...topics].sort((aTopic, bTopic) => {
    const subjectA = subjectOrderMap.get(aTopic.subject_id) ?? Number.MAX_SAFE_INTEGER
    const subjectB = subjectOrderMap.get(bTopic.subject_id) ?? Number.MAX_SAFE_INTEGER
    if (subjectA !== subjectB) return subjectA - subjectB
    if (aTopic.sort_order !== bTopic.sort_order) return aTopic.sort_order - bTopic.sort_order
    if (aTopic.created_at !== bTopic.created_at) {
      return aTopic.created_at.localeCompare(bTopic.created_at)
    }
    return aTopic.id.localeCompare(bTopic.id)
  })
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

export async function getPlanHistory(): Promise<GetPlanHistoryResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("plan_snapshots")
    .select("id, user_id, task_count, schedule_json, config_snapshot, summary, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

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

  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!config) {
    await track("error", { reason: "no_config" })
    return { status: "NO_CONFIG" }
  }
  const planConfig = config as PlanConfig

  const { data: topics } = await supabase
    .from("topics")
    .select(TOPIC_SELECT)
    .eq("user_id", user.id)

  if (!topics || topics.length === 0) {
    await track("warning", { reason: "no_topics_raw" })
    return { status: "NO_TOPICS" }
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, sort_order, deadline, start_date, rest_after_days")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  const {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
    subjectStartMap,
    subjectRestAfterMap,
  } = buildSubjectMaps(
    subjects ?? []
  )

  const activeSubjectIds = new Set((subjects ?? []).map((subject) => subject.id))
  const activeTopics = sortTopicsBySubjectOrder(
    (topics as Topic[]).filter((topic) => activeSubjectIds.has(topic.subject_id)),
    subjectOrderMap
  )

  if (activeTopics.length === 0) {
    await track("warning", { reason: "no_topics_active_subjects" })
    return { status: "NO_TOPICS" }
  }

  const topicIds = activeTopics.map((topic) => topic.id)
  const { data: params } = await supabase
    .from("topic_params")
    .select("*")
    .eq("user_id", user.id)
    .in("topic_id", topicIds)

  const paramMap = new Map<string, TopicParams>()
  for (const param of (params ?? []) as TopicParams[]) {
    paramMap.set(param.topic_id, param)
  }

  const { data: offDayRows } = await supabase
    .from("off_days")
    .select("date")
    .eq("user_id", user.id)

  const units: PlannableUnit[] = activeTopics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    if (!param || param.estimated_hours <= 0) return []

    const unit: PlannableUnit = {
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: Math.round(param.estimated_hours * 60),
      session_length_minutes: param.session_length_minutes ?? 60,
      priority: 3,
      deadline:
        param.deadline ??
        subjectDeadlineMap.get(topic.subject_id) ??
        planConfig.exam_date,
      depends_on: param.depends_on ?? [],
    }

    if (param.earliest_start ?? subjectStartMap.get(topic.subject_id)) {
      unit.earliest_start = param.earliest_start ?? subjectStartMap.get(topic.subject_id)
    }
    if (param.rest_after_days != null || subjectRestAfterMap.has(topic.subject_id)) {
      unit.rest_after_days = param.rest_after_days ?? subjectRestAfterMap.get(topic.subject_id)
    }
    if (param.max_sessions_per_day != null) {
      unit.max_sessions_per_day = param.max_sessions_per_day
    }
    if (param.study_frequency) {
      unit.study_frequency = mapStudyFrequency(param.study_frequency)
    }

    return [unit]
  })

  if (units.length === 0) {
    await track("warning", {
      reason: "no_topics_with_effort",
      activeTopics: activeTopics.length,
    })
    return { status: "NO_TOPICS" }
  }

  const result = generatePlan({
    units,
    constraints: buildConstraintsFromPlanConfig(planConfig),
    offDays: new Set<string>((offDayRows ?? []).map((row) => row.date)),
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

  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  const newPlanStartDate =
    sessions.length > 0
      ? sessions.reduce(
          (earliest, session) =>
            session.scheduled_date < earliest ? session.scheduled_date : earliest,
          sessions[0].scheduled_date
        )
      : null

  const { data, error } = await supabase.rpc("commit_plan_atomic", {
    p_user_id: user.id,
    p_tasks: sessions,
    p_snapshot_summary: summary ?? `Committed ${sessions.length} sessions`,
    p_config_snapshot: config ?? {},
    p_keep_mode: keepMode,
    p_new_plan_start_date: newPlanStartDate,
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
        keepMode,
        sessionCount: sessions.length,
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
        keepMode,
        sessionCount: sessions.length,
        rpcStatus: result?.status ?? null,
      },
    })
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/planner")

  await trackServerEvent({
    supabase,
    eventName: "planner.commit",
    status: "success",
    userId: user.id,
    durationMs: durationSince(startedAt),
    metadata: {
      keepMode,
      sessionCount: sessions.length,
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

  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!config) {
    return { status: "NO_CONFIG" }
  }

  const planConfig = config as PlanConfig

  const { data: topics } = await supabase
    .from("topics")
    .select(TOPIC_SELECT)
    .eq("user_id", user.id)

  if (!topics || topics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const [{ data: subjects }, { data: params }, { data: offDayRows }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, sort_order, deadline, start_date, rest_after_days")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase.from("topic_params").select("*").eq("user_id", user.id),
    supabase.from("off_days").select("date").eq("user_id", user.id),
  ])

  const {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
    subjectStartMap,
    subjectRestAfterMap,
  } = buildSubjectMaps(subjects ?? [])
  const activeSubjectIds = new Set((subjects ?? []).map((subject) => subject.id))
  const activeTopics = sortTopicsBySubjectOrder(
    (topics as Topic[]).filter((topic) => activeSubjectIds.has(topic.subject_id)),
    subjectOrderMap
  )

  if (activeTopics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const topicNameMap = new Map(activeTopics.map((topic) => [topic.id, topic.name]))
  const paramMap = new Map<string, TopicParams>()
  for (const param of (params ?? []) as TopicParams[]) {
    paramMap.set(param.topic_id, param)
  }

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

  const totalSessionsByTopic = new Map<string, number>()
  const units: PlannableUnit[] = activeTopics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    if (!param || param.estimated_hours <= 0) return []

    const totalMinutes = Math.round(param.estimated_hours * 60)
    const reservedGeneratedMinutes =
      reservedGeneratedMinutesByTopic.get(topic.id) ?? 0
    const remainingMinutes = Math.max(0, totalMinutes - reservedGeneratedMinutes)
    const sessionLength = param.session_length_minutes ?? 60

    totalSessionsByTopic.set(topic.id, Math.ceil(totalMinutes / sessionLength))

    if (remainingMinutes <= 0) return []

    const unit: PlannableUnit = {
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: remainingMinutes,
      session_length_minutes: sessionLength,
      priority: 3,
      deadline:
        param.deadline ??
        subjectDeadlineMap.get(topic.subject_id) ??
        planConfig.exam_date,
      depends_on: param.depends_on ?? [],
    }

    if (param.earliest_start ?? subjectStartMap.get(topic.subject_id)) {
      unit.earliest_start = param.earliest_start ?? subjectStartMap.get(topic.subject_id)
    }
    if (param.rest_after_days != null || subjectRestAfterMap.has(topic.subject_id)) {
      unit.rest_after_days = param.rest_after_days ?? subjectRestAfterMap.get(topic.subject_id)
    }
    if (param.max_sessions_per_day != null) {
      unit.max_sessions_per_day = param.max_sessions_per_day
    }
    if (param.study_frequency) {
      unit.study_frequency = mapStudyFrequency(param.study_frequency)
    }

    return [unit]
  })

  const offDays = new Set<string>((offDayRows ?? []).map((row) => row.date))
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
    const subjectName = subjectNameMap.get(session.subject_id) ?? session.subject_id
    const topicName = topicNameMap.get(session.topic_id) ?? session.title

    return {
      ...session,
      title:
        totalSessions > 1
          ? `${subjectName} – ${topicName} (${nextSessionNumber}/${totalSessions})`
          : `${subjectName} – ${topicName}`,
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
    { data: topicParams },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_available_minutes, exam_date")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("plan_config")
      .select(PLAN_CONFIG_SELECT)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("off_days").select("date").eq("user_id", user.id),
    supabase
      .from("subjects")
      .select("id, name, sort_order, deadline")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase.from("topics").select(TOPIC_SELECT).eq("user_id", user.id),
    supabase.from("topic_params").select("*").eq("user_id", user.id),
  ])

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

  const offDays = new Set((offDaysRows ?? []).map((row) => row.date))
  const daySlots = buildDaySlots(constraints, offDays)

  if (daySlots.length === 0) {
    await track("error", { reason: "no_day_slots", examDate, today })
    return {
      status: "NO_CAPACITY",
      message: "No available study days found between today and your exam date.",
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("tasks")
    .select("scheduled_date, duration_minutes, is_plan_generated, completed")
    .eq("user_id", user.id)
    .gte("scheduled_date", today)
    .lte("scheduled_date", examDate)

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
    if (!row.is_plan_generated || row.completed) {
      const used = reservedMinutesByDate.get(row.scheduled_date) ?? 0
      reservedMinutesByDate.set(row.scheduled_date, used + row.duration_minutes)
      if (row.completed) keptCompletedCount += 1
    }
  }

  const reservedSlots: ReservedSlot[] = Array.from(
    reservedMinutesByDate.entries()
  ).map(([date, minutes]) => ({ date, minutes }))

  const { subjectNameMap, subjectOrderMap, subjectDeadlineMap } = buildSubjectMaps(
    subjects ?? []
  )
  const topicMap = new Map<string, Topic>()
  for (const topic of sortTopicsBySubjectOrder(
    (topics ?? []) as Topic[],
    subjectOrderMap
  )) {
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

    const sessionLength =
      paramsForTopic.session_length_minutes ?? tasks[0]?.duration_minutes ?? 60
    const expectedSessions = tasks.length
    const totalSessions = Math.max(
      ...tasks.map((task) => task.total_sessions ?? 0),
      Math.ceil(Math.round(paramsForTopic.estimated_hours * 60) / sessionLength)
    )

    pendingUnits.push({
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: tasks.reduce(
        (sum, task) => sum + task.duration_minutes,
        0
      ),
      session_length_minutes: sessionLength,
      priority: paramsForTopic.priority,
      deadline:
        paramsForTopic.deadline ??
        subjectDeadlineMap.get(topic.subject_id) ??
        examDate,
      earliest_start: today,
      depends_on: paramsForTopic.depends_on ?? [],
      rest_after_days: paramsForTopic.rest_after_days,
      max_sessions_per_day: paramsForTopic.max_sessions_per_day,
      study_frequency: mapStudyFrequency(paramsForTopic.study_frequency),
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
        .sort((aNum, bNum) => aNum - bNum),
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
      remainingSessionNumbers:
        task.session_number && task.session_number > 0
          ? [task.session_number]
          : [],
      sessionLengthMinutes: task.duration_minutes,
      dependsOn: [],
    })
  }

  const scheduledSessions = schedule(
    pendingUnits,
    constraints,
    offDays,
    reservedSlots
  )
  const scheduledCountByUnit = new Map<string, number>()
  const maxAvailableSlot = daySlots.reduce(
    (max, day) => Math.max(max, day.flexCapacity),
    0
  )

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

    const sessionNumber =
      meta.remainingSessionNumbers[scheduledCount] ?? session.session_number
    const totalSessions =
      meta.originalTotalSessions > 0
        ? meta.originalTotalSessions
        : session.total_sessions
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

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id)
    .eq("is_plan_generated", true)
    .eq("completed", false)

  if (deleteError) {
    await track("error", {
      reason: "delete_old_generated_failed",
      message: deleteError.message,
    })
    return { status: "ERROR", message: deleteError.message }
  }

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
      is_plan_generated: true,
      plan_version: snapshotId,
    }))

    const { error: insertError } = await supabase.from("tasks").insert(insertPayload)
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