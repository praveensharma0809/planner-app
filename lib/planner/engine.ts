export type TopicOrderingMode =
  | "sequential"
  | "flexible_sequential"
  | "parallel"

export type StudyFrequency = "daily" | "spaced"

export type PlanOrderCriterion =
  | "urgency"
  | "priority"
  | "deadline"
  | "subject_order"
  | "effort"
  | "completion"

export interface PlannableUnit {
  id: string
  subject_id: string
  subject_name: string
  topic_name: string
  estimated_minutes: number
  session_length_minutes: number
  priority: number
  deadline: string
  earliest_start?: string
  depends_on: string[]
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: StudyFrequency
  tier?: number
}

export interface ReservedSlot {
  date: string
  minutes: number
}

export interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  day_of_week_capacity?: (number | null)[]
  custom_day_capacity?: Record<string, number>
  plan_order_stack?: PlanOrderCriterion[]
  plan_order: "priority" | "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  flexibility_minutes?: number
  max_daily_minutes?: number
  max_active_subjects: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, TopicOrderingMode>
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
  is_flex_day?: boolean
  flex_extra_minutes?: number
  topic_completion_after?: number
  is_topic_final_session?: boolean
  is_pinned?: boolean
  is_manual?: boolean
}

export type UnitFeasibilityStatus = "safe" | "tight" | "at_risk" | "impossible"

export interface UnitFeasibility {
  unitId: string
  name: string
  deadline: string
  totalSessions: number
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
  flexFeasible?: boolean
  totalSessionsNeeded: number
  totalSlotsAvailable: number
  totalFlexAvailable?: number
  globalGap: number
  units: UnitFeasibility[]
  suggestions: FeasibilitySuggestion[]
}

export interface DaySlot {
  date: string
  capacity: number
  flexCapacity: number
  remainingMinutes: number
  isWeekend: boolean
  flexUsed: number
}

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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseISODate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + n)
  return next
}

export function buildDaySlots(
  constraints: GlobalConstraints,
  offDays: Set<string>
): DaySlot[] {
  const start = new Date(constraints.study_start_date)
  const revisionDays = constraints.final_revision_days ?? 0
  const endDate = addDays(new Date(constraints.exam_date), -revisionDays)

  const flexMinutes = constraints.flexibility_minutes ?? 0
  const maxDaily = constraints.max_daily_minutes ?? 480

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
      const baseCapacity = isZeroCapacityDay
        ? 0
        : Math.min(normalizedRawCapacity, maxDaily)
      const flexCap = isZeroCapacityDay
        ? 0
        : Math.min(baseCapacity + flexMinutes, maxDaily)

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
  return Math.ceil((parseISODate(to).getTime() - parseISODate(from).getTime()) / MS_PER_DAY)
}

function addDaysISO(date: string, days: number): string {
  const next = parseISODate(date)
  next.setDate(next.getDate() + days)
  return toISO(next)
}

function computeUrgency(state: UnitState, currentDate: string): number {
  const daysLeft = Math.max(1, daysBetween(currentDate, state.unit.deadline))
  const ratio = state.coreRemaining / daysLeft
  const completionRatio =
    state.coreSessions > 0
      ? (state.coreSessions - state.coreRemaining) / state.coreSessions
      : 0
  return Math.pow(ratio, 1.4) * (1 + (1 - completionRatio))
}

function computeEffort(state: UnitState): number {
  return state.coreRemaining * state.unit.session_length_minutes
}

function getCompletionRatio(state: UnitState): number {
  if (state.coreSessions === 0) return 0
  return (state.coreSessions - state.coreRemaining) / state.coreSessions
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

function compareByStack(
  aState: UnitState,
  bState: UnitState,
  currentDate: string,
  stack: PlanOrderCriterion[],
  subjectOrderIdx: Map<string, number>
): number {
  for (const criterion of stack) {
    let compare = 0
    switch (criterion) {
      case "urgency":
        compare =
          computeUrgency(bState, currentDate) -
          computeUrgency(aState, currentDate)
        break
      case "priority":
        compare = aState.unit.priority - bState.unit.priority
        break
      case "deadline":
        compare = aState.unit.deadline.localeCompare(bState.unit.deadline)
        break
      case "subject_order":
        compare =
          (subjectOrderIdx.get(aState.unit.subject_id) ?? 0) -
          (subjectOrderIdx.get(bState.unit.subject_id) ?? 0)
        break
      case "effort":
        compare = computeEffort(bState) - computeEffort(aState)
        break
      case "completion":
        compare = getCompletionRatio(bState) - getCompletionRatio(aState)
        break
    }

    if (compare !== 0) return compare
  }

  return 0
}

function legacyOrderToStack(order: string): PlanOrderCriterion[] {
  switch (order) {
    case "priority":
      return ["urgency", "subject_order", "deadline"]
    case "deadline":
      return ["urgency", "deadline", "subject_order"]
    case "subject":
      return ["subject_order", "urgency"]
    case "balanced":
    default:
      return ["urgency", "subject_order", "deadline"]
  }
}

function computeAdaptiveFlexibleThreshold(loadRatio: number): number {
  if (loadRatio > 0.9) return 0.6
  if (loadRatio > 0.75) return 0.7
  return 0.8
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
  relaxDeadline: boolean,
  _adaptiveThreshold: number
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
    if (!subjectTopics.has(subjectId)) subjectTopics.set(subjectId, [])
    subjectTopics.get(subjectId)!.push(state)
  }

  const completedUnits = new Set<string>()
  const sessions: ScheduledSession[] = []
  const subjectNewTopicBlockedUntil = new Map<string, string>()
  const topicLastScheduledDate = new Map<string, string>()
  const subjectLastScheduledDate = new Map<string, string>()
  const maxTopicsPerSubjectPerDay =
    constraints.max_topics_per_subject_per_day ?? 1

  function rankTopicsForPlacement(
    topics: UnitState[],
    _placed: Set<string>,
    _date: string
  ): UnitState[] {
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
  const adaptiveThreshold = computeAdaptiveFlexibleThreshold(loadRatio)
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
      priority: state.unit.priority,
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
        false,
        adaptiveThreshold
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
          false,
          adaptiveThreshold
        )
        const placed = topicsPlacedPerSubject.get(subjectId) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(
          activeTopics.filter((state) => inProgressTopics.has(state.unit.id)),
          placed,
          day.date
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
          false,
          adaptiveThreshold
        )
        if (activeTopics.length === 0) continue

        const placed = topicsPlacedPerSubject.get(subjectId) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(activeTopics, placed, day.date)

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