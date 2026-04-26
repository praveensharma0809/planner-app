import { normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

/**
 * Defines how topics within a subject are ordered during scheduling.
 *
 * - `"sequential"`: Topics must follow strict order; a new topic cannot start until the previous one is completed.
 * - `"flexible_sequential"`: Topics may overlap once a threshold percentage of the prior topic is done.
 * - `"parallel"`: All topics within the subject can be scheduled concurrently.
 */
export type TopicOrderingMode =
  | "sequential"
  | "flexible_sequential"
  | "parallel"

/**
 * Determines the cadence at which a topic's sessions are distributed.
 *
 * - `"daily"`: Sessions are placed on consecutive available days.
 * - `"spaced"`: Sessions are spread out with rest days between them.
 */
export type StudyFrequency = "daily" | "spaced"

/**
 * Criteria used to sort or prioritize units when building the plan stack.
 *
 * - `"urgency"`: Prioritize units based on how close they are to their deadline relative to their remaining work.
 * - `"deadline"`: Sort strictly by deadline date (earliest first).
 * - `"subject_order"`: Follow the user-defined subject ordering.
 * - `"effort"`: Prioritize units with more total estimated minutes.
 * - `"completion"`: Prioritize units that are closer to being fully scheduled.
 */
export type PlanOrderCriterion =
  | "urgency"
  | "deadline"
  | "subject_order"
  | "effort"
  | "completion"

/**
 * A single topic that needs to be scheduled in the plan.
 *
 * @param id - Unique identifier for this topic.
 * @param subject_id - ID of the subject this topic belongs to.
 * @param subject_name - Human-readable name of the subject.
 * @param topic_name - Human-readable name of the topic.
 * @param estimated_minutes - Total estimated time needed to complete this topic, in minutes.
 * @param session_length_minutes - Duration of each individual study session for this topic, in minutes.
 * @param deadline - ISO date string by which this topic must be completed.
 * @param earliest_start - ISO date string before which scheduling is not allowed (defaults to study_start_date).
 * @param depends_on - IDs of topics that must be completed before this topic can start.
 * @param rest_after_days - Number of rest days to enforce after this topic is completed before a new topic in the same subject can begin.
 * @param max_sessions_per_day - Maximum number of sessions this topic can have on a single day (0 or unset = unlimited).
 * @param study_frequency - Cadence for session distribution (`"daily"` or `"spaced"`).
 */
export interface PlannableUnit {
  id: string
  subject_id: string
  subject_name: string
  topic_name: string
  estimated_minutes: number
  session_length_minutes: number
  deadline: string
  earliest_start?: string
  depends_on: string[]
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: StudyFrequency
}

/**
 * A pre-allocated time block on a specific date that reduces available capacity.
 *
 * @param date - ISO date string for the reserved slot.
 * @param minutes - Number of minutes reserved on this date.
 */
export interface ReservedSlot {
  date: string
  minutes: number
}

/**
 * Global scheduling constraints that apply to the entire plan.
 *
 * @param study_start_date - ISO date when studying can begin.
 * @param exam_date - ISO date of the exam / final deadline.
 * @param weekday_capacity_minutes - Default study minutes available on a weekday.
 * @param weekend_capacity_minutes - Default study minutes available on a weekend day.
 * @param day_of_week_capacity - Per-day-of-week overrides for capacity (index 0 = Sunday); null entries fall back to weekday/weekend defaults.
 * @param custom_day_capacity - Per-date overrides for capacity (ISO date → minutes). Overrides all other capacity sources.
 * @param plan_order_stack - Ordered list of criteria for prioritising topics.
 * @param plan_order - High-level ordering mode: `"deadline"`, `"subject"`, or `"balanced"`.
 * @param final_revision_days - Number of days before the exam reserved for revision (no new core sessions).
 * @param buffer_percentage - Percentage of extra capacity to reserve as buffer (0–100).
 * @param flexibility_minutes - Additional overflow minutes allowed per day beyond base capacity.
 * @param max_active_subjects - Maximum number of different subjects that can be scheduled on a single day.
 * @param max_topics_per_subject_per_day - Maximum number of distinct topics within a subject per day (default 1).
 * @param min_subject_gap_days - Minimum number of calendar days between sessions of the same subject.
 * @param subject_ordering - Per-subject topic ordering mode (`"sequential"`, `"flexible_sequential"`, `"parallel"`).
 * @param flexible_threshold - Per-subject completion threshold (0–1) at which the next topic in flexible_sequential mode can start.
 */
export interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  day_of_week_capacity?: (number | null)[]
  custom_day_capacity?: Record<string, number>
  plan_order_stack?: PlanOrderCriterion[]
  plan_order: "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  flexibility_minutes?: number
  max_active_subjects: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, TopicOrderingMode>
  flexible_threshold?: Record<string, number>
}

/**
 * The complete input used to generate a study plan.
 *
 * @param units - All plannable topics to schedule.
 * @param constraints - Global constraints governing the plan.
 * @param offDays - Set of ISO date strings representing days when no studying can occur.
 */
export interface PlanInput {
  units: PlannableUnit[]
  constraints: GlobalConstraints
  offDays: Set<string>
}

