export interface Profile {
  id: string
  full_name: string | null
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
  total_items: number
  completed_items: number
  avg_duration_minutes: number
  deadline: string
  priority: number
  mandatory: boolean
  archived?: boolean
  urgency_score?: number
  health_state?: "stable" | "watch" | "at_risk" | "critical" | "overdue" | null
  remaining_minutes?: number
  estimated_completion_date?: string | null
  created_at: string
}

export interface SubjectWorkloadView {
  subject_id: string
  user_id: string
  subject_name: string
  deadline: string
  priority: number
  archived: boolean
  effective_total_items: number
  subtopic_count: number
  avg_duration_minutes: number
  total_hours_required: number
}

export interface Task {
  id: string
  user_id: string
  subject_id: string
  title: string
  scheduled_date: string
  duration_minutes: number
  priority: number
  completed: boolean
  is_plan_generated: boolean
  created_at: string
}

export interface OffDay {
  id: string
  user_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface Subtopic {
  id: string
  user_id: string
  subject_id: string
  name: string
  total_items: number
  completed_items: number
  sort_order: number
  created_at: string
}

export interface PlanEvent {
  id: string
  user_id: string
  event_type: "analyzed" | "committed" | "resolved_overload"
  task_count: number
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
