import type {
  PlannableUnit,
  GlobalConstraints,
  ScheduledSession,
  DaySlot,
  PlanOrderCriterion,
  ReservedSlot,
} from "./types"
import { buildDaySlots } from "./feasibility"

// ── Internal state ───────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  return Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY
  )
}

function addDaysISO(date: string, n: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d.toISOString().split("T")[0]
}

/**
 * Internal urgency mix: deadline pressure + remaining work + momentum boost.
 * Priority is intentionally retired from scheduling rank decisions.
 */
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
  const ids = new Set(units.map((u) => u.id))
  const visited = new Set<string>()
  const stack = new Set<string>()
  const depMap = new Map<string, string[]>()
  for (const u of units) {
    depMap.set(u.id, u.depends_on.filter((d) => ids.has(d)))
  }

  function dfs(id: string): boolean {
    if (stack.has(id)) return true
    if (visited.has(id)) return false
    visited.add(id)
    stack.add(id)
    for (const dep of depMap.get(id) ?? []) {
      if (dfs(dep)) return true
    }
    stack.delete(id)
    return false
  }

  for (const u of units) {
    if (dfs(u.id)) return true
  }
  return false
}

// ── Priority stack comparator ────────────────────────────────────────────────

function compareByStack(
  aState: UnitState,
  bState: UnitState,
  currentDate: string,
  stack: PlanOrderCriterion[],
  subjectOrderIdx: Map<string, number>
): number {
  for (const criterion of stack) {
    let cmp = 0
    switch (criterion) {
      case "urgency":
        cmp =
          computeUrgency(bState, currentDate) -
          computeUrgency(aState, currentDate)
        break
      case "priority":
        // Priority-based ordering is retired. Keep criterion for backward compatibility.
        cmp = 0
        break
      case "deadline":
        cmp = aState.unit.deadline.localeCompare(bState.unit.deadline)
        break
      case "subject_order":
        cmp =
          (subjectOrderIdx.get(aState.unit.subject_id) ?? 0) -
          (subjectOrderIdx.get(bState.unit.subject_id) ?? 0)
        break
      case "effort":
        cmp = computeEffort(bState) - computeEffort(aState)
        break
      case "completion":
        cmp = getCompletionRatio(bState) - getCompletionRatio(aState)
        break
    }
    if (cmp !== 0) return cmp
  }
  return 0
}

/** Convert legacy plan_order enum → stack for backward compat */
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

function computeInternalSubjectGapDays(loadRatio: number): number {
  // Use a light anti-overwhelm gap only when pressure is low enough.
  if (loadRatio <= 0.7) return 1
  return 0
}

// ── Capacity helpers ─────────────────────────────────────────────────────────

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

// ── Topic ordering mode: resolve active topics for a subject on a date ──────

function getActiveTopicsForSubject(
  sid: string,
  date: string,
  subjectTopics: Map<string, UnitState[]>,
  constraints: GlobalConstraints,
  oversizedIds: Set<string>,
  subjectNewTopicBlockedUntil: Map<string, string>,
  relaxDeadline: boolean,
  adaptiveThreshold: number
): UnitState[] {
  const ordering = constraints.subject_ordering?.[sid] ?? "sequential"
  const topics = subjectTopics.get(sid) ?? []

  function eligible(state: UnitState): boolean {
    if (state.coreRemaining <= 0) return false
    if (oversizedIds.has(state.unit.id)) return false
    if (!state.depsComplete) return false
    const blockDate = subjectNewTopicBlockedUntil.get(sid)
    // Rest-after blocks only opening new topics; already-started topics may continue.
    if (blockDate && date < blockDate && state.scheduled === 0) return false
    const start = state.unit.earliest_start ?? constraints.study_start_date
    if (date < start) return false
    if (!relaxDeadline && date > state.unit.deadline) return false
    return true
  }

  switch (ordering) {
    case "sequential": {
      for (const state of topics) {
        if (state.coreRemaining <= 0) continue
        if (oversizedIds.has(state.unit.id)) continue
        if (!state.depsComplete) return []
        if (!eligible(state)) return []
        return [state]
      }
      return []
    }

    case "flexible_sequential": {
      const unfinished = topics.filter(
        (s) => s.coreRemaining > 0 && !oversizedIds.has(s.unit.id)
      )
      if (unfinished.length === 0) return []

      const first = unfinished[0]
      // Keep sequential lock semantics: if the current topic is blocked,
      // do not skip ahead to later topics.
      if (!first.depsComplete || !eligible(first)) return []

      const active: UnitState[] = [first]
      if (unfinished.length > 1) {
        const comp =
          first.coreSessions > 0
            ? (first.coreSessions - first.coreRemaining) / first.coreSessions
            : 1
        if (comp >= adaptiveThreshold) {
          const second = unfinished[1]
          if (eligible(second)) {
            active.push(second)
          }
        }
      }

      return active
    }

    case "parallel":
      return topics.filter((s) => eligible(s))

    default:
      return []
  }
}