/**
 * A single scheduled study session produced by the planning engine.
 *
 * @param subject_id - ID of the subject this session belongs to.
 * @param topic_id - ID of the topic this session covers.
 * @param title - Display title (typically the topic name).
 * @param scheduled_date - ISO date on which this session is scheduled.
 * @param duration_minutes - Length of this session in minutes.
 * @param session_type - Kind of session: `"core"`, `"revision"`, or `"practice"`.
 * @param session_number - 1-indexed sequence number of this session within its topic.
 * @param total_sessions - Total number of core sessions for this topic.
 * @param is_flex_day - Whether this session used overflow/flex minutes on its day.
 * @param flex_extra_minutes - Number of flex (overflow) minutes consumed by this session.
 * @param topic_completion_after - Fraction of the topic completed after this session (0–1).
 * @param is_topic_final_session - Whether this is the last session for its topic.
 * @param is_pinned - Whether the user has manually pinned this session to this date.
 * @param is_manual - Whether this session was manually created by the user.
 * @param source_topic_task_id - ID of the source task this session was generated from, if applicable.
 */
export interface ScheduledSession {
  subject_id: string
  topic_id: string
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  session_number: number
  total_sessions: number
  is_flex_day?: boolean
  flex_extra_minutes?: number
  topic_completion_after?: number
  is_topic_final_session?: boolean
  is_pinned?: boolean
  is_manual?: boolean
  source_topic_task_id?: string | null
}

/**
 * Feasibility classification for a single topic.
 *
 * - `"safe"`: Required minutes are ≤80% of available minutes.
 * - `"tight"`: Required minutes are 81–90% of available minutes.
 * - `"at_risk"`: Required minutes exceed 90% of available minutes.
 * - `"impossible"`: Required minutes exceed available minutes (or no capacity exists).
 */
export type UnitFeasibilityStatus = "safe" | "tight" | "at_risk" | "impossible"

/**
 * Feasibility assessment for a single topic.
 *
 * @param unitId - ID of the topic.
 * @param name - Human-readable topic name.
 * @param deadline - ISO deadline date for this topic.
 * @param totalSessions - Number of sessions needed.
 * @param availableMinutes - Total minutes available within the topic's time window.
 * @param status - Feasibility classification.
 * @param suggestions - Actionable suggestions to improve feasibility.
 */
export interface UnitFeasibility {
  unitId: string
  name: string
  deadline: string
  totalSessions: number
  availableMinutes: number
  status: UnitFeasibilityStatus
  suggestions: FeasibilitySuggestion[]
}

/**
 * A single actionable suggestion to improve feasibility.
 *
 * @param kind - Category of the suggestion: `"increase_capacity"`, `"extend_deadline"`, `"reduce_effort"`, or `"remove_dependency"`.
 * @param message - Human-readable description of the suggestion.
 * @param value - Numeric value associated with the suggestion (e.g., extra days or minutes).
 */
export interface FeasibilitySuggestion {
  kind: "increase_capacity" | "extend_deadline" | "reduce_effort" | "remove_dependency"
  message: string
  value?: number
}

/**
 * Complete feasibility check result for a set of topics and constraints.
 *
 * @param feasible - Whether all topics can fit within base capacity (no overflow).
 * @param flexFeasible - Whether all topics can fit only if flex/overflow minutes are used.
 * @param totalSessionsNeeded - Total minutes required across all topics.
 * @param totalSlotsAvailable - Total base minutes available across all days.
 * @param totalFlexAvailable - Total base + flex minutes available across all days.
 * @param globalGap - Shortfall in minutes: `totalSessionsNeeded - totalSlotsAvailable` (0 if no gap).
 * @param units - Per-topic feasibility assessments.
 * @param suggestions - Global suggestions to resolve infeasibility.
 */
export interface FeasibilityResult {
  feasible: boolean
  flexFeasible?: boolean
  totalSessionsNeeded: number
  totalSlotsAvailable: number
  totalFlexAvailable?: number
  globalGap: number
  units: UnitFeasibility[]
  suggestions: FeasibilitySuggestion[]
}

/**
 * Internal representation of a single study day with capacity tracking.
 *
 * @param date - ISO date string.
 * @param capacity - Base study minutes available on this day.
 * @param flexCapacity - Total study minutes including flex allowance.
 * @param remainingMinutes - Minutes still unallocated on this day.
 * @param isWeekend - Whether this day falls on a Saturday or Sunday.
 * @param flexUsed - Flex minutes already consumed on this day.
 */
export interface DaySlot {
  date: string
  capacity: number
  flexCapacity: number
  remainingMinutes: number
  isWeekend: boolean
  flexUsed: number
}

/**
 * Discriminated union representing the outcome of plan generation.
 *
 * - `{ status: "NO_UNITS" }`: No plannable topics were provided.
 * - `{ status: "NO_DAYS" }`: No available study days exist in the date window.
 * - `{ status: "INFEASIBLE"; feasibility }`: The plan cannot be completed with current constraints.
 * - `{ status: "PARTIAL"; schedule; feasibility; droppedSessions }`: Some sessions were scheduled but others could not be placed.
 * - `{ status: "READY"; schedule; feasibility }`: All sessions were successfully scheduled.
 */
