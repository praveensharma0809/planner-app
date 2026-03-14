"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkFeasibility } from "@/lib/planner/feasibility"
import type {
  PlannerConstraintValues,
  PlannerParamValues,
} from "@/lib/planner/draftTypes"
import type {
  FeasibilityResult,
  GlobalConstraints,
  PlannableUnit,
} from "@/lib/planner/types"
import type { Subject, Topic } from "@/lib/types/db"

export type GetDraftFeasibilityResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; feasibility: FeasibilityResult }

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
    ((subjectRows ?? []) as Pick<Subject, "id" | "name">[]).map((subject) => [subject.id, subject.name])
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
          study_frequency: param.study_frequency === "spaced" ? "spaced" : "daily",
      },
    ]
  })

  const constraints: GlobalConstraints = {
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

  const offDays = new Set<string>((offDayRows ?? []).map((row) => row.date))

  return {
    status: "SUCCESS",
    feasibility: checkFeasibility(units, constraints, offDays),
  }
}