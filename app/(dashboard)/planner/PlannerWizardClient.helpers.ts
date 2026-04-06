import { getStructure } from "@/app/actions/planner/setup"
import {
  inferSessionLengthMinutes,
  type PlannerConstraintValues as ConstraintValues,
  type PlannerParamValues as ParamValues,
} from "@/lib/planner/draft"
import type { TopicOrderingMode } from "@/lib/planner/engine"
import { normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

export type StructureResponse = Awaited<ReturnType<typeof getStructure>>
export type StructureSubject = Extract<StructureResponse, { status: "SUCCESS" }>["tree"]["subjects"][number]

function mapSubjectOrdering(
  raw: Record<string, string> | null | undefined
): Record<string, TopicOrderingMode> {
  if (!raw) return {}

  const mapped: Record<string, TopicOrderingMode> = {}
  for (const [subjectId, mode] of Object.entries(raw)) {
    if (
      mode === "sequential"
      || mode === "flexible_sequential"
      || mode === "parallel"
    ) {
      mapped[subjectId] = mode
    }
  }

  return mapped
}

function mapDbToParamValues(param: {
  topic_id: string
  estimated_hours: number
  deadline?: string | null
  earliest_start?: string | null
  depends_on?: string[] | null
  session_length_minutes?: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
}): ParamValues {
  return {
    topic_id: param.topic_id,
    estimated_hours: param.estimated_hours,
    deadline: param.deadline ?? "",
    earliest_start: param.earliest_start ?? "",
    depends_on: param.depends_on ?? [],
    session_length_minutes: inferSessionLengthMinutes([], param.session_length_minutes),
    rest_after_days: param.rest_after_days ?? 0,
    max_sessions_per_day: param.max_sessions_per_day ?? 0,
    study_frequency: param.study_frequency === "spaced" ? "spaced" : "daily",
  }
}

export function mapDbParamsToMap(rows: Array<{
  topic_id: string
  estimated_hours: number
  deadline?: string | null
  earliest_start?: string | null
  depends_on?: string[] | null
  session_length_minutes?: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
}>): Map<string, ParamValues> {
  const map = new Map<string, ParamValues>()
  for (const row of rows) {
    map.set(row.topic_id, mapDbToParamValues(row))
  }
  return map
}

export function mapDbToConstraintValues(config: {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order?: string
  final_revision_days?: number
  buffer_percentage?: number
  max_active_subjects?: number
  day_of_week_capacity?: (number | null)[] | null
  custom_day_capacity?: Record<string, number> | null
  plan_order_stack?: string[] | null
  flexibility_minutes?: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
}): ConstraintValues {
  return {
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    plan_order: (config.plan_order as ConstraintValues["plan_order"]) ?? "balanced",
    final_revision_days: config.final_revision_days ?? 0,
    buffer_percentage: config.buffer_percentage ?? 0,
    max_active_subjects: config.max_active_subjects ?? 0,
    day_of_week_capacity:
      config.day_of_week_capacity ?? [null, null, null, null, null, null, null],
    custom_day_capacity: config.custom_day_capacity ?? {},
    plan_order_stack:
      (config.plan_order_stack as ConstraintValues["plan_order_stack"]) ?? ["urgency", "subject_order", "deadline"],
    flexibility_minutes: config.flexibility_minutes ?? 0,
    max_topics_per_subject_per_day: config.max_topics_per_subject_per_day ?? 1,
    min_subject_gap_days: config.min_subject_gap_days ?? 0,
    subject_ordering: mapSubjectOrdering(config.subject_ordering),
    flexible_threshold: config.flexible_threshold ?? {},
  }
}

function roundedHoursFromMinutes(totalMinutes: number): number {
  if (totalMinutes <= 0) return 1
  return Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10)
}

export function roundedHours(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0
  return Math.round((totalMinutes / 60) * 10) / 10
}

export function buildDeadlineMap(subjects: StructureSubject[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const subject of subjects) {
    if (subject.deadline) {
      map.set(subject.id, subject.deadline)
    }
  }
  return map
}

export function buildParamsFromStructure(
  subjects: StructureSubject[],
  existingMap: Map<string, ParamValues>,
  globalExamDate: string
): ParamValues[] {
  const values: ParamValues[] = []

  for (const subject of subjects) {
    const subjectDeadline = (subject.deadline ?? "").trim()

    for (const topic of subject.topics) {
      if (topic.archived) continue

      const current = existingMap.get(topic.id)
      const currentDeadline = (current?.deadline ?? "").trim()
      const resolvedDeadline =
        currentDeadline
        && currentDeadline !== globalExamDate
        && currentDeadline !== subjectDeadline
          ? currentDeadline
          : ""
      const taskMinutes = topic.tasks.reduce(
        (sum, task) => sum + Math.max(0, task.duration_minutes ?? 0),
        0
      )
      const taskDurations = topic.tasks.map((task) => Math.max(0, task.duration_minutes ?? 0))
      const derivedHours = roundedHoursFromMinutes(taskMinutes)
      const currentEstimatedHours = current?.estimated_hours ?? 0

      values.push({
        topic_id: topic.id,
        estimated_hours: currentEstimatedHours > 0 ? currentEstimatedHours : (derivedHours > 0 ? derivedHours : 1),
        deadline: resolvedDeadline,
        earliest_start: current?.earliest_start ?? "",
        depends_on: current?.depends_on ?? [],
        session_length_minutes: inferSessionLengthMinutes(
          taskDurations,
          current?.session_length_minutes
        ),
        rest_after_days: current?.rest_after_days ?? 0,
        max_sessions_per_day: current?.max_sessions_per_day ?? 0,
        study_frequency: current?.study_frequency === "spaced" ? "spaced" : "daily",
      })
    }
  }

  return values
}

export function addDaysISO(isoDate: string, days: number): string {
  const normalized = normalizeLocalDate(isoDate)
  if (!normalized) return isoDate

  const date = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate

  date.setDate(date.getDate() + days)
  return normalizeLocalDate(date) ?? normalized
}