export type PlanResult =
  | { status: "NO_UNITS" }
  | { status: "NO_DAYS" }
  | { status: "INFEASIBLE"; feasibility: FeasibilityResult }
  | {
      status: "PARTIAL"
      schedule: ScheduledSession[]
      feasibility: FeasibilityResult
      droppedSessions: number
    }
  | { status: "READY"; schedule: ScheduledSession[]; feasibility: FeasibilityResult }

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function toISO(date: Date): string {
  const normalized = normalizeLocalDate(date)
  return normalized ?? ""
}

function parseISODate(isoDate: string): Date {
  const normalized = normalizeLocalDate(isoDate)
  if (!normalized) return new Date(Number.NaN)

  const parts = normalized.split("-")
  if (parts.length !== 3) return new Date(Number.NaN)

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date(Number.NaN)
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + n)
  return next
}

/**
 * Constructs the list of available study days (slots) from constraints and off-days.
 *
 * Iterates from `study_start_date` to `exam_date - final_revision_days`, creating a
 * {@link DaySlot} for each valid calendar day that is not an off-day and has non-zero
 * capacity. Capacity is resolved in priority order:
 * 1. `custom_day_capacity` (per-date override)
 * 2. `day_of_week_capacity` (per-day-of-week override)
 * 3. Default `weekday_capacity_minutes` / `weekend_capacity_minutes`
 *
 * @param constraints - Global scheduling constraints containing date range and capacity settings.
 * @param offDays - Set of ISO date strings to exclude from the schedule.
 * @returns An array of {@link DaySlot} objects sorted by date.
 */
export function buildDaySlots(
  constraints: GlobalConstraints,
  offDays: Set<string>
): DaySlot[] {
  const start = parseISODate(constraints.study_start_date)
  const revisionDays = constraints.final_revision_days ?? 0
  const endDate = addDays(parseISODate(constraints.exam_date), -revisionDays)

  const flexMinutes = constraints.flexibility_minutes ?? 0

  const slots: DaySlot[] = []
  let cursor = new Date(start)

  while (cursor <= endDate) {
    const iso = toISO(cursor)
    if (!offDays.has(iso)) {
      const weekend = isWeekend(cursor)
      const dayOfWeek = cursor.getDay()

      let rawCapacity: number
      if (constraints.custom_day_capacity && iso in constraints.custom_day_capacity) {
        rawCapacity = constraints.custom_day_capacity[iso]
      } else if (
        constraints.day_of_week_capacity &&
        constraints.day_of_week_capacity[dayOfWeek] != null
      ) {
        rawCapacity = constraints.day_of_week_capacity[dayOfWeek]!
      } else {
        rawCapacity = weekend
          ? constraints.weekend_capacity_minutes
          : constraints.weekday_capacity_minutes
      }

      const normalizedRawCapacity = Math.max(0, rawCapacity)
      const isZeroCapacityDay = normalizedRawCapacity === 0
      const baseCapacity = isZeroCapacityDay ? 0 : normalizedRawCapacity
      const flexCap = isZeroCapacityDay
        ? 0
        : baseCapacity + flexMinutes

      if (baseCapacity > 0 || flexCap > 0) {
        slots.push({
          date: iso,
          capacity: baseCapacity,
          flexCapacity: flexCap,
          remainingMinutes: baseCapacity,
          isWeekend: weekend,
          flexUsed: 0,
        })
      }
    }

    cursor = addDays(cursor, 1)
  }

  return slots
}

function classifyUnit(
  minutesNeeded: number,
  minutesAvailable: number
): UnitFeasibilityStatus {
  if (minutesAvailable <= 0 || minutesNeeded > minutesAvailable) return "impossible"
  const ratio = minutesNeeded / minutesAvailable
  if (ratio <= 0.8) return "safe"
  if (ratio <= 0.9) return "tight"
  return "at_risk"
}

function buildUnitSuggestions(
  unit: PlannableUnit,
  minutesNeeded: number,
  minutesAvailable: number,
  avgDailyCapacity: number
): FeasibilitySuggestion[] {
  const suggestions: FeasibilitySuggestion[] = []
  const minuteGap = minutesNeeded - minutesAvailable
  if (minuteGap <= 0) return suggestions

  if (avgDailyCapacity > 0) {
    const extraDays = Math.ceil(minuteGap / avgDailyCapacity)
    suggestions.push({
      kind: "extend_deadline",
      message: `Extend deadline for "${unit.topic_name}" by ${extraDays} day(s)`,
      value: extraDays,
    })
  }

  const reduceHours = Math.ceil(minuteGap / 60)
  suggestions.push({
    kind: "reduce_effort",
    message: `Reduce effort for "${unit.topic_name}" by ${reduceHours} hour(s)`,
    value: reduceHours,
  })

  return suggestions
}

