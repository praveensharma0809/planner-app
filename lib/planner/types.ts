export interface PlannableUnit {
  id: string
  subject_id: string
  subject_name: string
  topic_name: string
  estimated_minutes: number
  /** How long a single study session for this topic is, in minutes */
  session_length_minutes: number
  priority: number
  deadline: string
  earliest_start?: string
  depends_on: string[]
}

export interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  /** How to sort/order topics during plan generation */
  plan_order: "priority" | "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  /**
   * Maximum number of subjects active per day. 0 = no limit.
   * Subjects with deadline within 7 days are always included regardless of this limit.
   */
  max_active_subjects: number
}

export interface PlanInput {
  units: PlannableUnit[]
  constraints: GlobalConstraints
  offDays: Set<string>
}

export interface ScheduledSession {
  subject_id: string
  topic_id: string
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number
  total_sessions: number
}

export type UnitFeasibilityStatus = "safe" | "tight" | "at_risk" | "impossible"

export interface UnitFeasibility {
  unitId: string
  name: string
  deadline: string
  /** Number of sessions needed to fully cover this topic */
  totalSessions: number
  /** Total study minutes available within this unit's date window */
  availableMinutes: number
  status: UnitFeasibilityStatus
  suggestions: FeasibilitySuggestion[]
}

export interface FeasibilitySuggestion {
  kind: "increase_capacity" | "extend_deadline" | "reduce_effort" | "remove_dependency"
  message: string
  value?: number
}

export interface FeasibilityResult {
  feasible: boolean
  totalSessionsNeeded: number
  totalSlotsAvailable: number
  globalGap: number
  units: UnitFeasibility[]
  suggestions: FeasibilitySuggestion[]
}

export interface DaySlot {
  date: string
  /** Effective study minutes available on this day (after buffer) */
  capacity: number
  /** Minutes remaining to schedule on this day, decremented by the scheduler */
  remainingMinutes: number
  isWeekend: boolean
}

export type PlanResult =
  | { status: "NO_UNITS" }
  | { status: "INFEASIBLE"; feasibility: FeasibilityResult }
  | { status: "READY"; schedule: ScheduledSession[]; feasibility: FeasibilityResult }
