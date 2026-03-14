// ── Topic ordering mode (per subject) ────────────────────────────────────────
export type TopicOrderingMode =
  | "sequential"          // Topic N must be 100% done before Topic N+1
  | "flexible_sequential" // Next topic unlocks when previous reaches threshold %
  | "parallel"            // All topics in subject can be studied simultaneously

// ── Study frequency hint (per topic) ─────────────────────────────────────────
export type StudyFrequency = "daily" | "spaced"

// ── Plan ordering criteria (used in priority stack) ──────────────────────────
export type PlanOrderCriterion =
  | "urgency"        // dynamic: remaining sessions ÷ days left
  | "priority"       // High > Med > Low
  | "deadline"       // soonest deadline first
  | "subject_order"  // Phase 1 entry order
  | "effort"         // most remaining work first
  | "completion"     // closest to done first (momentum)

export interface PlannableUnit {
  id: string
  subject_id: string
  subject_name: string
  topic_name: string
  estimated_minutes: number
  /** How long a single study session for this topic is, in minutes (min 15) */
  session_length_minutes: number
  /** Legacy field kept for DB/task compatibility. Scheduler now uses neutral priority. */
  priority: number
  deadline: string
  earliest_start?: string
  depends_on: string[]
  /** Days to rest after completing this topic before starting the next in the same subject. Default: 0 */
  rest_after_days?: number
  /** Max sessions of this topic that can be placed on a single day. 0 = no limit */
  max_sessions_per_day?: number
  /** Scheduling frequency hint. Default: "daily" */
  study_frequency?: StudyFrequency
  /** @deprecated Tier-based scheduling is retired. Kept only for backward compatibility. */
  tier?: number
}

export interface ReservedSlot {
  date: string
  minutes: number
}

export interface GlobalConstraints {
  study_start_date: string
  /** Global deadline (replaces exam_date). When everything must be done by. */
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  /**
   * Per-day-of-week overrides in minutes. Index 0 = Sunday, 6 = Saturday.
   * null/undefined entries fall back to weekday/weekend defaults.
   */
  day_of_week_capacity?: (number | null)[]
  /**
   * Custom capacity overrides for specific dates.
   * Key = ISO date string "YYYY-MM-DD", value = capacity in minutes.
   */
  custom_day_capacity?: Record<string, number>
  /**
   * Ordered list of criteria for sorting subjects during scheduling.
   * Applied top-to-bottom as multi-level tie-breakers.
   * Falls back to ["urgency", "priority", "deadline"] if empty.
   */
  plan_order_stack?: PlanOrderCriterion[]
  /**
   * @deprecated Use plan_order_stack instead. Kept for backward compatibility.
   * If plan_order_stack is provided, this is ignored.
   */
  plan_order: "priority" | "deadline" | "subject" | "balanced"
  /** @deprecated Use flexibility_minutes instead. Kept for backward compatibility. */
  final_revision_days: number
  /** @deprecated Use flexibility_minutes instead. */
  buffer_percentage: number
  /**
   * Maximum extra minutes the scheduler may add to any single day's base
   * capacity when the plan doesn't fit at base. Default: 0 (no flex).
   */
  flexibility_minutes?: number
  /**
   * Absolute maximum study minutes per day. Overrides everything including flex.
   * Default: 480 (8 hours).
   */
  max_daily_minutes?: number
  /**
   * Maximum number of subjects active per day. 0 = no limit.
   * Subjects with deadline within 7 days are always included regardless of this limit.
   */
  max_active_subjects: number
  /**
   * Max topics from a single subject that can be studied on one day.
    * Only relevant for parallel / flexible_sequential modes.
   * Default: 1.
   */
  max_topics_per_subject_per_day?: number
  /**
   * @deprecated User-configurable subject gap is retired.
   * Internal anti-overwhelm heuristics decide this automatically.
   */
  min_subject_gap_days?: number
  /**
   * Topic ordering mode per subject. Key = subject_id, value = mode.
   * Subjects not in the map default to "sequential".
   */
  subject_ordering?: Record<string, TopicOrderingMode>
  /**
   * @deprecated User-configurable flexible threshold is retired.
   * Scheduler derives an internal threshold from plan pressure.
   */
  flexible_threshold?: Record<string, number>
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
  /** True if this day's capacity was extended using flexibility allowance */
  is_flex_day?: boolean
  /** Extra minutes added to this day via flexibility */
  flex_extra_minutes?: number
  /** Topic completion % after this session (0.0 to 1.0) */
  topic_completion_after?: number
  /** True if this is the last session for this topic */
  is_topic_final_session?: boolean
  /** Local preview-only: pinned sessions stay fixed during re-optimization */
  is_pinned?: boolean
  /** Local preview-only: manually added sessions are preserved but not regenerated */
  is_manual?: boolean
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
  /** True if plan fits only when flexibility allowance is used */
  flexFeasible?: boolean
  totalSessionsNeeded: number
  totalSlotsAvailable: number
  /** Total available including flexibility allowance */
  totalFlexAvailable?: number
  globalGap: number
  units: UnitFeasibility[]
  suggestions: FeasibilitySuggestion[]
}

export interface DaySlot {
  date: string
  /** Base study minutes available on this day */
  capacity: number
  /** Maximum capacity including flexibility allowance */
  flexCapacity: number
  /** Minutes remaining to schedule on this day, decremented by the scheduler */
  remainingMinutes: number
  isWeekend: boolean
  /** Extra minutes used from flexibility on this day */
  flexUsed: number
}

export type PlanResult =
  | { status: "NO_UNITS" }
  | { status: "NO_DAYS" }
  | { status: "INFEASIBLE"; feasibility: FeasibilityResult }
  | { status: "PARTIAL"; schedule: ScheduledSession[]; feasibility: FeasibilityResult; droppedSessions: number }
  | { status: "READY"; schedule: ScheduledSession[]; feasibility: FeasibilityResult }
