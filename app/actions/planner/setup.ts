"use server"

import { revalidatePath } from "next/cache"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
  findDependencyCycle,
  inferSessionLengthMinutes,
  normalizePlannerName,
  type PlannerConstraintValues,
  type PlannerParamValues,
} from "@/lib/planner/draft"
import {
  isISODate,
  normalizeOptionalDate,
  normalizeStudyFrequency,
  validateDateWindow,
} from "@/lib/planner/contracts"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"
import {
  checkFeasibility,
  type FeasibilityResult,
  type GlobalConstraints,
  type PlannableUnit,
} from "@/lib/planner/engine"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isReservedSubjectName } from "@/lib/constants"
import type {
  Subject,
  TopicTask,
  Topic,
} from "@/lib/types/db"

export interface StructureTask {
  id: string
  topic_id: string | null
  title: string
  completed: boolean
  duration_minutes: number
  sort_order: number
  created_at: string
}

export interface StructureTree {
  subjects: (Subject & { topics: (Topic & { tasks: StructureTask[] })[] })[]
}

export interface GetStructureOptions {
  onlyUndoneTasks?: boolean
  dropTopicsWithoutTasks?: boolean
  selectedTaskIds?: string[]
}

interface SubjectInput {
  id?: string
  name: string
  sort_order: number
  deadline?: string | null
  rest_after_days?: number
  topics: TopicInput[]
}

interface TopicInput {
  id?: string
  name: string
  sort_order: number
}

interface TopicParams {
  topic_id: string
  estimated_hours: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  rest_after_days: number
  max_sessions_per_day: number
  study_frequency: string
}

interface PlanConfig {
  user_id: string
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
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
  intake_import_mode?: IntakeImportMode
}

export type IntakeImportMode = "all" | "undone"

interface TopicParamInput {
  topic_id: string
  estimated_hours: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
}

interface PlanConfigInput {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  max_active_subjects?: number
  day_of_week_capacity?: (number | null)[] | null
  custom_day_capacity?: Record<string, number> | null
  flexibility_minutes?: number
  // Legacy runtime options retained for engine compatibility.
  plan_order?: string
  final_revision_days?: number
  buffer_percentage?: number
  plan_order_stack?: string[] | null
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
}

export type GetStructureResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
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
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; config: PlanConfig | null }

export type SavePlanConfigResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export type GetIntakeImportModeResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; mode: IntakeImportMode }

export type SaveIntakeImportModeResponse =
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

    if (isReservedSubjectName(subject.name)) {
      return '"Others" is reserved for standalone tasks.'
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

function normalizeSelectedTaskIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of input) {
    if (typeof raw !== "string") continue
    const value = raw.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)

    if (normalized.length >= 5000) break
  }

  return normalized
}

function normalizeIntakeImportMode(input: unknown): IntakeImportMode {
  return input === "undone" ? "undone" : "all"
}

function todayIsoDate(): string {
  return getTodayLocalDate()
}

function addDaysIsoDate(isoDate: string, days: number): string {
  const normalized = normalizeLocalDate(isoDate)
  if (!normalized) return isoDate

  const date = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate

  date.setDate(date.getDate() + days)
  return normalizeLocalDate(date) ?? normalized
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
    max_topics_per_subject_per_day: config.max_topics_per_subject_per_day,
    min_subject_gap_days: config.min_subject_gap_days,
    subject_ordering: config.subject_ordering,
    flexible_threshold: config.flexible_threshold,
  }
}

