"use server"

import { revalidatePath } from "next/cache"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
  findDependencyCycle,
  normalizePlannerName,
  type PlannerConstraintValues,
  type PlannerParamValues,
} from "@/lib/planner/draft"
import {
  checkFeasibility,
  type FeasibilityResult,
  type GlobalConstraints,
  type PlannableUnit,
} from "@/lib/planner/engine"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type {
  PlanConfig,
  Subject,
  Subtopic,
  Topic,
  TopicParams,
} from "@/lib/types/db"

export interface StructureTree {
  subjects: (Subject & { topics: (Topic & { subtopics: Subtopic[] })[] })[]
}

interface SubjectInput {
  id?: string
  name: string
  sort_order: number
  deadline?: string
  topics: TopicInput[]
}

interface TopicInput {
  id?: string
  name: string
  sort_order: number
  subtopics: SubtopicInput[]
}

interface SubtopicInput {
  id?: string
  name: string
  sort_order: number
}

interface TopicParamInput {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
  tier?: number
}

interface PlanConfigInput {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: string
  final_revision_days: number
  buffer_percentage: number
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

export type GetStructureResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; tree: StructureTree }

export type SaveStructureResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type GetTopicParamsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; params: TopicParams[] }

export type SaveTopicParamsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type GetPlanConfigResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; config: PlanConfig | null }

export type SavePlanConfigResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type GetDraftFeasibilityResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; feasibility: FeasibilityResult }

export type ReorderSubjectsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type ReorderTopicsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type SaveSubjectDeadlinesResponse = {
  status: "SUCCESS" | "ERROR" | "UNAUTHORIZED"
  message?: string
}

function validateStructure(subjects: SubjectInput[]): string | null {
  for (const subject of subjects) {
    if (!subject.name.trim()) {
      return "Subject name is required."
    }

    const topicNames = new Map<string, string>()
    for (const topic of subject.topics) {
      if (!topic.name.trim()) {
        return "Topic name is required."
      }

      const normalizedTopicName = normalizePlannerName(topic.name)
      if (topicNames.has(normalizedTopicName)) {
        return `Duplicate topic \"${topic.name.trim()}\" in \"${subject.name.trim()}\".`
      }

      topicNames.set(normalizedTopicName, topic.name.trim())
    }
  }

  return null
}

function emptyFeasibility(): FeasibilityResult {
  return {
    feasible: false,
    totalSessionsNeeded: 0,
    totalSlotsAvailable: 0,
    totalFlexAvailable: 0,
    globalGap: 0,
    units: [],
    suggestions: [],
  }
}

function buildDraftConstraints(
  config: PlannerConstraintValues
): GlobalConstraints {
  return {
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    plan_order: config.plan_order,
    final_revision_days: config.final_revision_days,
    buffer_percentage: config.buffer_percentage,
    max_active_subjects: config.max_active_subjects,
    day_of_week_capacity: config.day_of_week_capacity,
    custom_day_capacity: config.custom_day_capacity,
    plan_order_stack: config.plan_order_stack,
    flexibility_minutes: config.flexibility_minutes,
    max_daily_minutes: config.max_daily_minutes,
    max_topics_per_subject_per_day: config.max_topics_per_subject_per_day,
    min_subject_gap_days: config.min_subject_gap_days,
    subject_ordering: config.subject_ordering,
    flexible_threshold: config.flexible_threshold,
  }
}

