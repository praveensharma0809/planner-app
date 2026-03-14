import type {
  PlanOrderCriterion,
  StudyFrequency,
  TopicOrderingMode,
} from "./types"

export interface PlannerTopicForParams {
  id: string
  subject_name: string
  topic_name: string
}

export interface PlannerParamValues {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string
  earliest_start: string
  depends_on: string[]
  session_length_minutes: number
  rest_after_days: number
  max_sessions_per_day: number
  study_frequency: StudyFrequency
  tier: number
}

export interface PlannerConstraintValues {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: "priority" | "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  max_active_subjects: number
  day_of_week_capacity: (number | null)[]
  custom_day_capacity: Record<string, number>
  plan_order_stack: PlanOrderCriterion[]
  flexibility_minutes: number
  max_daily_minutes: number
  max_topics_per_subject_per_day: number
  min_subject_gap_days: number
  subject_ordering: Record<string, TopicOrderingMode>
  flexible_threshold: Record<string, number>
}

export interface PlannerSubjectOption {
  id: string
  name: string
  /** Optional: fallback deadline used for topics without an individual deadline */
  deadline?: string
  /** Topic ids in display order, used by StudyOrderPanel */
  topicIds?: string[]
  /** Topics with names, used by StudyOrderPanel for drag-drop UI */
  topics?: Array<{ id: string; name: string }>
}