// ── Main scheduler ───────────────────────────────────────────────────────────

/**
 * v2 scheduler — supports per-subject topic ordering modes, flex capacity,
 * rest-after gaps, study frequency spacing, priority stack multi-sort,
 * per-topic max sessions/day, min subject gap, and enriched session metadata.
 */
export function schedule(
  units: PlannableUnit[],
  constraints: GlobalConstraints,
  offDays: Set<string>,
  reservedSlots: ReservedSlot[] = []
): ScheduledSession[] {
  if (units.length === 0) return []

  // ── Sanitise inputs ──────────────────────────────────────────────────────
  const knownIds = new Set(units.map((u) => u.id))
  const seenIds = new Set<string>()
  const cleanUnits: PlannableUnit[] = []
  for (const u of units) {
    if (seenIds.has(u.id)) continue
    seenIds.add(u.id)
    cleanUnits.push({
      ...u,
      depends_on: u.depends_on.filter((d) => knownIds.has(d) && d !== u.id),
      session_length_minutes: Math.max(1, u.session_length_minutes),
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

  // Subject ordering from Phase 1
  const subjectOrder = [...new Set(cleanUnits.map((u) => u.subject_id))]
  const subjectOrderIdx = new Map(subjectOrder.map((sid, i) => [sid, i]))

  // Build states
  const states: UnitState[] = cleanUnits
    .filter((u) => u.estimated_minutes > 0)
    .map((u) => ({
      unit: u,
      coreSessions: Math.ceil(u.estimated_minutes / u.session_length_minutes),
      coreRemaining: Math.ceil(u.estimated_minutes / u.session_length_minutes),
      scheduled: 0,
      depsComplete: u.depends_on.length === 0,
      sessionsOnDay: new Map<string, number>(),
    }))
  if (states.length === 0) return []

  // Group by subject (preserving Phase 1 topic order)
  const subjectTopics = new Map<string, UnitState[]>()
  for (const state of states) {
    const sid = state.unit.subject_id
    if (!subjectTopics.has(sid)) subjectTopics.set(sid, [])
    subjectTopics.get(sid)!.push(state)
  }

  // Resolve plan_order_stack (new) or legacy plan_order (old)
  const orderStack: PlanOrderCriterion[] =
    constraints.plan_order_stack && constraints.plan_order_stack.length > 0
      ? constraints.plan_order_stack
      : legacyOrderToStack(constraints.plan_order)

  const completedUnits = new Set<string>()
  const sessions: ScheduledSession[] = []
  const subjectNewTopicBlockedUntil = new Map<string, string>() // subject_id → first allowed date for unopened topics
  const topicLastScheduledDate = new Map<string, string>()
  const subjectLastScheduledDate = new Map<string, string>()
  const maxTopicsPerSubjectPerDay =
    constraints.max_topics_per_subject_per_day ?? 1

  function rankTopicsForPlacement(
    topics: UnitState[],
    placed: Set<string>,
    date: string
  ): UnitState[] {
    const canOpenMoreTopics = placed.size < maxTopicsPerSubjectPerDay
    return [...topics].sort((a, b) => {
      if (canOpenMoreTopics) {
        const aAlreadyPlaced = placed.has(a.unit.id)
        const bAlreadyPlaced = placed.has(b.unit.id)
        if (aAlreadyPlaced !== bAlreadyPlaced) {
          return aAlreadyPlaced ? 1 : -1
        }
      }
      return compareByStack(a, b, date, orderStack, subjectOrderIdx)
    })
  }

  // ── Detect oversized topics ──────────────────────────────────────────────
  const maxDayCapacity = daySlots.reduce(
    (mx, d) => Math.max(mx, d.flexCapacity),
    0
  )
  const oversizedIds = new Set<string>()
  for (const s of states) {
    if (s.unit.session_length_minutes > maxDayCapacity) {
      oversizedIds.add(s.unit.id)
    }
  }

  // ── Burn rate scaling ────────────────────────────────────────────────────
  const totalMinutesNeeded = states.reduce(
    (sum, s) => sum + s.coreRemaining * s.unit.session_length_minutes,
    0
  )
  const totalBaseCapacity = daySlots.reduce((sum, d) => sum + d.capacity, 0)
  const loadRatio =
    totalBaseCapacity > 0 ? totalMinutesNeeded / totalBaseCapacity : Number.POSITIVE_INFINITY
  const adaptiveThreshold = computeAdaptiveFlexibleThreshold(loadRatio)
  const minSubjectGap = computeInternalSubjectGapDays(loadRatio)

  if (
    constraints.flexibility_minutes == null
    && totalBaseCapacity > 0
    && totalMinutesNeeded > totalBaseCapacity
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
    for (const s of states) {
      if (oversizedIds.has(s.unit.id)) continue
      s.depsComplete =
        s.unit.depends_on.length === 0 ||
        s.unit.depends_on.every(
          (d) => completedUnits.has(d) || oversizedIds.has(d)
        )
    }
  }

  // ── Spacing helpers ──────────────────────────────────────────────────────

  function isTopicSpacingOK(state: UnitState, date: string): boolean {
    const freq = state.unit.study_frequency === "spaced" ? "spaced" : "daily"
    if (freq === "daily") return true
    const last = topicLastScheduledDate.get(state.unit.id)
    if (!last) return true
    if (freq === "spaced") return daysBetween(last, date) >= 2
    return true
  }

  function isSubjectGapOK(sid: string, date: string): boolean {
    if (minSubjectGap <= 0) return true
    const last = subjectLastScheduledDate.get(sid)
    if (!last) return true
    // Override gap when any topic in subject has ≤ 3 days to deadline
    const topics = subjectTopics.get(sid) ?? []
    for (const t of topics) {
      if (t.coreRemaining > 0 && daysBetween(date, t.unit.deadline) <= 3) {
        return true
      }
    }
    return daysBetween(last, date) > minSubjectGap
  }

  function canPlaceTopicOnDay(state: UnitState, date: string): boolean {
    const max = state.unit.max_sessions_per_day ?? 0
    if (max <= 0) return true
    return (state.sessionsOnDay.get(date) ?? 0) < max
  }

  // ── Place a session ──────────────────────────────────────────────────────

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

    const sessionNum = state.scheduled
    const totalSess = state.coreSessions
    const topicCompletion =
      totalSess > 0 ? Math.round((sessionNum / totalSess) * 100) / 100 : 1
    const isFinal = state.coreRemaining <= 0

    const label =
      totalSess > 1
        ? `${state.unit.subject_name} – ${state.unit.topic_name} (${sessionNum}/${totalSess})`
        : `${state.unit.subject_name} – ${state.unit.topic_name}`

    sessions.push({
      subject_id: state.unit.subject_id,
      topic_id: state.unit.id,
      title: label,
      scheduled_date: day.date,
      duration_minutes: state.unit.session_length_minutes,
      session_type: "core",
      priority: state.unit.priority,
      session_number: sessionNum,
      total_sessions: totalSess,
      is_flex_day: isFlexDay || undefined,
      flex_extra_minutes: flexExtra > 0 ? flexExtra : undefined,
      topic_completion_after: topicCompletion,
      is_topic_final_session: isFinal || undefined,
    })

    if (isFinal) {
      completedUnits.add(state.unit.id)
      state.completedDate = day.date
      const rest = state.unit.rest_after_days ?? 0
      if (rest > 0) {
        const blockedUntil = addDaysISO(day.date, rest)
        const existing = subjectNewTopicBlockedUntil.get(state.unit.subject_id)
        if (!existing || blockedUntil > existing) {
          subjectNewTopicBlockedUntil.set(state.unit.subject_id, blockedUntil)
        }
      }
    }
  }

  // ── Safety limit ─────────────────────────────────────────────────────────
  const totalPossibleSessions = states.reduce(
    (s, u) => s + u.coreSessions,
    0
  )
  const SAFETY_LIMIT =
    totalPossibleSessions * daySlots.length + daySlots.length
  let safetyCounter = 0
  // Topics that have received ≥1 session in this run but are not yet complete.
  // They get a priority slot every day so sessions are never gapped by competing subjects.
  const inProgressTopics = new Set<string>()

  // ── Main scheduling pass ─────────────────────────────────────────────────

  for (const day of daySlots) {
    if (safetyCounter > SAFETY_LIMIT) break
    refreshDeps()

    // Refresh in-progress set: topics with ≥1 session placed but not yet complete
    for (const state of states) {
      if (state.scheduled > 0 && state.coreRemaining > 0) {
        inProgressTopics.add(state.unit.id)
      } else {
        inProgressTopics.delete(state.unit.id)
      }
    }

    // Collect active topics per subject for today
    const activeBySubject = new Map<string, UnitState[]>()
    for (const sid of subjectOrder) {
      if (!isSubjectGapOK(sid, day.date)) continue
      const active = getActiveTopicsForSubject(
        sid,
        day.date,
        subjectTopics,
        constraints,
        oversizedIds,
        subjectNewTopicBlockedUntil,
        false,
        adaptiveThreshold
      )
      if (active.length > 0) activeBySubject.set(sid, active)
    }
    if (activeBySubject.size === 0) continue

    // Order subjects using plan_order_stack (compare first active topic)
    let orderedSubjectIds = [...activeBySubject.keys()]
    orderedSubjectIds.sort((a, b) => {
      const aBest = activeBySubject.get(a)![0]
      const bBest = activeBySubject.get(b)![0]
      return compareByStack(
        aBest,
        bBest,
        day.date,
        orderStack,
        subjectOrderIdx
      )
    })

    // Focus depth: limit active subjects per day
    const limit = constraints.max_active_subjects
    if (limit > 0 && orderedSubjectIds.length > limit) {
      const urgentIds = orderedSubjectIds.filter((sid) => {
        const topics = activeBySubject.get(sid)!
        return topics.some(
          (t) => daysBetween(day.date, t.unit.deadline) <= 7
        )
      })
      const urgentSet = new Set(urgentIds)
      const regularIds = orderedSubjectIds.filter(
        (sid) => !urgentSet.has(sid)
      )
      const slotsForRegular = Math.max(0, limit - urgentIds.length)
      orderedSubjectIds = [
        ...urgentIds,
        ...regularIds.slice(0, slotsForRegular),
      ]
    }

    // Track topics placed per subject today
    const topicsPlacedPerSubject = new Map<string, Set<string>>()
    const subjectMinutesToday = new Map<string, number>()
    const multipleSubjects = orderedSubjectIds.length > 1
    const maxPerSubjectMinutes = multipleSubjects
      ? Math.ceil((day.flexCapacity || day.capacity) * 0.6)
      : Infinity

    // ── Priority pass: guarantee in-progress topics continue every day ─────
    // Sorted by urgency so the most time-critical topic claims capacity first.
    // Respects all per-topic constraints (spacing, max_sessions_per_day, etc.).
    if (inProgressTopics.size > 0) {
      const ipOrder = [...subjectOrder].sort((a, b) => {
        const aState = (subjectTopics.get(a) ?? []).find((s) => inProgressTopics.has(s.unit.id))
        const bState = (subjectTopics.get(b) ?? []).find((s) => inProgressTopics.has(s.unit.id))
        if (!aState && !bState) return 0
        if (!aState) return 1
        if (!bState) return -1
        return compareByStack(aState, bState, day.date, orderStack, subjectOrderIdx)
      })
      for (const sid of ipOrder) {
        if (slotAvailable(day) <= 0) break
        if (!isSubjectGapOK(sid, day.date)) continue
        const activeTopics = getActiveTopicsForSubject(
          sid,
          day.date,
          subjectTopics,
          constraints,
          oversizedIds,
          subjectNewTopicBlockedUntil,
          false,
          adaptiveThreshold
        )
        const placed = topicsPlacedPerSubject.get(sid) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(
          activeTopics.filter((state) => inProgressTopics.has(state.unit.id)),
          placed,
          day.date
        )
        for (const state of rankedTopics) {
          if (!inProgressTopics.has(state.unit.id)) continue
          if (!placed.has(state.unit.id) && placed.size >= maxTopicsPerSubjectPerDay) continue
          if (!canPlaceTopicOnDay(state, day.date)) continue
          if (!isTopicSpacingOK(state, day.date)) continue
          const sessionLen = state.unit.session_length_minutes
          if (slotAvailable(day) < sessionLen) continue
          const subjectUsed = subjectMinutesToday.get(sid) ?? 0
          if (subjectUsed + sessionLen > maxPerSubjectMinutes && subjectUsed > 0)
            continue
          placeSession(state, day)
          subjectMinutesToday.set(sid, subjectUsed + sessionLen)
          placed.add(state.unit.id)
          topicsPlacedPerSubject.set(sid, placed)
          safetyCounter++
          break
        }
      }
    }

    // Round-robin across subjects (remaining capacity fills with all eligible topics)
    let placedThisRound = true
    while (slotAvailable(day) > 0 && placedThisRound) {
      if (safetyCounter++ > SAFETY_LIMIT) break
      placedThisRound = false

      for (const sid of orderedSubjectIds) {
        if (slotAvailable(day) <= 0) break

        const subjectUsed = subjectMinutesToday.get(sid) ?? 0
        if (subjectUsed >= maxPerSubjectMinutes) continue

        // Refresh active topics (completion may have unlocked next topic)
        const activeTopics = getActiveTopicsForSubject(
          sid,
          day.date,
          subjectTopics,
          constraints,
          oversizedIds,
          subjectNewTopicBlockedUntil,
          false,
          adaptiveThreshold
        )
        if (activeTopics.length === 0) continue

        const placed = topicsPlacedPerSubject.get(sid) ?? new Set<string>()
        const rankedTopics = rankTopicsForPlacement(activeTopics, placed, day.date)

        // Find best eligible topic
        let didPlace = false
        for (const state of rankedTopics) {
          // Enforce max_topics_per_subject_per_day
          if (
            !placed.has(state.unit.id) &&
            placed.size >= maxTopicsPerSubjectPerDay
          )
            continue
          if (!canPlaceTopicOnDay(state, day.date)) continue
          if (!isTopicSpacingOK(state, day.date)) continue

          const sessionLen = state.unit.session_length_minutes
          if (slotAvailable(day) < sessionLen) continue
          if (subjectUsed + sessionLen > maxPerSubjectMinutes && subjectUsed > 0)
            continue

          placeSession(state, day)
          subjectMinutesToday.set(sid, subjectUsed + sessionLen)
          placed.add(state.unit.id)
          topicsPlacedPerSubject.set(sid, placed)
          didPlace = true
          placedThisRound = true
          break
        }
        if (!didPlace) continue
      }
    }
  }

  // ── Overflow recovery pass ─────────────────────────────────────────────
  let overflowPlaced = true
  let overflowRounds = 0
  const MAX_OVERFLOW_ROUNDS = totalPossibleSessions + 1

  while (overflowPlaced && overflowRounds++ < MAX_OVERFLOW_ROUNDS) {
    overflowPlaced = false
    refreshDeps()

    // Any topic with remaining sessions and deps met (deadline relaxed)
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
        break // first unfinished per subject
      }
    }
    if (candidates.length === 0) break

    candidates.sort((a, b) =>
      compareByStack(
        a,
        b,
        daySlots[0]?.date ?? "",
        orderStack,
        subjectOrderIdx
      )
    )

    for (const state of candidates) {
      for (const day of daySlots) {
        if (state.coreRemaining <= 0) break
        const sessionLen = state.unit.session_length_minutes
        if (slotAvailable(day) < sessionLen) continue
        const start =
          state.unit.earliest_start ?? constraints.study_start_date
        if (day.date < start) continue
        if (!canPlaceTopicOnDay(state, day.date)) continue

        placeSession(state, day)
        overflowPlaced = true
      }
    }
  }

  // ── Stable sort: date, then subject order ──────────────────────────────
  sessions.sort((a, b) => {
    const dateCmp = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCmp !== 0) return dateCmp
    return (
      (subjectOrderIdx.get(a.subject_id) ?? 0) -
      (subjectOrderIdx.get(b.subject_id) ?? 0)
    )
  })

  return sessions
}

