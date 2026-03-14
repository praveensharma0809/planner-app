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

/**
 * Build the array of usable study days with base + flex capacity.
 *
 * Capacity resolution order (highest priority first):
 *   1. Custom day capacity for a specific date
 *   2. Per-day-of-week override
 *   3. Weekend / weekday default
 *
 * Buffer percentage is deprecated and intentionally ignored.
 * Base capacity is always explicit user capacity; flex extends from there.
 */
export function buildDaySlots(
  constraints: GlobalConstraints,
  offDays: Set<string>
): DaySlot[] {
  const start = new Date(constraints.study_start_date)
  // Backward compat: if final_revision_days is set, subtract from exam date
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
      const dayOfWeek = cursor.getDay() // 0 = Sun, 6 = Sat

      // Resolve raw capacity with priority chain
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

      // A user-assigned 0-capacity day must remain non-study even with flexibility.
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
  const totalBaseAvailable = daySlots.reduce((s, d) => s + d.capacity, 0)
  const totalFlexAvailable = daySlots.reduce((s, d) => s + d.flexCapacity, 0)

  let totalMinutesNeeded = 0
  const unitResults: UnitFeasibility[] = []

  for (const unit of units) {
    if (unit.estimated_minutes <= 0) continue

    const sessionsNeeded = Math.ceil(
      unit.estimated_minutes / unit.session_length_minutes
    )
    const minutesNeeded = sessionsNeeded * unit.session_length_minutes
    totalMinutesNeeded += minutesNeeded

    // Sum available minutes within this unit's own date window
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
    const suggestions = buildUnitSuggestions(
      unit,
      minutesNeeded,
      availableMinutes,
      avgDailyCapacity
    )

    unitResults.push({
      unitId: unit.id,
      name: unit.topic_name,
      deadline: unitEnd,
      totalSessions: sessionsNeeded,
      availableMinutes,
      status,
      suggestions,
    })
  }

  const globalGap = Math.max(0, totalMinutesNeeded - totalBaseAvailable)
  const feasible = globalGap === 0 && unitResults.every((u) => u.status !== "impossible")
  const flexFeasible =
    !feasible &&
    totalMinutesNeeded <= totalFlexAvailable &&
    unitResults.every((u) => u.status !== "impossible")

  const globalSuggestions: FeasibilitySuggestion[] = []
  if (globalGap > 0) {
    const activeDays = daySlots.length || 1
    const extraMinutesPerDay = Math.ceil(globalGap / activeDays)
    globalSuggestions.push({
      kind: "increase_capacity",
      message: `Increase daily study time by ${extraMinutesPerDay} minutes`,
      value: extraMinutesPerDay,
    })

    const avgDailyCapacity = totalBaseAvailable / activeDays
    if (avgDailyCapacity > 0) {
      const extraDays = Math.ceil(globalGap / avgDailyCapacity)
      globalSuggestions.push({
        kind: "extend_deadline",
        message: `Extend deadline by ${extraDays} day(s)`,
        value: extraDays,
      })
    }

    const reduceHours = Math.ceil(globalGap / 60)
    globalSuggestions.push({
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
    suggestions: globalSuggestions,
  }
}
