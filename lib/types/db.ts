export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
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
  estimated_hours?: number
  deadline?: string | null
  earliest_start?: string | null
  depends_on?: string[]
  session_length_minutes?: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  subject_id: string | null
  topic_id: string | null
  title: string
  task_type: "subject" | "standalone"
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  session_number?: number
  total_sessions?: number
  sort_order?: number
  completed: boolean
  task_source: "manual" | "plan"
  plan_snapshot_id: string | null
  source_topic_task_id?: string | null
  created_at: string
}

export interface TopicTask {
  id: string
  user_id: string
  subject_id: string
  topic_id: string
  title: string
  duration_minutes: number
  completed: boolean
  sort_order: number
  created_at: string
  updated_at?: string
}

export interface PlanSnapshot {
  id: string
  user_id: string
  task_count: number
  schedule_json: unknown
  settings_snapshot: unknown
  summary: string | null
  created_at: string
}