export async function getStructure(): Promise<GetStructureResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, user_id, name, sort_order, archived, deadline, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  if (!subjects) return { status: "SUCCESS", tree: { subjects: [] } }

  const subjectIds = subjects.map((subject) => subject.id)
  let topics: Topic[] = []
  if (subjectIds.length > 0) {
    const { data: topicRows } = await supabase
      .from("topics")
      .select("id, user_id, subject_id, name, sort_order, created_at")
      .eq("user_id", user.id)
      .in("subject_id", subjectIds)
      .order("sort_order", { ascending: true })
    topics = (topicRows ?? []) as Topic[]
  }

  const topicIds = topics.map((topic) => topic.id)

  let subtopics: Subtopic[] = []
  if (topicIds.length > 0) {
    const { data: subtopicRows } = await supabase
      .from("subtopics")
      .select("id, user_id, topic_id, name, sort_order, created_at")
      .eq("user_id", user.id)
      .in("topic_id", topicIds)
      .order("sort_order", { ascending: true })
    subtopics = (subtopicRows ?? []) as Subtopic[]
  }

  const subtopicsByTopic = new Map<string, Subtopic[]>()
  for (const subtopic of subtopics ?? []) {
    const list = subtopicsByTopic.get(subtopic.topic_id) ?? []
    list.push(subtopic)
    subtopicsByTopic.set(subtopic.topic_id, list)
  }

  const topicsBySubject = new Map<string, (Topic & { subtopics: Subtopic[] })[]>()
  for (const topic of topics ?? []) {
    const list = topicsBySubject.get(topic.subject_id) ?? []
    list.push({ ...topic, subtopics: subtopicsByTopic.get(topic.id) ?? [] })
    topicsBySubject.set(topic.subject_id, list)
  }

  return {
    status: "SUCCESS",
    tree: {
      subjects: subjects.map((subject) => ({
        ...subject,
        topics: topicsBySubject.get(subject.id) ?? [],
      })),
    },
  }
}

export async function saveStructure(
  subjects: SubjectInput[]
): Promise<SaveStructureResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const validationError = validateStructure(subjects)
  if (validationError) {
    return { status: "ERROR", message: validationError }
  }

  const keepSubjectIds = new Set<string>()
  const keepTopicIds = new Set<string>()
  const keepSubtopicIds = new Set<string>()

  for (const subject of subjects) {
    if (subject.id) keepSubjectIds.add(subject.id)
    for (const topic of subject.topics) {
      if (topic.id) keepTopicIds.add(topic.id)
      for (const subtopic of topic.subtopics) {
        if (subtopic.id) keepSubtopicIds.add(subtopic.id)
      }
    }
  }

  const { data: existingSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false)

  for (const subject of existingSubjects ?? []) {
    if (!keepSubjectIds.has(subject.id)) {
      await supabase
        .from("subjects")
        .update({ archived: true })
        .eq("id", subject.id)
        .eq("user_id", user.id)
    }
  }

  const existingSubjectIds = (existingSubjects ?? []).map((subject) => subject.id)
  if (existingSubjectIds.length > 0) {
    const { data: existingTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", user.id)
      .in("subject_id", existingSubjectIds)

    for (const topic of existingTopics ?? []) {
      if (!keepTopicIds.has(topic.id)) {
        await supabase
          .from("subtopics")
          .delete()
          .eq("topic_id", topic.id)
          .eq("user_id", user.id)
        await supabase
          .from("topic_params")
          .delete()
          .eq("topic_id", topic.id)
          .eq("user_id", user.id)
        await supabase
          .from("topics")
          .delete()
          .eq("id", topic.id)
          .eq("user_id", user.id)
      }
    }

    const survivingTopicIds = Array.from(keepTopicIds)
    if (survivingTopicIds.length > 0) {
      const { data: existingSubtopics } = await supabase
        .from("subtopics")
        .select("id")
        .eq("user_id", user.id)
        .in("topic_id", survivingTopicIds)

      for (const subtopic of existingSubtopics ?? []) {
        if (!keepSubtopicIds.has(subtopic.id)) {
          await supabase
            .from("subtopics")
            .delete()
            .eq("id", subtopic.id)
            .eq("user_id", user.id)
        }
      }
    }
  }

  for (const subject of subjects) {
    let subjectId = subject.id

    if (subjectId) {
      const { error } = await supabase
        .from("subjects")
        .update({
          name: subject.name.trim(),
          sort_order: subject.sort_order,
          deadline: subject.deadline ?? null,
        })
        .eq("id", subjectId)
        .eq("user_id", user.id)
      if (error) return { status: "ERROR", message: error.message }
    } else {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          user_id: user.id,
          name: subject.name.trim(),
          sort_order: subject.sort_order,
          deadline: subject.deadline ?? null,
          archived: false,
        })
        .select("id")
        .single()

      if (error || !data) {
        return {
          status: "ERROR",
          message: error?.message ?? "Failed to create subject",
        }
      }
      subjectId = data.id
    }

    for (const topic of subject.topics) {
      let topicId = topic.id

      if (topicId) {
        const { error } = await supabase
          .from("topics")
          .update({ name: topic.name.trim(), sort_order: topic.sort_order })
          .eq("id", topicId)
          .eq("user_id", user.id)
        if (error) return { status: "ERROR", message: error.message }
      } else {
        const { data, error } = await supabase
          .from("topics")
          .insert({
            user_id: user.id,
            subject_id: subjectId,
            name: topic.name.trim(),
            sort_order: topic.sort_order,
          })
          .select("id")
          .single()

        if (error || !data) {
          return {
            status: "ERROR",
            message: error?.message ?? "Failed to create topic",
          }
        }
        topicId = data.id
      }

      for (const subtopic of topic.subtopics) {
        if (!subtopic.name.trim()) continue

        if (subtopic.id) {
          await supabase
            .from("subtopics")
            .update({ name: subtopic.name.trim(), sort_order: subtopic.sort_order })
            .eq("id", subtopic.id)
            .eq("user_id", user.id)
        } else {
          await supabase.from("subtopics").insert({
            user_id: user.id,
            topic_id: topicId,
            name: subtopic.name.trim(),
            sort_order: subtopic.sort_order,
          })
        }
      }
    }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}

