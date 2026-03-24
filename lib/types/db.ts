export interface Profile {
  id: string
  full_name: string | null
  age?: number | null
  primary_exam: string | null
  qualification: string | null
  phone: string | null
  daily_available_minutes: number
  exam_date: string | null
  streak_current?: number
  streak_longest?: number
  streak_last_completed_date?: string | null
  created_at: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  sort_order: number
  archived: boolean
  deadline: string | null
  created_at: string
}

export interface Topic {
  id: string
  user_id: string
  subject_id: string
  name: string
  sort_order: number
  archived: boolean
  created_at: string
}

export interface Subtopic {
  id: string
  user_id: string
  topic_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface TopicParams {
  id: string
  user_id: string
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  revision_sessions: number
  practice_sessions: number
  session_length_minutes: number
  /** Days to rest after completing this topic before starting the next. Default: 0 */
  rest_after_days?: number
  /** Max sessions of this topic per day. 0 = no limit. Default: 0 */
  max_sessions_per_day?: number
  /** Scheduling frequency hint. Active runtime values: "daily" | "spaced". Legacy "dense" may still exist in stored rows. */
  study_frequency?: string
  /** Legacy compatibility field. Tier is no longer used by active planner runtime ordering. */
  tier?: number
  created_at: string
  updated_at: string
}

export interface PlanConfig {
  id: string
  user_id: string
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: string
  final_revision_days: number
  /** Legacy compatibility field retained in DB; planner runtime no longer scales capacity by this value. */
  buffer_percentage: number
  max_active_subjects: number
  /** Per-day-of-week capacity overrides (JSON array, index 0=Sun..6=Sat). Null entries fall back to defaults. */
  day_of_week_capacity?: (number | null)[] | null
  /** Custom capacity for specific dates (JSON object: { "YYYY-MM-DD": minutes }). */
  custom_day_capacity?: Record<string, number> | null
  /** Ordered criteria for sorting subjects. JSON array of PlanOrderCriterion values. */
  plan_order_stack?: string[] | null
  /** Extra minutes the scheduler may add to any day's base capacity. Default: 0 */
  flexibility_minutes?: number
  /** Absolute max study minutes per day. Default: 480 */
  max_daily_minutes?: number
  /** Max topics from one subject per day. Default: 1 */
  max_topics_per_subject_per_day?: number
  /** Legacy compatibility field. Active planner uses internal gap heuristics. */
  min_subject_gap_days?: number
  /** Topic ordering mode per subject (JSON object: { subject_id: mode }). */
  subject_ordering?: Record<string, string> | null
  /** Legacy compatibility field. Flexible unlock threshold is now adaptive and internal. */
  flexible_threshold?: Record<string, number> | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  subject_id: string
  topic_id: string | null
  subtopic_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number
  total_sessions: number
  sort_order: number
  completed: boolean
  is_plan_generated: boolean
  plan_version: string | null
  created_at: string
}

export interface OffDay {
  id: string
  user_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface PlanSnapshot {
  id: string
  user_id: string
  task_count: number
  schedule_json: unknown
  config_snapshot: unknown
  summary: string | null
  created_at: string
}