/**
 * Checks whether all topics can fit within the available schedule capacity.
 *
 * For each topic, calculates the number of sessions needed and the total minutes
 * required, then compares against the total available minutes in the topic's time
 * window (from `earliest_start` or `study_start_date` to `deadline`). Also
 * computes a global gap and generates both per-topic and global suggestions for
 * resolving infeasibility.
 *
 * @param units - All plannable topics to assess.
 * @param constraints - Global scheduling constraints.
 * @param offDays - Set of ISO date strings to exclude.
 * @returns A {@link FeasibilityResult} with per-topic status and global metrics.
 */
export function checkFeasibility(
  units: PlannableUnit[],
  constraints: GlobalConstraints,
  offDays: Set<string>
): FeasibilityResult {
  const daySlots = buildDaySlots(constraints, offDays)
  const totalBaseAvailable = daySlots.reduce((sum, day) => sum + day.capacity, 0)
  const totalFlexAvailable = daySlots.reduce((sum, day) => sum + day.flexCapacity, 0)

  let totalMinutesNeeded = 0
  const unitResults: UnitFeasibility[] = []

  for (const unit of units) {
    if (unit.estimated_minutes <= 0) continue

    const sessionsNeeded = Math.ceil(
      unit.estimated_minutes / unit.session_length_minutes
    )
    const minutesNeeded = sessionsNeeded * unit.session_length_minutes
    totalMinutesNeeded += minutesNeeded

    const unitStart = unit.earliest_start ?? constraints.study_start_date
    const unitEnd = unit.deadline
    let availableMinutes = 0
    for (const slot of daySlots) {
      if (slot.date >= unitStart && slot.date <= unitEnd) {
        availableMinutes += slot.capacity
      }
    }

    const status = classifyUnit(minutesNeeded, availableMinutes)
    const avgDailyCapacity =
      daySlots.length > 0 ? totalBaseAvailable / daySlots.length : 0

    unitResults.push({
      unitId: unit.id,
      name: unit.topic_name,
      deadline: unitEnd,
      totalSessions: sessionsNeeded,
      availableMinutes,
      status,
      suggestions: buildUnitSuggestions(
        unit,
        minutesNeeded,
        availableMinutes,
        avgDailyCapacity
      ),
    })
  }

  const globalGap = Math.max(0, totalMinutesNeeded - totalBaseAvailable)
  const feasible =
    globalGap === 0 && unitResults.every((unit) => unit.status !== "impossible")
  const flexFeasible =
    !feasible &&
    totalMinutesNeeded <= totalFlexAvailable &&
    unitResults.every((unit) => unit.status !== "impossible")

  const suggestions: FeasibilitySuggestion[] = []
  if (globalGap > 0) {
    const activeDays = daySlots.length || 1
    const extraMinutesPerDay = Math.ceil(globalGap / activeDays)
    suggestions.push({
      kind: "increase_capacity",
      message: `Increase daily study time by ${extraMinutesPerDay} minutes`,
      value: extraMinutesPerDay,
    })

    const avgDailyCapacity = totalBaseAvailable / activeDays
    if (avgDailyCapacity > 0) {
      const extraDays = Math.ceil(globalGap / avgDailyCapacity)
      suggestions.push({
        kind: "extend_deadline",
        message: `Extend deadline by ${extraDays} day(s)`,
        value: extraDays,
      })
    }

    const reduceHours = Math.ceil(globalGap / 60)
    suggestions.push({
      kind: "reduce_effort",
      message: `Reduce total effort by ${reduceHours} hour(s)`,
      value: reduceHours,
    })
  }

  return {
    feasible,
    flexFeasible: flexFeasible || undefined,
    totalSessionsNeeded: totalMinutesNeeded,
    totalSlotsAvailable: totalBaseAvailable,
    totalFlexAvailable,
    globalGap,
    units: unitResults,
    suggestions,
  }
}

interface UnitState {
  unit: PlannableUnit
  coreSessions: number
  coreRemaining: number
  scheduled: number
  depsComplete: boolean
  completedDate?: string
  sessionsOnDay: Map<string, number>
}

const MS_PER_DAY = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.floor((parseISODate(to).getTime() - parseISODate(from).getTime()) / MS_PER_DAY)
}

function addDaysISO(date: string, days: number): string {
  const next = parseISODate(date)
  next.setDate(next.getDate() + days)
  return toISO(next)
}

function detectCircularDeps(units: PlannableUnit[]): boolean {
  const ids = new Set(units.map((unit) => unit.id))
  const visited = new Set<string>()
  const stack = new Set<string>()
  const depMap = new Map<string, string[]>()

  for (const unit of units) {
    depMap.set(unit.id, unit.depends_on.filter((depId) => ids.has(depId)))
  }

  function dfs(id: string): boolean {
    if (stack.has(id)) return true
    if (visited.has(id)) return false

    visited.add(id)
    stack.add(id)

    for (const depId of depMap.get(id) ?? []) {
      if (dfs(depId)) return true
    }

    stack.delete(id)
    return false
  }

  for (const unit of units) {
    if (dfs(unit.id)) return true
  }

  return false
}

function computeInternalSubjectGapDays(
  _loadRatio: number,
  configuredGapDays?: number
): number {
  const explicitGap = Math.max(0, configuredGapDays ?? 0)
  return explicitGap
}

