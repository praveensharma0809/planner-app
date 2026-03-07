import type {
  PlannableUnit,
  GlobalConstraints,
  DaySlot,
  FeasibilityResult,
  UnitFeasibility,
  UnitFeasibilityStatus,
  FeasibilitySuggestion,
} from "./types"

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function buildDaySlots(
  constraints: GlobalConstraints,
  offDays: Set<string>
): DaySlot[] {
  const start = new Date(constraints.study_start_date)
  const revisionCutoff = addDays(
    new Date(constraints.exam_date),
    -constraints.final_revision_days
  )
  const bufferMultiplier = 1 - constraints.buffer_percentage / 100
  const slots: DaySlot[] = []

  let cursor = new Date(start)
  while (cursor <= revisionCutoff) {
    const iso = toISO(cursor)
    if (!offDays.has(iso)) {
      const weekend = isWeekend(cursor)
      const rawCapacity = weekend
        ? constraints.weekend_capacity_minutes
        : constraints.weekday_capacity_minutes
      const effectiveCapacity = Math.floor(rawCapacity * bufferMultiplier)
      const maxSlots = Math.floor(
        effectiveCapacity / constraints.session_length_minutes
      )
      if (maxSlots > 0) {
        slots.push({
          date: iso,
          capacity: effectiveCapacity,
          maxSlots,
          remainingSlots: maxSlots,
          isWeekend: weekend,
        })
      }
    }
    cursor = addDays(cursor, 1)
  }

  return slots
}

function classifyUnit(
  totalSessions: number,
  availableSlots: number
): UnitFeasibilityStatus {
  if (availableSlots <= 0 || totalSessions > availableSlots) return "impossible"
  const ratio = totalSessions / availableSlots
  if (ratio <= 0.8) return "safe"
  if (ratio <= 0.9) return "tight"
  return "at_risk"
}

function buildUnitSuggestions(
  unit: PlannableUnit,
  totalSessions: number,
  availableSlots: number,
  sessionLength: number,
  avgDailySlotsForUnit: number
): FeasibilitySuggestion[] {
  const suggestions: FeasibilitySuggestion[] = []
  const gap = totalSessions - availableSlots
  if (gap <= 0) return suggestions

  // suggest extending deadline
  if (avgDailySlotsForUnit > 0) {
    const extraDays = Math.ceil(gap / avgDailySlotsForUnit)
    suggestions.push({
      kind: "extend_deadline",
      message: `Extend deadline for "${unit.topic_name}" by ${extraDays} day(s)`,
      value: extraDays,
    })
  }

  // suggest reducing effort
  const reduceHours = Math.ceil((gap * sessionLength) / 60)
  suggestions.push({
    kind: "reduce_effort",
    message: `Reduce effort for "${unit.topic_name}" by ${reduceHours} hour(s) (${gap} session(s))`,
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
  const sessionLength = constraints.session_length_minutes
  const totalSlotsAvailable = daySlots.reduce((s, d) => s + d.maxSlots, 0)

  let totalSessionsNeeded = 0
  const unitResults: UnitFeasibility[] = []

  for (const unit of units) {
    if (unit.estimated_minutes <= 0) continue

    const coreSessions = Math.ceil(unit.estimated_minutes / sessionLength)
    const allSessions =
      coreSessions + unit.revision_sessions + unit.practice_sessions
    totalSessionsNeeded += allSessions

    // Count slots available for this unit (respecting its date window)
    const unitStart = unit.earliest_start ?? constraints.study_start_date
    const unitEnd = unit.deadline
    let availableSlots = 0
    for (const slot of daySlots) {
      if (slot.date >= unitStart && slot.date <= unitEnd) {
        availableSlots += slot.maxSlots
      }
    }

    const status = classifyUnit(allSessions, availableSlots)

    const avgDailySlots =
      daySlots.length > 0 ? totalSlotsAvailable / daySlots.length : 0
    const suggestions = buildUnitSuggestions(
      unit,
      allSessions,
      availableSlots,
      sessionLength,
      avgDailySlots
    )

    unitResults.push({
      unitId: unit.id,
      name: unit.topic_name,
      deadline: unitEnd,
      totalSessions: allSessions,
      availableSlots,
      status,
      suggestions,
    })
  }

  const globalGap = Math.max(0, totalSessionsNeeded - totalSlotsAvailable)
  const feasible = globalGap === 0 && unitResults.every((u) => u.status !== "impossible")

  const globalSuggestions: FeasibilitySuggestion[] = []
  if (globalGap > 0) {
    // how much extra capacity per day to cover the gap
    const activeDays = daySlots.length || 1
    const extraMinutesPerDay = Math.ceil(
      (globalGap * sessionLength) / activeDays
    )
    globalSuggestions.push({
      kind: "increase_capacity",
      message: `Increase daily study time by ${extraMinutesPerDay} minutes`,
      value: extraMinutesPerDay,
    })

    const avgDailySlots = totalSlotsAvailable / activeDays
    if (avgDailySlots > 0) {
      const extraDays = Math.ceil(globalGap / avgDailySlots)
      globalSuggestions.push({
        kind: "extend_deadline",
        message: `Extend exam date by ${extraDays} day(s)`,
        value: extraDays,
      })
    }

    const reduceHours = Math.ceil((globalGap * sessionLength) / 60)
    globalSuggestions.push({
      kind: "reduce_effort",
      message: `Reduce total effort by ${reduceHours} hour(s)`,
      value: reduceHours,
    })
  }

  return {
    feasible,
    totalSessionsNeeded,
    totalSlotsAvailable,
    globalGap,
    units: unitResults,
    suggestions: globalSuggestions,
  }
}