export async function getTopicParams(): Promise<GetTopicParamsResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("topic_params")
    .select(
      "id, user_id, topic_id, estimated_hours, priority, deadline, earliest_start, depends_on, revision_sessions, practice_sessions, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency, tier, created_at, updated_at"
    )
    .eq("user_id", user.id)

  if (error) return { status: "SUCCESS", params: [] }

  return { status: "SUCCESS", params: (data ?? []) as TopicParams[] }
}

export async function saveTopicParams(
  params: TopicParamInput[]
): Promise<SaveTopicParamsResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const normalizedParams = params.map((param) => ({
    ...param,
    depends_on: [
      ...new Set(param.depends_on.filter((depId) => depId !== param.topic_id)),
    ],
    session_length_minutes: Math.trunc(param.session_length_minutes),
    rest_after_days: Math.max(0, param.rest_after_days ?? 0),
    max_sessions_per_day: Math.max(0, param.max_sessions_per_day ?? 0),
    study_frequency: param.study_frequency === "spaced" ? "spaced" : "daily",
  }))

  if (normalizedParams.length === 0) {
    return { status: "SUCCESS" }
  }

  for (const param of normalizedParams) {
    if (param.estimated_hours < 0) {
      return {
        status: "ERROR",
        message: "Estimated hours must be non-negative.",
      }
    }
    if (param.session_length_minutes < MIN_SESSION_LENGTH_MINUTES) {
      return {
        status: "ERROR",
        message: `Session length must be at least ${MIN_SESSION_LENGTH_MINUTES} minutes.`,
      }
    }
    if (param.session_length_minutes > MAX_SESSION_LENGTH_MINUTES) {
      return {
        status: "ERROR",
        message: `Session length must be ${MAX_SESSION_LENGTH_MINUTES} minutes or less.`,
      }
    }
  }

  const topicIds = [...new Set(normalizedParams.map((param) => param.topic_id))]
  const { data: topicRows, error: topicError } = await supabase
    .from("topics")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", topicIds)

  if (topicError) return { status: "ERROR", message: topicError.message }

  const knownTopics = topicRows ?? []
  const knownTopicIds = new Set(knownTopics.map((topic) => topic.id))
  const topicNameMap = new Map(knownTopics.map((topic) => [topic.id, topic.name]))

  for (const param of normalizedParams) {
    if (!knownTopicIds.has(param.topic_id)) {
      return { status: "ERROR", message: "A selected topic could not be found." }
    }
    if (param.depends_on.some((depId) => !knownTopicIds.has(depId))) {
      return {
        status: "ERROR",
        message: "Dependencies must point to topics in the current plan.",
      }
    }
  }

  const cycle = findDependencyCycle(
    new Map(normalizedParams.map((param) => [param.topic_id, param.depends_on]))
  )

  if (cycle) {
    const cycleLabel = cycle
      .map((topicId) => topicNameMap.get(topicId) ?? "Unknown topic")
      .join(" -> ")
    return {
      status: "ERROR",
      message: `Dependency loop detected: ${cycleLabel}. Remove one dependency and try again.`,
    }
  }

  for (const param of normalizedParams) {
    const { error } = await supabase
      .from("topic_params")
      .upsert(
        {
          user_id: user.id,
          topic_id: param.topic_id,
          estimated_hours: param.estimated_hours,
          priority: 3,
          deadline: param.deadline,
          earliest_start: param.earliest_start,
          depends_on: param.depends_on,
          session_length_minutes: param.session_length_minutes,
          rest_after_days: param.rest_after_days,
          max_sessions_per_day: param.max_sessions_per_day,
          study_frequency: param.study_frequency,
          tier: 0,
          revision_sessions: 0,
          practice_sessions: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "topic_id" }
      )

    if (error) return { status: "ERROR", message: error.message }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}