function slotAvailable(day: DaySlot): number {
  return (
    day.remainingMinutes + (day.flexCapacity - day.capacity) - day.flexUsed
  )
}

function bookMinutes(
  day: DaySlot,
  minutes: number
): { isFlexDay: boolean; flexExtra: number } {
  if (day.remainingMinutes >= minutes) {
    day.remainingMinutes -= minutes
    return { isFlexDay: false, flexExtra: 0 }
  }

  const basePart = day.remainingMinutes
  const flexPart = minutes - basePart
  day.remainingMinutes = 0
  day.flexUsed += flexPart
  return { isFlexDay: true, flexExtra: flexPart }
}

function getActiveTopicsForSubject(
  subjectId: string,
  date: string,
  subjectTopics: Map<string, UnitState[]>,
  constraints: GlobalConstraints,
  oversizedIds: Set<string>,
  subjectNewTopicBlockedUntil: Map<string, string>,
  relaxDeadline: boolean
): UnitState[] {
  const topics = subjectTopics.get(subjectId) ?? []

  function eligible(state: UnitState): boolean {
    if (state.coreRemaining <= 0) return false
    if (oversizedIds.has(state.unit.id)) return false
    if (!state.depsComplete) return false

    const blockDate = subjectNewTopicBlockedUntil.get(subjectId)
    if (blockDate && date < blockDate && state.scheduled === 0) return false

    const start = state.unit.earliest_start ?? constraints.study_start_date
    if (date < start) return false
    if (!relaxDeadline && date > state.unit.deadline) return false
    return true
  }

  for (const state of topics) {
    if (state.coreRemaining <= 0) continue
    if (oversizedIds.has(state.unit.id)) continue
    if (!state.depsComplete) return []
    if (!eligible(state)) return []
    return [state]
  }

  return []
}

/**
 * Core scheduling algorithm that assigns topic sessions to available study days.
 *
 * **Algorithm overview:**
 *
 * 1. **Input normalization** — Deduplicates units, filters self-referencing and
 *    unresolvable dependencies, and enforces a minimum session length of 1 minute.
 *    If circular dependencies are detected, scheduling is aborted.
 *
 * 2. **Day slot construction** — Builds available study days from constraints
 *    (see {@link buildDaySlots}). If reserved slots are present, their minutes are
 *    subtracted from the corresponding days' capacities.
 *
 * 3. **State initialization** — Creates internal {@link UnitState} records tracking
 *    remaining sessions, dependency completion, and per-day session counts.
 *    Topics with session lengths exceeding the maximum day capacity are marked as
 *    oversized and skipped.
 *
 * 4. **Capacity scaling** — When total required minutes exceed base capacity and no
 *    explicit `flexibility_minutes` is configured, base capacities are scaled
 *    proportionally up to the flex capacity of each day.
 *
 * 5. **Day-by-day placement** — For each study day in chronological order:
 *    - Dependencies are refreshed (topics whose dependencies have been completed
 *      become eligible).
 *    - In-progress topics (previously started but not yet finished) are placed
 *      first, respecting per-subject gap constraints and per-day limits on
 *      topics per subject and minutes per subject.
 *    - New topics are then placed iteratively until the day is full or no more
 *      eligible topics remain.
 *
 * 6. **Overflow pass** — Any remaining sessions for topics whose predecessor
 *    within the same subject has been completed are placed on any day with
 *    available capacity, respecting deadline and start constraints.
 *
 * 7. **Result sorting** — Sessions are sorted by date, then by subject order.
 *
 * @param units - Plannable topics to schedule.
 * @param constraints - Global scheduling constraints.
 * @param offDays - Set of ISO date strings to exclude.
 * @param reservedSlots - Optional pre-allocated time slots that reduce capacity.
 * @returns An array of {@link ScheduledSession} objects, or an empty array if
 *          scheduling could not be completed (e.g., circular dependencies).
 */
