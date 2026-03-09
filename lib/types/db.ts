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
  created_at: string
}

export interface Topic {
  id: string
  user_id: string
  subject_id: string
  name: string
  sort_order: number
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
  buffer_percentage: number
  max_active_subjects: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  subject_id: string
  topic_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number | null
  total_sessions: number | null
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

export interface ExecutionCategory {
  id: string
  user_id: string
  month_start: string
  name: string
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ExecutionItem {
  id: string
  user_id: string
  category_id: string
  series_id: string
  month_start: string
  title: string
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ExecutionEntry {
  id: string
  user_id: string
  item_id: string
  entry_date: string
  completed: boolean
  created_at: string
  updated_at: string
}