export async function getPlanConfig(): Promise<GetPlanConfigResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("plan_config")
    .select(
      "id, user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, plan_order, final_revision_days, buffer_percentage, max_active_subjects, day_of_week_capacity, custom_day_capacity, plan_order_stack, flexibility_minutes, max_daily_minutes, max_topics_per_subject_per_day, min_subject_gap_days, subject_ordering, flexible_threshold, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return { status: "SUCCESS", config: null }

  return { status: "SUCCESS", config: data as PlanConfig | null }
}

export async function savePlanConfig(
  config: PlanConfigInput
): Promise<SavePlanConfigResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  if (!config.study_start_date || !config.exam_date) {
    return {
      status: "ERROR",
      message: "Start date and exam date are required.",
    }
  }
  if (config.study_start_date >= config.exam_date) {
    return {
      status: "ERROR",
      message: "Study start must be before exam date.",
    }
  }
  if (
    config.weekday_capacity_minutes < 0 ||
    config.weekend_capacity_minutes < 0
  ) {
    return { status: "ERROR", message: "Capacity cannot be negative." }
  }

  const validOrders = ["priority", "deadline", "subject", "balanced"]
  if (!validOrders.includes(config.plan_order)) {
    return { status: "ERROR", message: "Invalid plan generation order." }
  }

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    plan_order: config.plan_order,
    final_revision_days: Math.max(0, config.final_revision_days),
    buffer_percentage: Math.min(50, Math.max(0, config.buffer_percentage)),
    max_active_subjects: Math.max(0, config.max_active_subjects ?? 0),
    updated_at: new Date().toISOString(),
  }

  if (config.day_of_week_capacity !== undefined) {
    upsertData.day_of_week_capacity = config.day_of_week_capacity
  }
  if (config.custom_day_capacity !== undefined) {
    upsertData.custom_day_capacity = config.custom_day_capacity
  }
  if (config.plan_order_stack !== undefined) {
    upsertData.plan_order_stack = config.plan_order_stack
  }
  if (config.flexibility_minutes != null) {
    upsertData.flexibility_minutes = Math.max(0, config.flexibility_minutes)
  }
  if (config.max_daily_minutes != null) {
    upsertData.max_daily_minutes = Math.min(
      720,
      Math.max(30, config.max_daily_minutes)
    )
  }
  if (config.max_topics_per_subject_per_day != null) {
    upsertData.max_topics_per_subject_per_day = Math.max(
      1,
      config.max_topics_per_subject_per_day
    )
  }
  if (config.min_subject_gap_days != null) {
    upsertData.min_subject_gap_days = Math.max(0, config.min_subject_gap_days)
  }
  if (config.subject_ordering !== undefined) {
    upsertData.subject_ordering = config.subject_ordering
  }
  if (config.flexible_threshold !== undefined) {
    upsertData.flexible_threshold = config.flexible_threshold
  }

  const { error } = await supabase
    .from("plan_config")
    .upsert(upsertData, { onConflict: "user_id" })

  if (error) return { status: "ERROR", message: error.message }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}