export function schedule(
  units: PlannableUnit[],
  constraints: GlobalConstraints,
  offDays: Set<string>,
  reservedSlots: ReservedSlot[] = []
): ScheduledSession[] {
  if (units.length === 0) return []

  const knownIds = new Set(units.map((unit) => unit.id))
  const seenIds = new Set<string>()
  const cleanUnits: PlannableUnit[] = []
  for (const unit of units) {
    if (seenIds.has(unit.id)) continue
    seenIds.add(unit.id)
    cleanUnits.push({
      ...unit,
      depends_on: unit.depends_on.filter(
        (depId) => knownIds.has(depId) && depId !== unit.id
      ),
      session_length_minutes: Math.max(1, unit.session_length_minutes),
    })
  }

  if (cleanUnits.length === 0) return []
  if (detectCircularDeps(cleanUnits)) return []

  const daySlots = buildDaySlots(constraints, offDays)
  if (daySlots.length === 0) return []

  if (reservedSlots.length > 0) {
    const reservedByDate = new Map<string, number>()
    for (const slot of reservedSlots) {
      if (slot.minutes <= 0) continue
      reservedByDate.set(
        slot.date,
        (reservedByDate.get(slot.date) ?? 0) + slot.minutes
      )
    }

    for (const day of daySlots) {
      const reservedMinutes = reservedByDate.get(day.date) ?? 0
      if (reservedMinutes <= 0) continue
      day.capacity = Math.max(0, day.capacity - reservedMinutes)
      day.flexCapacity = Math.max(0, day.flexCapacity - reservedMinutes)
      day.remainingMinutes = day.capacity
      day.flexUsed = 0
    }
  }

  const subjectOrder = [...new Set(cleanUnits.map((unit) => unit.subject_id))]
  const subjectOrderIdx = new Map(subjectOrder.map((subjectId, index) => [subjectId, index]))

  const states: UnitState[] = cleanUnits
    .filter((unit) => unit.estimated_minutes > 0)
    .map((unit) => ({
      unit,
      coreSessions: Math.ceil(
        unit.estimated_minutes / unit.session_length_minutes
      ),
      coreRemaining: Math.ceil(
        unit.estimated_minutes / unit.session_length_minutes
      ),
      scheduled: 0,
      depsComplete: unit.depends_on.length === 0,
      sessionsOnDay: new Map<string, number>(),
    }))
  if (states.length === 0) return []

  const subjectTopics = new Map<string, UnitState[]>()
  for (const state of states) {
    const subjectId = state.unit.subject_id
    const existing = subjectTopics.get(subjectId)
    if (existing) {
      existing.push(state)
      continue
    }
    subjectTopics.set(subjectId, [state])
  }

  const completedUnits = new Set<string>()
  const sessions: ScheduledSession[] = []
  const subjectNewTopicBlockedUntil = new Map<string, string>()
  const topicLastScheduledDate = new Map<string, string>()
  const subjectLastScheduledDate = new Map<string, string>()
  const maxTopicsPerSubjectPerDay =
    constraints.max_topics_per_subject_per_day ?? 1

  function rankTopicsForPlacement(topics: UnitState[]): UnitState[] {
    return topics
  }

  const maxDayCapacity = daySlots.reduce(
    (max, day) => Math.max(max, day.flexCapacity),
    0
  )
  const oversizedIds = new Set<string>()
  for (const state of states) {
    if (state.unit.session_length_minutes > maxDayCapacity) {
      oversizedIds.add(state.unit.id)
    }
  }

  const totalMinutesNeeded = states.reduce(
    (sum, state) => sum + state.coreRemaining * state.unit.session_length_minutes,
    0
  )
  const totalBaseCapacity = daySlots.reduce((sum, day) => sum + day.capacity, 0)
  const loadRatio =
    totalBaseCapacity > 0
      ? totalMinutesNeeded / totalBaseCapacity
      : Number.POSITIVE_INFINITY
  const minSubjectGap = computeInternalSubjectGapDays(
    loadRatio,
    constraints.min_subject_gap_days
  )

  if (
    constraints.flexibility_minutes == null &&
    totalBaseCapacity > 0 &&
    totalMinutesNeeded > totalBaseCapacity
  ) {
    const scaleFactor = totalMinutesNeeded / totalBaseCapacity
    for (const day of daySlots) {
      const scaled = Math.min(
        Math.ceil(day.capacity * scaleFactor),
        day.flexCapacity
      )
      day.capacity = scaled
      day.remainingMinutes = scaled
    }
  }

  function refreshDeps() {
    for (const state of states) {
      if (oversizedIds.has(state.unit.id)) continue
      state.depsComplete =
        state.unit.depends_on.length === 0 ||
        state.unit.depends_on.every(
          (depId) => completedUnits.has(depId) || oversizedIds.has(depId)
        )
    }
  }

  function isTopicSpacingOK(state: UnitState, date: string): boolean {
    void state
    void date
    return true
  }

  function isSubjectGapOK(subjectId: string, date: string): boolean {
    if (minSubjectGap <= 0) return true

    const last = subjectLastScheduledDate.get(subjectId)
    if (!last) return true

    const topics = subjectTopics.get(subjectId) ?? []
    for (const topic of topics) {
      if (topic.coreRemaining > 0 && daysBetween(date, topic.unit.deadline) <= 3) {
        return true
      }
    }

    return daysBetween(last, date) > minSubjectGap
  }

  function canPlaceTopicOnDay(state: UnitState, date: string): boolean {
    const maxPerDay = state.unit.max_sessions_per_day ?? 0
    if (maxPerDay <= 0) return true
    return (state.sessionsOnDay.get(date) ?? 0) < maxPerDay
  }

  function placeSession(state: UnitState, day: DaySlot) {
    const { isFlexDay, flexExtra } = bookMinutes(
      day,
      state.unit.session_length_minutes
    )

    state.scheduled++
    state.coreRemaining--
    state.sessionsOnDay.set(
      day.date,
      (state.sessionsOnDay.get(day.date) ?? 0) + 1
    )
    topicLastScheduledDate.set(state.unit.id, day.date)
    subjectLastScheduledDate.set(state.unit.subject_id, day.date)

    const sessionNumber = state.scheduled
    const totalSessions = state.coreSessions
    const topicCompletion =
      totalSessions > 0
        ? Math.round((sessionNumber / totalSessions) * 100) / 100
        : 1
    const isFinal = state.coreRemaining <= 0

    const title = state.unit.topic_name

    sessions.push({
      subject_id: state.unit.subject_id,
      topic_id: state.unit.id,
      title,
      scheduled_date: day.date,
      duration_minutes: state.unit.session_length_minutes,
      session_type: "core",
      session_number: sessionNumber,
      total_sessions: totalSessions,
      is_flex_day: isFlexDay || undefined,
      flex_extra_minutes: flexExtra > 0 ? flexExtra : undefined,
      topic_completion_after: topicCompletion,
      is_topic_final_session: isFinal || undefined,
    })

    if (isFinal) {
      completedUnits.add(state.unit.id)
      state.completedDate = day.date

      const restDays = state.unit.rest_after_days ?? 0
      if (restDays > 0) {
        const blockedUntil = addDaysISO(day.date, restDays)
        const existing = subjectNewTopicBlockedUntil.get(state.unit.subject_id)
        if (!existing || blockedUntil > existing) {
          subjectNewTopicBlockedUntil.set(state.unit.subject_id, blockedUntil)
        }
      }
    }
  }

  const totalPossibleSessions = states.reduce(
    (sum, state) => sum + state.coreSessions,
    0
  )
  const safetyLimit = totalPossibleSessions * daySlots.length + daySlots.length
  let safetyCounter = 0
  const inProgressTopics = new Set<string>()

  for (const day of daySlots) {
    if (safetyCounter > safetyLimit) break
    refreshDeps()

    for (const state of states) {
      if (state.scheduled > 0 && state.coreRemaining > 0) {
        inProgressTopics.add(state.unit.id)
      } else {
        inProgressTopics.delete(state.unit.id)
      }
    }

    const activeBySubject = new Map<string, UnitState[]>()
    for (const subjectId of subjectOrder) {
      if (!isSubjectGapOK(subjectId, day.date)) continue
      const active = getActiveTopicsForSubject(
        subjectId,
        day.date,
        subjectTopics,
        constraints,
        oversizedIds,
        subjectNewTopicBlockedUntil,
        false
      )
      if (active.length > 0) activeBySubject.set(subjectId, active)
    }
    if (activeBySubject.size === 0) continue

    let orderedSubjectIds = [...activeBySubject.keys()]

    const limit = constraints.max_active_subjects
    if (limit > 0 && orderedSubjectIds.length > limit) {
      orderedSubjectIds = orderedSubjectIds.slice(0, limit)
    }

    const topicsPlacedPerSubject = new Map<string, Set<string>>()
    const subjectMinutesToday = new Map<string, number>()
    const multipleSubjects = orderedSubjectIds.length > 1
    const maxPerSubjectMinutes = multipleSubjects
      ? Math.ceil((day.flexCapacity || day.capacity) * 0.6)
      : Infinity

    if (inProgressTopics.size > 0) {
      const inProgressOrder = [...subjectOrder]

      for (const subjectId of inProgressOrder) {
        if (slotAvailable(day) <= 0) break
        if (!isSubjectGapOK(subjectId, day.date)) continue

        const activeTopics = getActiveTopicsForSubject(
          subjectId,
          day.date,
          subjectTopics,
          constraints,
          oversizedIds,
          subjectNewTopicBlockedUntil,
          false
        )
        const placed = topicsPlacedPerSubject.get(subjectId) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(
          activeTopics.filter((state) => inProgressTopics.has(state.unit.id))
        )

        for (const state of rankedTopics) {
          if (!inProgressTopics.has(state.unit.id)) continue
          if (!placed.has(state.unit.id) && placed.size >= maxTopicsPerSubjectPerDay) {
            continue
          }
          if (!canPlaceTopicOnDay(state, day.date)) continue
          if (!isTopicSpacingOK(state, day.date)) continue

          const sessionLength = state.unit.session_length_minutes
          if (slotAvailable(day) < sessionLength) continue

          const subjectUsed = subjectMinutesToday.get(subjectId) ?? 0
          if (subjectUsed + sessionLength > maxPerSubjectMinutes && subjectUsed > 0) {
            continue
          }

          placeSession(state, day)
          subjectMinutesToday.set(subjectId, subjectUsed + sessionLength)
          placed.add(state.unit.id)
          topicsPlacedPerSubject.set(subjectId, placed)
          safetyCounter++
          break
        }
      }
    }

    let placedThisRound = true
    while (slotAvailable(day) > 0 && placedThisRound) {
      if (safetyCounter++ > safetyLimit) break
      placedThisRound = false

      for (const subjectId of orderedSubjectIds) {
        if (slotAvailable(day) <= 0) break

        const subjectUsed = subjectMinutesToday.get(subjectId) ?? 0
        if (subjectUsed >= maxPerSubjectMinutes) continue

        const activeTopics = getActiveTopicsForSubject(
          subjectId,
          day.date,
          subjectTopics,
          constraints,
          oversizedIds,
          subjectNewTopicBlockedUntil,
          false
        )
        if (activeTopics.length === 0) continue

        const placed = topicsPlacedPerSubject.get(subjectId) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(activeTopics)

        let didPlace = false
        for (const state of rankedTopics) {
          if (!placed.has(state.unit.id) && placed.size >= maxTopicsPerSubjectPerDay) {
            continue
          }
          if (!canPlaceTopicOnDay(state, day.date)) continue
          if (!isTopicSpacingOK(state, day.date)) continue

          const sessionLength = state.unit.session_length_minutes
          if (slotAvailable(day) < sessionLength) continue
          if (subjectUsed + sessionLength > maxPerSubjectMinutes && subjectUsed > 0) {
            continue
          }

          placeSession(state, day)
          subjectMinutesToday.set(subjectId, subjectUsed + sessionLength)
          placed.add(state.unit.id)
          topicsPlacedPerSubject.set(subjectId, placed)
          didPlace = true
          placedThisRound = true
          break
        }

        if (!didPlace) continue
      }
    }
  }

  let overflowPlaced = true
  let overflowRounds = 0
  const maxOverflowRounds = totalPossibleSessions + 1

  while (overflowPlaced && overflowRounds++ < maxOverflowRounds) {
    overflowPlaced = false
    refreshDeps()

    const candidates: UnitState[] = []
    for (const topicList of subjectTopics.values()) {
      let hasCompletedPredecessor = false
      for (const state of topicList) {
        if (oversizedIds.has(state.unit.id)) continue
        if (state.coreRemaining <= 0) {
          hasCompletedPredecessor = true
          continue
        }
        if (hasCompletedPredecessor && state.depsComplete) {
          candidates.push(state)
        }
        break
      }
    }
    if (candidates.length === 0) break

    candidates.sort((aState, bState) => {
      const subjectCompare =
        (subjectOrderIdx.get(aState.unit.subject_id) ?? Number.MAX_SAFE_INTEGER) -
        (subjectOrderIdx.get(bState.unit.subject_id) ?? Number.MAX_SAFE_INTEGER)
      if (subjectCompare !== 0) return subjectCompare
      return aState.unit.id.localeCompare(bState.unit.id)
    })

    for (const state of candidates) {
      for (const day of daySlots) {
        if (state.coreRemaining <= 0) break

        const sessionLength = state.unit.session_length_minutes
        if (slotAvailable(day) < sessionLength) continue

        const start = state.unit.earliest_start ?? constraints.study_start_date
        if (day.date < start) continue
        if (day.date > state.unit.deadline) continue
        const blockDate = subjectNewTopicBlockedUntil.get(state.unit.subject_id)
        if (blockDate && day.date < blockDate && state.scheduled === 0) continue
        if (!canPlaceTopicOnDay(state, day.date)) continue
        if (!isTopicSpacingOK(state, day.date)) continue
        if (!isSubjectGapOK(state.unit.subject_id, day.date)) continue

        placeSession(state, day)
        overflowPlaced = true
      }
    }
  }

  sessions.sort((aSession, bSession) => {
    const dateCompare = aSession.scheduled_date.localeCompare(bSession.scheduled_date)
    if (dateCompare !== 0) return dateCompare
    return (
      (subjectOrderIdx.get(aSession.subject_id) ?? 0) -
      (subjectOrderIdx.get(bSession.subject_id) ?? 0)
    )
  })

  return sessions
}

