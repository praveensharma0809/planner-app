import type {
  PlannableUnit,
  GlobalConstraints,
  ScheduledSession,
} from "./types"
import { buildDaySlots } from "./feasibility"

interface UnitState {
  unit: PlannableUnit
  coreSessions: number
  revisionSessions: number
  practiceSessions: number
  coreRemaining: number
  practiceRemaining: number
  totalCoreScheduled: number
  depsComplete: boolean
}

function computeUrgency(state: UnitState, currentDate: string): number {
  const deadline = state.unit.deadline
  const msPerDay = 86_400_000
  const daysLeft = Math.max(
    1,
    Math.ceil(
      (new Date(deadline).getTime() - new Date(currentDate).getTime()) / msPerDay
    )
  )
  return (state.coreRemaining + state.practiceRemaining) / daysLeft * (6 - state.unit.priority)
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

export function schedule(
  units: PlannableUnit[],
  constraints: GlobalConstraints,
  offDays: Set<string>
): ScheduledSession[] {
  if (units.length === 0) return []
  if (detectCircularDeps(units)) return []

  const sessionLength = constraints.session_length_minutes
  const daySlots = buildDaySlots(constraints, offDays)
  if (daySlots.length === 0) return []

  // Build unit states
  const states: UnitState[] = units
    .filter((u) => u.estimated_minutes > 0)
    .map((u) => {
      const core = Math.ceil(u.estimated_minutes / sessionLength)
      return {
        unit: u,
        coreSessions: core,
        revisionSessions: u.revision_sessions,
        practiceSessions: u.practice_sessions,
        coreRemaining: core,
        practiceRemaining: u.practice_sessions,
        totalCoreScheduled: 0,
        depsComplete: u.depends_on.length === 0,
      }
    })

  const completedUnits = new Set<string>()
  const sessions: ScheduledSession[] = []

  function refreshDeps() {
    for (const s of states) {
      if (s.unit.depends_on.length === 0) {
        s.depsComplete = true
      } else {
        s.depsComplete = s.unit.depends_on.every((d) => completedUnits.has(d))
      }
    }
  }

  // Core + practice scheduling pass
  for (const day of daySlots) {
    refreshDeps()

    // Sort by urgency for this day
    const eligible = states
      .filter((s) => {
        if (s.coreRemaining + s.practiceRemaining <= 0) return false
        if (!s.depsComplete) return false
        const start = s.unit.earliest_start ?? constraints.study_start_date
        if (day.date < start) return false
        if (day.date > s.unit.deadline) return false
        return true
      })
      .sort((a, b) => computeUrgency(b, day.date) - computeUrgency(a, day.date))

    for (const state of eligible) {
      while (day.remainingSlots > 0 && state.coreRemaining > 0) {
        sessions.push({
          subject_id: state.unit.subject_id,
          topic_id: state.unit.id,
          title: `${state.unit.subject_name} – ${state.unit.topic_name}`,
          scheduled_date: day.date,
          duration_minutes: sessionLength,
          session_type: "core",
          priority: state.unit.priority,
        })
        state.coreRemaining--
        state.totalCoreScheduled++
        day.remainingSlots--
      }

      // Interleave practice sessions: 1 practice every N core sessions
      if (
        state.practiceSessions > 0 &&
        state.coreSessions > 0 &&
        state.practiceRemaining > 0 &&
        day.remainingSlots > 0
      ) {
        const interval = Math.max(
          1,
          Math.floor(state.coreSessions / (state.practiceSessions + 1))
        )
        if (
          state.totalCoreScheduled > 0 &&
          state.totalCoreScheduled % interval === 0
        ) {
          sessions.push({
            subject_id: state.unit.subject_id,
            topic_id: state.unit.id,
            title: `${state.unit.subject_name} – ${state.unit.topic_name} (Practice)`,
            scheduled_date: day.date,
            duration_minutes: sessionLength,
            session_type: "practice",
            priority: state.unit.priority,
          })
          state.practiceRemaining--
          day.remainingSlots--
        }
      }

      if (state.coreRemaining <= 0 && state.practiceRemaining <= 0) {
        completedUnits.add(state.unit.id)
      }
    }
  }

  // Schedule remaining practice sessions
  for (const state of states) {
    if (state.practiceRemaining <= 0) continue
    for (const day of daySlots) {
      if (day.remainingSlots <= 0) continue
      if (day.date > state.unit.deadline) continue
      const start = state.unit.earliest_start ?? constraints.study_start_date
      if (day.date < start) continue

      while (day.remainingSlots > 0 && state.practiceRemaining > 0) {
        sessions.push({
          subject_id: state.unit.subject_id,
          topic_id: state.unit.id,
          title: `${state.unit.subject_name} – ${state.unit.topic_name} (Practice)`,
          scheduled_date: day.date,
          duration_minutes: sessionLength,
          session_type: "practice",
          priority: state.unit.priority,
        })
        state.practiceRemaining--
        day.remainingSlots--
      }
    }
    if (state.practiceRemaining <= 0) {
      completedUnits.add(state.unit.id)
    }
  }

  // Revision scheduling: place in last third of each unit's window
  for (const state of states) {
    if (state.revisionSessions <= 0) continue

    const start = state.unit.earliest_start ?? constraints.study_start_date
    const unitDays = daySlots.filter(
      (d) => d.date >= start && d.date <= state.unit.deadline
    )
    if (unitDays.length === 0) continue

    const revisionStart = Math.floor(unitDays.length * (2 / 3))
    const revisionWindow = unitDays.slice(revisionStart)

    let remaining = state.revisionSessions
    const spacing = Math.max(1, Math.floor(revisionWindow.length / remaining))

    for (
      let i = 0;
      i < revisionWindow.length && remaining > 0;
      i += spacing
    ) {
      const day = revisionWindow[i]
      if (day.remainingSlots <= 0) continue

      sessions.push({
        subject_id: state.unit.subject_id,
        topic_id: state.unit.id,
        title: `${state.unit.subject_name} – ${state.unit.topic_name} (Revision)`,
        scheduled_date: day.date,
        duration_minutes: sessionLength,
        session_type: "revision",
        priority: state.unit.priority,
      })
      day.remainingSlots--
      remaining--
    }

    // Place any remaining revision sessions in available slots
    for (const day of revisionWindow) {
      if (remaining <= 0) break
      while (day.remainingSlots > 0 && remaining > 0) {
        sessions.push({
          subject_id: state.unit.subject_id,
          topic_id: state.unit.id,
          title: `${state.unit.subject_name} – ${state.unit.topic_name} (Revision)`,
          scheduled_date: day.date,
          duration_minutes: sessionLength,
          session_type: "revision",
          priority: state.unit.priority,
        })
        day.remainingSlots--
        remaining--
      }
    }
  }

  // Sort final schedule by date
  sessions.sort((a, b) => (a.scheduled_date > b.scheduled_date ? 1 : -1))

  return sessions
}
