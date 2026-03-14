"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { schedule } from "@/lib/planner/scheduler"
import type {
  GlobalConstraints,
  PlannableUnit,
  ReservedSlot,
  ScheduledSession,
} from "@/lib/planner/types"
import type { PlanConfig, Topic, TopicParams } from "@/lib/types/db"

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

function sortPreviewSessions(sessions: ScheduledSession[]) {
  return [...sessions].sort((a, b) => {
    const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCompare !== 0) return dateCompare
    if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
      return Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
    }
    if (Boolean(b.is_manual) !== Boolean(a.is_manual)) {
      return Number(Boolean(b.is_manual)) - Number(Boolean(a.is_manual))
    }
    return a.title.localeCompare(b.title)
  })
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
    .select("id, user_id, subject_id, name, sort_order, created_at")
    .eq("user_id", user.id)

  if (!topics || topics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const [{ data: subjects }, { data: params }, { data: offDayRows }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, sort_order")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase.from("topic_params").select("*").eq("user_id", user.id),
    supabase.from("off_days").select("date").eq("user_id", user.id),
  ])

  const activeSubjectIds = new Set((subjects ?? []).map((subject) => subject.id))
  const activeTopics = (topics as Topic[])
    .filter((topic) => activeSubjectIds.has(topic.subject_id))
    .sort((a, b) => {
      const subjectA = (subjects ?? []).find((subject) => subject.id === a.subject_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
      const subjectB = (subjects ?? []).find((subject) => subject.id === b.subject_id)?.sort_order ?? Number.MAX_SAFE_INTEGER
      if (subjectA !== subjectB) return subjectA - subjectB
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at)
      return a.id.localeCompare(b.id)
    })

  if (activeTopics.length === 0) {
    return { status: "NO_TOPICS" }
  }

  const subjectNameMap = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]))
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
      (reservedGeneratedMinutesByTopic.get(session.topic_id) ?? 0) + session.duration_minutes
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
    const reservedGeneratedMinutes = reservedGeneratedMinutesByTopic.get(topic.id) ?? 0
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
      deadline: param.deadline ?? planConfig.exam_date,
      depends_on: param.depends_on ?? [],
    }

    if (param.earliest_start) unit.earliest_start = param.earliest_start
    if (param.rest_after_days != null) unit.rest_after_days = param.rest_after_days
    if (param.max_sessions_per_day != null) unit.max_sessions_per_day = param.max_sessions_per_day
    if (param.study_frequency) {
      unit.study_frequency =
        param.study_frequency === "spaced" ? "spaced" : "daily"
    }

    return [unit]
  })

  const constraints: GlobalConstraints = {
    study_start_date: planConfig.study_start_date,
    exam_date: planConfig.exam_date,
    weekday_capacity_minutes: planConfig.weekday_capacity_minutes,
    weekend_capacity_minutes: planConfig.weekend_capacity_minutes,
    plan_order: (planConfig.plan_order as GlobalConstraints["plan_order"]) ?? "balanced",
    final_revision_days: planConfig.final_revision_days,
    buffer_percentage: planConfig.buffer_percentage,
    max_active_subjects: planConfig.max_active_subjects ?? 0,
    ...(planConfig.day_of_week_capacity && { day_of_week_capacity: planConfig.day_of_week_capacity }),
    ...(planConfig.custom_day_capacity && { custom_day_capacity: planConfig.custom_day_capacity }),
    ...(planConfig.plan_order_stack && { plan_order_stack: planConfig.plan_order_stack as GlobalConstraints["plan_order_stack"] }),
    ...(planConfig.flexibility_minutes != null && { flexibility_minutes: planConfig.flexibility_minutes }),
    ...(planConfig.max_daily_minutes != null && { max_daily_minutes: planConfig.max_daily_minutes }),
    ...(planConfig.max_topics_per_subject_per_day != null && { max_topics_per_subject_per_day: planConfig.max_topics_per_subject_per_day }),
    ...(planConfig.subject_ordering && { subject_ordering: planConfig.subject_ordering as GlobalConstraints["subject_ordering"] }),
  }

  const offDays = new Set<string>((offDayRows ?? []).map((row) => row.date))
  const reservedSlots: ReservedSlot[] = Array.from(reservedByDate.entries()).map(([date, minutes]) => ({ date, minutes }))

  const regenerated = schedule(units, constraints, offDays, reservedSlots).map((session) => {
    const offset = reservedGeneratedCountByTopic.get(session.topic_id) ?? 0
    const totalSessions = totalSessionsByTopic.get(session.topic_id) ?? session.total_sessions + offset
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
        totalSessions > 0 ? Math.round((nextSessionNumber / totalSessions) * 100) / 100 : session.topic_completion_after,
      is_topic_final_session: nextSessionNumber >= totalSessions || undefined,
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

  const droppedSessions = Array.from(totalSessionsByTopic.entries()).reduce((sum, [topicId, total]) => {
    return sum + Math.max(0, total - (placedCounts.get(topicId) ?? 0))
  }, 0)

  return {
    status: "SUCCESS",
    schedule: combined,
    droppedSessions,
  }
}