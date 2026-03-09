import type {
  PlannableUnit,
  GlobalConstraints,
  ScheduledSession,
} from "./types"
import { buildDaySlots } from "./feasibility"

interface UnitState {
  unit: PlannableUnit
  coreSessions: number  // total sessions needed
  coreRemaining: number // sessions not yet placed
  scheduled: number     // sessions placed so far
  depsComplete: boolean
}

function computeUrgency(state: UnitState, currentDate: string): number {
  const msPerDay = 86_400_000
  const daysLeft = Math.max(
    1,
    Math.ceil(
      (new Date(state.unit.deadline).getTime() - new Date(currentDate).getTime()) /
        msPerDay
    )
  )
  return (state.coreRemaining / daysLeft) * (6 - state.unit.priority)
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

/**
 * Sequential-within-subject, interleaved-across-subjects scheduler.
 *
 * Key properties:
 *
 * 1. SEQUENTIAL TOPICS: Within each subject, topics are finished one at a
 *    time before the next begins. No topic jumping mid-completion.
 *
 * 2. BALANCED DAYS (burn rate): Before scheduling, total work needed vs total
 *    available capacity is computed. If capacity < work, all day capacities
 *    are scaled up proportionally so the plan is achievable. Each day then
 *    gets the same scaled capacity → no day is overloaded or underloaded.
 *    Hard max: 8 hours (480 min) per day regardless of how urgent things are.
 *
 * 3. FOCUS DEPTH (max_active_subjects): When set, only the top N most urgent
 *    subjects are active on a given day. Subjects with ≤7 days to deadline
 *    are always included regardless of the limit ("urgent override").
 *
 * 4. INTERLEAVED SUBJECTS: Round-robin across active subjects each round:
 *    A, B, C, A, B, C — not A, A, A, B, B, C.
 *
 * 5. URGENCY-DRIVEN ORDER: Active subjects ordered by urgency or plan_order
 *    so the most critical work is placed first in every round.
 *
 * 6. OVERFLOW RECOVERY: After the main pass, topics that missed their
 *    window due to intra-subject sequencing get placed on later available
 *    days (deadline relaxed). Topics that simply don't fit their own
 *    window are NOT overflowed — the feasibility warning covers those.
 */
export function schedule(
  units: PlannableUnit[],
  constraints: GlobalConstraints,
  offDays: Set<string>
): ScheduledSession[] {
  if (units.length === 0) return []

  // ── Sanitise inputs ────────────────────────────────────────────────────
  // 1. Clean orphan dependencies (refs to IDs not in this unit set)
  // 2. Remove self-references in depends_on
  // 3. Deduplicate units by ID (keep first occurrence)
  // 4. Clamp session_length_minutes to ≥ 1 to prevent division-by-zero
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

  // Preserve the subject ordering from Phase 1
  const subjectOrder = [...new Set(cleanUnits.map((u) => u.subject_id))]

  const states: UnitState[] = cleanUnits
    .filter((u) => u.estimated_minutes > 0)
    .map((u) => {
      const sessions = Math.ceil(u.estimated_minutes / u.session_length_minutes)
      return {
        unit: u,
        coreSessions: sessions,
        coreRemaining: sessions,
        scheduled: 0,
        depsComplete: u.depends_on.length === 0,
      }
    })

  if (states.length === 0) return []

  // ── Sequential topic order within each subject ──────────────────────────
  // Keep the incoming topic order from Phase 1 / data layer. Topic N must be
  // fully done before Topic N+1 starts; no re-sorting here.
  const subjectTopics = new Map<string, UnitState[]>()
  for (const state of states) {
    const sid = state.unit.subject_id
    if (!subjectTopics.has(sid)) subjectTopics.set(sid, [])
    subjectTopics.get(sid)!.push(state)
  }

  const completedUnits = new Set<string>()
  const sessions: ScheduledSession[] = []

  // ── Upfront capacity scaling (burn rate) ──────────────────────────────────
  const HARD_MAX_MINUTES = 8 * 60 // 480 min
  const totalMinutesNeeded = states.reduce(
    (sum, s) => sum + s.coreRemaining * s.unit.session_length_minutes,
    0
  )
  const totalCapacity = daySlots.reduce((sum, d) => sum + d.capacity, 0)
  if (totalCapacity > 0 && totalMinutesNeeded > totalCapacity) {
    const scaleFactor = totalMinutesNeeded / totalCapacity
    for (const day of daySlots) {
      const scaled = Math.min(Math.ceil(day.capacity * scaleFactor), HARD_MAX_MINUTES)
      day.capacity = scaled
      day.remainingMinutes = scaled
    }
  }

  // ── Filter units whose session length exceeds every day's capacity ─────
  const maxDayCapacity = daySlots.reduce((mx, d) => Math.max(mx, d.capacity), 0)
  const oversizedIds = new Set<string>()
  for (const s of states) {
    if (s.unit.session_length_minutes > maxDayCapacity) {
      oversizedIds.add(s.unit.id)
    }
  }

  function refreshDeps() {
    for (const s of states) {
      if (oversizedIds.has(s.unit.id)) continue
      s.depsComplete =
        s.unit.depends_on.length === 0 ||
        s.unit.depends_on.every((d) => completedUnits.has(d) || oversizedIds.has(d))
    }
  }

  /**
   * Active topic for a subject on a given day.
   * When `relaxDeadline` is true, the deadline check is skipped (overflow pass).
   */
  function getActiveTopic(
    sid: string,
    date: string,
    relaxDeadline = false,
  ): UnitState | undefined {
    const topicList = subjectTopics.get(sid) ?? []
    for (const state of topicList) {
      if (state.coreRemaining <= 0) continue
      if (oversizedIds.has(state.unit.id)) continue
      if (!state.depsComplete) return undefined
      const start = state.unit.earliest_start ?? constraints.study_start_date
      if (date < start) return undefined
      if (!relaxDeadline && date > state.unit.deadline) return undefined
      return state
    }
    return undefined
  }

  function hasEarlierUnfinishedTopic(
    sid: string,
    state: UnitState
  ): boolean {
    const list = subjectTopics.get(sid) ?? []
    for (const item of list) {
      if (item === state) return false
      if (item.coreRemaining > 0 && !oversizedIds.has(item.unit.id)) return true
    }
    return false
  }

  // Helper to push a session and update bookkeeping
  function placeSession(state: UnitState, date: string) {
    state.scheduled++
    const sessionNum = state.scheduled
    const totalSessions = state.coreSessions
    const label =
      totalSessions > 1
        ? `${state.unit.subject_name} – ${state.unit.topic_name} (${sessionNum}/${totalSessions})`
        : `${state.unit.subject_name} – ${state.unit.topic_name}`

    sessions.push({
      subject_id: state.unit.subject_id,
      topic_id: state.unit.id,
      title: label,
      scheduled_date: date,
      duration_minutes: state.unit.session_length_minutes,
      session_type: "core",
      priority: state.unit.priority,
      session_number: sessionNum,
      total_sessions: totalSessions,
    })

    state.coreRemaining--
    if (state.coreRemaining <= 0) {
      completedUnits.add(state.unit.id)
    }
  }

  const msPerDay = 86_400_000

  // ── Main scheduling pass ────────────────────────────────────────────────
  // Safety counter: total sessions that could ever be placed is bounded by
  // sum of coreSessions. Cap iterations at a generous multiple to prevent
  // infinite loops from unforeseen edge cases.
  const totalPossibleSessions = states.reduce((s, u) => s + u.coreSessions, 0)
  const SAFETY_LIMIT = totalPossibleSessions * daySlots.length + daySlots.length
  let safetyCounter = 0

  for (const day of daySlots) {
    if (safetyCounter > SAFETY_LIMIT) break
    refreshDeps()

    // ── Find each subject's active topic for today ────────────────────────
    const activeTopicBySubject = new Map<string, UnitState>()
    for (const sid of subjectOrder) {
      const active = getActiveTopic(sid, day.date)
      if (active) activeTopicBySubject.set(sid, active)
    }
    if (activeTopicBySubject.size === 0) continue

    // ── Order subjects by plan_order preference ──────────────────────────
    const availableSubjectIds = [...activeTopicBySubject.keys()]
    let orderedSubjectIds: string[]

    switch (constraints.plan_order) {
      case "priority":
        orderedSubjectIds = availableSubjectIds.sort(
          (a, b) =>
            activeTopicBySubject.get(a)!.unit.priority -
            activeTopicBySubject.get(b)!.unit.priority
        )
        break

      case "deadline":
        orderedSubjectIds = availableSubjectIds.sort((a, b) =>
          activeTopicBySubject
            .get(a)!
            .unit.deadline.localeCompare(activeTopicBySubject.get(b)!.unit.deadline)
        )
        break

      case "subject":
        orderedSubjectIds = subjectOrder.filter((sid) => activeTopicBySubject.has(sid))
        break

      case "balanced":
      default:
        orderedSubjectIds = availableSubjectIds.sort(
          (a, b) =>
            computeUrgency(activeTopicBySubject.get(b)!, day.date) -
            computeUrgency(activeTopicBySubject.get(a)!, day.date)
        )
        break
    }

    // ── Focus depth: limit active subjects per day ────────────────────────
    const limit = constraints.max_active_subjects
    if (limit > 0 && orderedSubjectIds.length > limit) {
      const urgentIds = orderedSubjectIds.filter((sid) => {
        const active = activeTopicBySubject.get(sid)!
        const daysLeft = Math.ceil(
          (new Date(active.unit.deadline).getTime() - new Date(day.date).getTime()) /
            msPerDay
        )
        return daysLeft <= 7
      })
      const urgentSet = new Set(urgentIds)
      const regularIds = orderedSubjectIds.filter((sid) => !urgentSet.has(sid))
      const slotsForRegular = Math.max(0, limit - urgentIds.length)
      orderedSubjectIds = [...urgentIds, ...regularIds.slice(0, slotsForRegular)]
    }

    // ── Round-robin across active subjects ───────────────────────────────
    const subjectMinutesToday = new Map<string, number>()
    const multipleSubjects = orderedSubjectIds.length > 1
    const maxPerSubjectMinutes = multipleSubjects
      ? Math.ceil(day.capacity * 0.6)
      : Infinity

    let placedThisRound = true
    while (day.remainingMinutes > 0 && placedThisRound) {
      if (safetyCounter++ > SAFETY_LIMIT) break
      placedThisRound = false

      for (const sid of orderedSubjectIds) {
        if (day.remainingMinutes <= 0) break

        const subjectUsed = subjectMinutesToday.get(sid) ?? 0
        if (subjectUsed >= maxPerSubjectMinutes) continue

        const state = getActiveTopic(sid, day.date)
        if (!state) continue
        if (hasEarlierUnfinishedTopic(sid, state)) continue

        const sessionLen = state.unit.session_length_minutes
        if (day.remainingMinutes < sessionLen) continue
        if (subjectUsed + sessionLen > maxPerSubjectMinutes && subjectUsed > 0) continue

        placeSession(state, day.date)
        day.remainingMinutes -= sessionLen
        subjectMinutesToday.set(sid, subjectUsed + sessionLen)

        if (state.coreRemaining <= 0) {
          const next = getActiveTopic(sid, day.date)
          if (next) activeTopicBySubject.set(sid, next)
          else activeTopicBySubject.delete(sid)
        }

        placedThisRound = true
      }
    }
  }

  // ── Overflow recovery pass ──────────────────────────────────────────────
  // Topics that missed their deadline window because earlier topics in the
  // same subject consumed the available days. These are identified by having
  // at least one completed predecessor in their subject. Deadlines are
  // relaxed; earliest_start is still respected.
  let overflowPlaced = true
  let overflowRounds = 0
  const MAX_OVERFLOW_ROUNDS = totalPossibleSessions + 1

  while (overflowPlaced && overflowRounds++ < MAX_OVERFLOW_ROUNDS) {
    overflowPlaced = false
    refreshDeps()

    const candidates: UnitState[] = []
    for (const [, topicList] of subjectTopics) {
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
        break // only first unfinished per subject
      }
    }

    if (candidates.length === 0) break

    // Most urgent overflow candidates first
    candidates.sort(
      (a, b) =>
        b.coreRemaining / Math.max(1, b.coreSessions) -
        a.coreRemaining / Math.max(1, a.coreSessions)
    )

    for (const state of candidates) {
      for (const day of daySlots) {
        if (state.coreRemaining <= 0) break
        if (day.remainingMinutes < state.unit.session_length_minutes) continue
        const start = state.unit.earliest_start ?? constraints.study_start_date
        if (day.date < start) continue
        if (hasEarlierUnfinishedTopic(state.unit.subject_id, state)) continue

        placeSession(state, day.date)
        day.remainingMinutes -= state.unit.session_length_minutes
        overflowPlaced = true
      }
    }
  }

  // ── Stable sort: by date, then by original subject order ───────────────
  const subjectOrderIdx = new Map(subjectOrder.map((sid, i) => [sid, i]))
  sessions.sort((a, b) => {
    const dateCmp = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCmp !== 0) return dateCmp
    return (subjectOrderIdx.get(a.subject_id) ?? 0) - (subjectOrderIdx.get(b.subject_id) ?? 0)
  })

  return sessions
}