export async function getStructure(options: GetStructureOptions = {}): Promise<GetStructureResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data: subjectRows, error: subjectError } = await supabase
    .from("subjects")
    .select("id, user_id, name, sort_order, archived, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .not("name", "ilike", "others")
    .not("name", "ilike", "__deprecated_others__")
    .order("sort_order", { ascending: true })

  if (subjectError) {
    return { status: "ERROR", message: subjectError.message }
  }

  const subjects = (subjectRows ?? []) as Subject[]
  if (subjects.length === 0) {
    return { status: "SUCCESS", tree: { subjects: [] } }
  }

  const subjectIds = subjects.map((subject) => subject.id)
  let topics: Topic[] = []
  if (subjectIds.length > 0) {
    const { data: topicRows, error: topicError } = await supabase
      .from("topics")
      .select("id, user_id, subject_id, name, sort_order, archived, created_at")
      .eq("user_id", user.id)
      .eq("archived", false)
      .in("subject_id", subjectIds)
      .order("sort_order", { ascending: true })

    if (topicError) {
      return { status: "ERROR", message: topicError.message }
    }

    topics = (topicRows ?? []) as Topic[]
  }

  const topicIds = topics.map((topic) => topic.id)
  const selectedTaskIds = normalizeSelectedTaskIds(options.selectedTaskIds)

  let tasks: TopicTask[] = []
  if (topicIds.length > 0) {
    let query = supabase
      .from("topic_tasks")
      .select("id, topic_id, title, completed, duration_minutes, sort_order, created_at")
      .eq("user_id", user.id)
      .in("topic_id", topicIds)

    if (options.onlyUndoneTasks) {
      query = query.eq("completed", false)
    }

    if (selectedTaskIds.length > 0) {
      query = query.in("id", selectedTaskIds)
    }

    const { data: taskRows, error: taskError } = await query
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (taskError) {
      return { status: "ERROR", message: taskError.message }
    }

    tasks = (taskRows ?? []) as TopicTask[]
  }

  const tasksByTopic = new Map<string, StructureTask[]>()
  for (const task of tasks ?? []) {
    if (!task.topic_id) continue
    const list = tasksByTopic.get(task.topic_id) ?? []
    list.push({
      id: task.id,
      topic_id: task.topic_id,
      title: task.title,
      completed: task.completed,
      duration_minutes: task.duration_minutes,
      sort_order: task.sort_order ?? 0,
      created_at: task.created_at,
    })
    tasksByTopic.set(task.topic_id, list)
  }

  const topicsBySubject = new Map<string, (Topic & { tasks: StructureTask[] })[]>()
  for (const topic of topics ?? []) {
    const topicTasks = tasksByTopic.get(topic.id) ?? []

    if (options.dropTopicsWithoutTasks && topicTasks.length === 0) {
      continue
    }

    const list = topicsBySubject.get(topic.subject_id) ?? []
    list.push({ ...topic, tasks: topicTasks })
    topicsBySubject.set(topic.subject_id, list)
  }

  return {
    status: "SUCCESS",
    tree: {
      subjects: subjects
        .map((subject) => ({
          ...subject,
          topics: topicsBySubject.get(subject.id) ?? [],
        }))
        .filter((subject) => subject.topics.length > 0 || !options.dropTopicsWithoutTasks),
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

  for (const subject of subjects) {
    if (subject.id) keepSubjectIds.add(subject.id)
    for (const topic of subject.topics) {
      if (topic.id) keepTopicIds.add(topic.id)
    }
  }

  const { data: existingSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false)
    .not("name", "ilike", "others")
    .not("name", "ilike", "__deprecated_others__")

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
          .from("topics")
          .delete()
          .eq("id", topic.id)
          .eq("user_id", user.id)
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
          deadline: normalizeOptionalDate(subject.deadline),
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
          deadline: normalizeOptionalDate(subject.deadline),
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

      void topicId
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

  const { data: settingsRow } = await supabase
    .from("planner_settings")
    .select("exam_date")
    .eq("user_id", user.id)
    .maybeSingle()

  const globalExamDate = normalizeOptionalDate(settingsRow?.exam_date)

  const { data, error } = await supabase
    .from("topics")
    .select(
      "id, subject_id, estimated_hours, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency"
    )
    .eq("user_id", user.id)
    .eq("archived", false)

  if (error) return { status: "SUCCESS", params: [] }

  const topicRows = (data ?? []) as Array<{
    id: string
    subject_id: string
    estimated_hours: number | null
    deadline: string | null
    earliest_start: string | null
    depends_on: string[] | null
    session_length_minutes: number | null
    rest_after_days: number | null
    max_sessions_per_day: number | null
    study_frequency: string | null
  }>

  const subjectIds = [...new Set(topicRows.map((row) => row.subject_id))]
  const subjectDeadlineMap = new Map<string, string>()

  if (subjectIds.length > 0) {
    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("id, deadline")
      .eq("user_id", user.id)
      .eq("archived", false)
      .in("id", subjectIds)

    for (const row of (subjectRows ?? []) as Array<{ id: string; deadline: string | null }>) {
      const deadline = normalizeOptionalDate(row.deadline)
      if (deadline) {
        subjectDeadlineMap.set(row.id, deadline)
      }
    }
  }

  const inheritedTopicIds: string[] = []
  const sanitizedDeadlineByTopic = new Map<string, string | null>()

  for (const row of topicRows) {
    const topicDeadline = normalizeOptionalDate(row.deadline)
    const subjectDeadline = subjectDeadlineMap.get(row.subject_id) ?? null
    const inheritedFromSubject = !!topicDeadline && !!subjectDeadline && topicDeadline === subjectDeadline
    const inheritedFromGlobal = !!topicDeadline && !!globalExamDate && topicDeadline === globalExamDate

    if (inheritedFromSubject || inheritedFromGlobal) {
      inheritedTopicIds.push(row.id)
      sanitizedDeadlineByTopic.set(row.id, null)
      continue
    }

    sanitizedDeadlineByTopic.set(row.id, topicDeadline)
  }

  if (inheritedTopicIds.length > 0) {
    const uniqueTopicIds = [...new Set(inheritedTopicIds)]
    await supabase
      .from("topics")
      .update({ deadline: null })
      .eq("user_id", user.id)
      .in("id", uniqueTopicIds)
  }

  return {
    status: "SUCCESS",
    params: topicRows.map((row) => ({
      topic_id: row.id,
      estimated_hours: row.estimated_hours ?? 0,
      deadline: sanitizedDeadlineByTopic.get(row.id) ?? null,
      earliest_start: row.earliest_start,
      depends_on: row.depends_on ?? [],
      session_length_minutes: inferSessionLengthMinutes([], row.session_length_minutes),
      rest_after_days: row.rest_after_days ?? 0,
      max_sessions_per_day: row.max_sessions_per_day ?? 0,
      study_frequency: row.study_frequency ?? "daily",
    })) as TopicParams[],
  }
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
    deadline: normalizeOptionalDate(param.deadline),
    earliest_start: normalizeOptionalDate(param.earliest_start),
    depends_on: [
      ...new Set(param.depends_on.filter((depId) => depId !== param.topic_id)),
    ],
    session_length_minutes: Math.trunc(param.session_length_minutes),
    rest_after_days: Math.max(0, param.rest_after_days ?? 0),
    max_sessions_per_day: Math.max(0, param.max_sessions_per_day ?? 0),
    study_frequency: normalizeStudyFrequency(param.study_frequency),
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
    .select("id, name, subject_id")
    .eq("user_id", user.id)
    .in("id", topicIds)

  if (topicError) return { status: "ERROR", message: topicError.message }

  const knownTopics = topicRows ?? []
  const knownTopicIds = new Set(knownTopics.map((topic) => topic.id))
  const knownTopicMap = new Map(knownTopics.map((topic) => [topic.id, topic]))
  const topicNameMap = new Map(knownTopics.map((topic) => [topic.id, topic.name]))

  const subjectIds = [...new Set(knownTopics.map((topic) => topic.subject_id))]
  let subjectRows: Array<{ id: string; name: string; deadline: string | null }> = []
  if (subjectIds.length > 0) {
    const { data, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name, deadline")
      .eq("user_id", user.id)
      .in("id", subjectIds)

    if (subjectError) return { status: "ERROR", message: subjectError.message }
    subjectRows = (data ?? []) as Array<{
      id: string
      name: string
      deadline: string | null
    }>
  }

  const subjectMap = new Map((subjectRows ?? []).map((subject) => [subject.id, subject]))

  for (const param of normalizedParams) {
    const topic = knownTopicMap.get(param.topic_id)
    if (!topic || !knownTopicIds.has(param.topic_id)) {
      return { status: "ERROR", message: "A selected topic could not be found." }
    }

    if (param.depends_on.some((depId) => !knownTopicIds.has(depId))) {
      return {
        status: "ERROR",
        message: "Dependencies must point to topics in the current plan.",
      }
    }

    const subject = subjectMap.get(topic.subject_id)
    if (!subject) {
      return {
        status: "ERROR",
        message: `Subject not found for topic "${topic.name}".`,
      }
    }

    const subjectDeadline = normalizeOptionalDate(subject.deadline)
    const topicStart = normalizeOptionalDate(param.earliest_start)
    const topicDeadline = normalizeOptionalDate(param.deadline)

    const topicDateWindowError = validateDateWindow(
      topicStart,
      topicDeadline,
      `Chapter "${topic.name}" start date`,
      "its deadline"
    )
    if (topicDateWindowError) {
      return {
        status: "ERROR",
        message: topicDateWindowError,
      }
    }

    if (subjectDeadline && topicDeadline && topicDeadline > subjectDeadline) {
      return {
        status: "ERROR",
        message: `Chapter "${topic.name}" deadline cannot be after subject "${subject.name}" deadline.`,
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
      .from("topics")
      .update({
        estimated_hours: param.estimated_hours,
        deadline: param.deadline,
        earliest_start: param.earliest_start,
        depends_on: param.depends_on,
        session_length_minutes: param.session_length_minutes,
        rest_after_days: param.rest_after_days,
        max_sessions_per_day: param.max_sessions_per_day,
        study_frequency: param.study_frequency,
      })
      .eq("id", param.topic_id)
      .eq("user_id", user.id)

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

  type PlannerSettingsRow = {
    id: string
    user_id: string
    study_start_date: string
    exam_date: string
    weekday_capacity_minutes: number
    weekend_capacity_minutes: number
    max_active_subjects: number
    day_of_week_capacity?: (number | null)[] | null
    custom_day_capacity?: Record<string, number> | null
    flexibility_minutes?: number
    intake_import_mode?: IntakeImportMode | null
  }

  const primarySelect =
    "id, user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, max_active_subjects, day_of_week_capacity, custom_day_capacity, flexibility_minutes, intake_import_mode"
  const legacySelect =
    "id, user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, max_active_subjects, day_of_week_capacity, custom_day_capacity, flexibility_minutes"

  const { data: primaryData, error: primaryError } = await supabase
    .from("planner_settings")
    .select(primarySelect)
    .eq("user_id", user.id)
    .maybeSingle()

  let data: PlannerSettingsRow | null = primaryData as PlannerSettingsRow | null

  if (primaryError) {
    // Backward-compatible retry when intake_import_mode column is not yet available.
    if (/intake_import_mode/i.test(primaryError.message)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("planner_settings")
        .select(legacySelect)
        .eq("user_id", user.id)
        .maybeSingle()

      if (legacyError) {
        return { status: "ERROR", message: legacyError.message }
      }

      data = legacyData as PlannerSettingsRow | null
    } else {
      return { status: "ERROR", message: primaryError.message }
    }
  }

  if (!data) return { status: "SUCCESS", config: null }

  const todayISO = getTodayLocalDate()

  let normalizedStudyStart = normalizeLocalDate(data.study_start_date) ?? todayISO
  let normalizedExamDate = normalizeLocalDate(data.exam_date)

  if (normalizedStudyStart < todayISO) {
    normalizedStudyStart = todayISO
  }

  if (!normalizedExamDate || normalizedExamDate <= normalizedStudyStart) {
    normalizedExamDate = addDaysIsoDate(normalizedStudyStart, 90)
  }

  if (
    normalizedStudyStart !== data.study_start_date ||
    normalizedExamDate !== data.exam_date
  ) {
    await supabase
      .from("planner_settings")
      .update({
        study_start_date: normalizedStudyStart,
        exam_date: normalizedExamDate,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
  }

  return {
    status: "SUCCESS",
    config: {
      ...(data as PlanConfig),
      study_start_date: normalizedStudyStart,
      exam_date: normalizedExamDate,
      plan_order: "balanced",
      final_revision_days: 0,
      buffer_percentage: 0,
      plan_order_stack: null,
      max_topics_per_subject_per_day: 1,
      min_subject_gap_days: 0,
      subject_ordering: null,
      flexible_threshold: null,
      intake_import_mode: normalizeIntakeImportMode(data.intake_import_mode),
    },
  }
}

export async function getIntakeImportMode(): Promise<GetIntakeImportModeResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "UNAUTHORIZED" }

  const { data, error } = await supabase
    .from("planner_settings")
    .select("intake_import_mode")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  return {
    status: "SUCCESS",
    mode: normalizeIntakeImportMode(data?.intake_import_mode),
  }
}

export async function saveIntakeImportMode(
  mode: IntakeImportMode
): Promise<SaveIntakeImportModeResponse> {
  const normalizedMode = normalizeIntakeImportMode(mode)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "UNAUTHORIZED" }

  const { data: existingSettings, error: existingError } = await supabase
    .from("planner_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingError) {
    return { status: "ERROR", message: existingError.message }
  }

  if (existingSettings?.id) {
    const { error: updateError } = await supabase
      .from("planner_settings")
      .update({
        intake_import_mode: normalizedMode,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    if (updateError) {
      return { status: "ERROR", message: updateError.message }
    }
  } else {
    const studyStart = todayIsoDate()
    const examDate = addDaysIsoDate(studyStart, 90)

    const { error: insertError } = await supabase
      .from("planner_settings")
      .insert({
        user_id: user.id,
        study_start_date: studyStart,
        exam_date: examDate,
        weekday_capacity_minutes: 180,
        weekend_capacity_minutes: 240,
        max_active_subjects: 0,
        day_of_week_capacity: [null, null, null, null, null, null, null],
        custom_day_capacity: {},
        flexibility_minutes: 0,
        intake_import_mode: normalizedMode,
      })

    if (insertError) {
      return { status: "ERROR", message: insertError.message }
    }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
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
  if (!isISODate(config.study_start_date) || !isISODate(config.exam_date)) {
    return {
      status: "ERROR",
      message: "Start date and exam date must be valid YYYY-MM-DD dates.",
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

  const { data: existingSettings } = await supabase
    .from("planner_settings")
    .select("exam_date")
    .eq("user_id", user.id)
    .maybeSingle()

  const previousExamDate = existingSettings?.exam_date ?? null

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    max_active_subjects: Math.max(0, config.max_active_subjects ?? 0),
    day_of_week_capacity:
      config.day_of_week_capacity ?? [null, null, null, null, null, null, null],
    custom_day_capacity: config.custom_day_capacity ?? {},
    flexibility_minutes: Math.max(0, config.flexibility_minutes ?? 0),
    updated_at: new Date().toISOString(),
  }

  console.log("Saving Step-2:", upsertData)

  const { error } = await supabase
    .from("planner_settings")
    .upsert(upsertData, { onConflict: "user_id" })

  if (error) {
    console.log("DB response:", { status: "ERROR", message: error.message })
    return { status: "ERROR", message: error.message }
  }

  console.log("DB response:", { status: "SUCCESS" })

  // Topic deadlines matching the previous global deadline are treated as inherited.
  // Clear them so topics continue inheriting from the latest global deadline.
  if (
    previousExamDate &&
    previousExamDate !== config.exam_date
  ) {
    await supabase
      .from("topics")
      .update({ deadline: null })
      .eq("user_id", user.id)
      .eq("deadline", previousExamDate)
  }

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

  let subjectRows: Array<{
    id: string
    name: string
    deadline: string | null
  }> = []
  if (subjectIds.length > 0) {
    const { data } = await supabase
      .from("subjects")
      .select("id, name, deadline")
      .eq("user_id", user.id)
      .eq("archived", false)
      .in("id", subjectIds)

    subjectRows = (data ?? []) as Array<{
      id: string
      name: string
      deadline: string | null
    }>
  }

  const paramMap = new Map(activeParams.map((param) => [param.topic_id, param]))
  const subjectMap = new Map(subjectRows.map((subject) => [subject.id, subject]))

  const units: PlannableUnit[] = topics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    const subject = subjectMap.get(topic.subject_id)
    if (!param || !subject || param.estimated_hours <= 0) {
      return []
    }

    const topicDeadline = normalizeOptionalDate(param.deadline)
    const topicStart = normalizeOptionalDate(param.earliest_start)

    return [
      {
        id: topic.id,
        subject_id: topic.subject_id,
        subject_name: subject?.name ?? "Unknown",
        topic_name: topic.name,
        estimated_minutes: Math.round(param.estimated_hours * 60),
        session_length_minutes: param.session_length_minutes,
        deadline: topicDeadline || normalizeOptionalDate(subject?.deadline) || config.exam_date,
        earliest_start: topicStart || undefined,
        depends_on: param.depends_on,
        rest_after_days: param.rest_after_days ?? 0,
        max_sessions_per_day: param.max_sessions_per_day,
        study_frequency:
          param.study_frequency === "spaced" ? "spaced" : "daily",
      },
    ]
  })

  const offDays = new Set<string>()

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