/**
 * Generates a complete study plan from input topics, constraints, and off-days.
 *
 * **Pipeline:**
 *
 * 1. If no units are provided, returns `{ status: "NO_UNITS" }`.
 * 2. Runs {@link checkFeasibility} to assess whether the plan can fit.
 * 3. Runs {@link schedule} to generate the actual session placements.
 * 4. If no sessions were produced and the plan is infeasible, returns
 *    `{ status: "INFEASIBLE" }` with the feasibility result.
 * 5. If no sessions were produced but the plan was declared feasible, returns
 *    `{ status: "NO_DAYS" }` (no usable study days).
 * 6. Compares expected sessions (from feasibility) against generated sessions.
 *    If sessions were dropped and the plan is not feasible, returns
 *    `{ status: "PARTIAL" }` with the partial schedule.
 * 7. Otherwise returns `{ status: "READY" }` with the full schedule.
 *
 * @param input - The complete plan input (topics, constraints, off-days).
 * @returns A {@link PlanResult} discriminated union describing the outcome.
 */
export function generatePlan(input: PlanInput): PlanResult {
  const { units, constraints, offDays } = input

  if (!units || units.length === 0) {
    return { status: "NO_UNITS" }
  }

  const feasibility = checkFeasibility(units, constraints, offDays)
  const sessions = schedule(units, constraints, offDays)

  if (sessions.length === 0) {
    if (!feasibility.feasible) {
      return { status: "INFEASIBLE", feasibility }
    }
    return { status: "NO_DAYS" }
  }

  const expectedSessions = feasibility.units.reduce(
    (sum, unit) => sum + unit.totalSessions,
    0
  )
  const droppedSessions = Math.max(0, expectedSessions - sessions.length)

  if (droppedSessions > 0 && !feasibility.feasible) {
    return {
      status: "PARTIAL",
      schedule: sessions,
      feasibility,
      droppedSessions,
    }
  }

  return {
    status: "READY",
    schedule: sessions,
    feasibility,
  }
}
