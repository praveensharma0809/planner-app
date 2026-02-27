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
  created_at: string
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