export async function getDraftFeasibility(
  params: PlannerParamValues[],
  config: PlannerConstraintValues
): Promise<GetDraftFeasibilityResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const activeParams = params.filter((param) => param.estimated_hours > 0)
  const topicIds = [...new Set(activeParams.map((param) => param.topic_id))]

  if (topicIds.length === 0) {
    return { status: "SUCCESS", feasibility: emptyFeasibility() }
  }

  const { data: topicRows, error: topicError } = await supabase
    .from("topics")
    .select("id, subject_id, name")
    .eq("user_id", user.id)
    .in("id", topicIds)

  if (topicError) {
    return { status: "SUCCESS", feasibility: emptyFeasibility() }
  }

  const topics = (topicRows ?? []) as Pick<Topic, "id" | "subject_id" | "name">[]
  const subjectIds = [...new Set(topics.map((topic) => topic.subject_id))]

  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", subjectIds)

  const { data: offDayRows } = await supabase
    .from("off_days")
    .select("date")
    .eq("user_id", user.id)

  const paramMap = new Map(activeParams.map((param) => [param.topic_id, param]))
  const subjectNameMap = new Map(
    ((subjectRows ?? []) as Pick<Subject, "id" | "name">[]).map((subject) => [
      subject.id,
      subject.name,
    ])
  )

  const units: PlannableUnit[] = topics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    if (!param || param.estimated_hours <= 0) {
      return []
    }

    return [
      {
        id: topic.id,
        subject_id: topic.subject_id,
        subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
        topic_name: topic.name,
        estimated_minutes: Math.round(param.estimated_hours * 60),
        session_length_minutes: param.session_length_minutes,
        priority: 3,
        deadline: param.deadline || config.exam_date,
        earliest_start: param.earliest_start || undefined,
        depends_on: param.depends_on,
        rest_after_days: param.rest_after_days,
        max_sessions_per_day: param.max_sessions_per_day,
        study_frequency:
          param.study_frequency === "spaced" ? "spaced" : "daily",
      },
    ]
  })

  const offDays = new Set<string>((offDayRows ?? []).map((row) => row.date))

  return {
    status: "SUCCESS",
    feasibility: checkFeasibility(
      units,
      buildDraftConstraints(config),
      offDays
    ),
  }
}

export async function reorderSubjects(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ReorderSubjectsResponse> {
  if (updates.length === 0) return { status: "SUCCESS" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from("subjects")
      .update({ sort_order })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { status: "ERROR", message: error.message }
  }

  return { status: "SUCCESS" }
}

export async function reorderTopics(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ReorderTopicsResponse> {
  if (updates.length === 0) return { status: "SUCCESS" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from("topics")
      .update({ sort_order })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { status: "ERROR", message: error.message }
  }

  return { status: "SUCCESS" }
}

export async function saveSubjectDeadlines(
  updates: Array<{ id: string; deadline: string | null }>
): Promise<SaveSubjectDeadlinesResponse> {
  if (updates.length === 0) return { status: "SUCCESS" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const { id, deadline } of updates) {
    const { error } = await supabase
      .from("subjects")
      .update({ deadline: deadline || null })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { status: "ERROR", message: error.message }
  }

  return { status: "SUCCESS" }
}