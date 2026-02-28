import type { Subject } from "@/lib/types/db"

export type SubjectFeasibilityStatus =
  | "safe"
  | "tight"
  | "at_risk"
  | "impossible"

export interface AdjustmentSuggestion {
  extendDeadlineDays?: number
  reduceItemsBy?: number
  increaseDailyMinutesBy?: number
}

export interface SubjectFeasibility {
  subjectId: string
  name: string
  effectiveDeadline: string
  availableDays: number
  totalRemainingMinutes: number
  requiredMinutesPerDay: number
  capacityGapMinutesPerDay: number
  status: SubjectFeasibilityStatus
  suggestions: AdjustmentSuggestion
}

export interface OverloadResult {
  overload: boolean
  burnRate: number
  currentCapacity: number
  suggestedCapacity: number
  subjects: SubjectFeasibility[]
  totalRequiredMinPerDay: number
  availableMinPerDay: number
  capacityGapMinPerDay: number
  overallStatus: "feasible" | "overloaded"
}

function countAvailableDays(start: Date, end: Date, offDays: Set<string>): number {
  // Inclusive of start and end; skips dates present in offDays (ISO yyyy-mm-dd)
  const cursor = new Date(start)
  let days = 0

  while (cursor <= end) {
    const iso = cursor.toISOString().split("T")[0]
    if (!offDays.has(iso)) {
      days += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function classify(required: number, capacity: number): SubjectFeasibilityStatus {
  if (!isFinite(required) || capacity <= 0) return "impossible"
  if (required <= capacity) return "safe"
  if (required <= capacity * 1.1) return "tight"
  if (required <= capacity * 1.25) return "at_risk"
  return "impossible"
}

export function overloadAnalyzer(
  subjects: Subject[],
  dailyAvailableMinutes: number,
  today: Date,
  examDate?: string | null,
  offDays: Set<string> = new Set()
): OverloadResult {
  const active = subjects.filter(s => s.total_items - s.completed_items > 0)

  if (active.length === 0) {
    return {
      overload: false,
      burnRate: 0,
      currentCapacity: dailyAvailableMinutes,
      suggestedCapacity: dailyAvailableMinutes,
      subjects: [],
      totalRequiredMinPerDay: 0,
      availableMinPerDay: dailyAvailableMinutes,
      capacityGapMinPerDay: 0,
      overallStatus: "feasible"
    }
  }

  const subjectsFeasibility: SubjectFeasibility[] = []
  let totalRequiredMinPerDay = 0
  let maxEffectiveDeadline = today

  for (const subject of active) {
    const remainingItems = subject.total_items - subject.completed_items
    const totalRemainingMinutes = remainingItems * subject.avg_duration_minutes

    const parsedSubjectDeadline = new Date(subject.deadline)
    const subjectDeadline = isNaN(parsedSubjectDeadline.getTime()) ? today : parsedSubjectDeadline

    const parsedExamDeadline = examDate ? new Date(examDate) : undefined
    const examDeadlineValid = parsedExamDeadline && !isNaN(parsedExamDeadline.getTime())

    const effectiveDeadline = examDeadlineValid
      ? new Date(Math.min(subjectDeadline.getTime(), parsedExamDeadline!.getTime()))
      : subjectDeadline

    if (effectiveDeadline > maxEffectiveDeadline) {
      maxEffectiveDeadline = effectiveDeadline
    }

    const availableDays = countAvailableDays(today, effectiveDeadline, offDays)
    const requiredMinutesPerDay =
      availableDays > 0 ? totalRemainingMinutes / availableDays : Number.POSITIVE_INFINITY
    const capacityGapMinutesPerDay = Math.max(0, requiredMinutesPerDay - dailyAvailableMinutes)
    const status = classify(requiredMinutesPerDay, dailyAvailableMinutes)

    const requiredDaysAtCapacity =
      dailyAvailableMinutes > 0 ? Math.ceil(totalRemainingMinutes / dailyAvailableMinutes) : Number.POSITIVE_INFINITY
    const extendDeadlineDays = isFinite(requiredDaysAtCapacity)
      ? Math.max(0, requiredDaysAtCapacity - availableDays)
      : undefined

    const reduceItemsBy = subject.avg_duration_minutes > 0 && availableDays > 0 && capacityGapMinutesPerDay > 0
      ? Math.ceil((capacityGapMinutesPerDay * availableDays) / subject.avg_duration_minutes)
      : undefined

    const increaseDailyMinutesBy = capacityGapMinutesPerDay > 0
      ? Math.ceil(capacityGapMinutesPerDay)
      : undefined

    subjectsFeasibility.push({
      subjectId: subject.id,
      name: subject.name,
      effectiveDeadline: effectiveDeadline.toISOString().split("T")[0],
      availableDays,
      totalRemainingMinutes,
      requiredMinutesPerDay,
      capacityGapMinutesPerDay,
      status,
      suggestions: {
        extendDeadlineDays: extendDeadlineDays && extendDeadlineDays > 0 ? extendDeadlineDays : undefined,
        reduceItemsBy,
        increaseDailyMinutesBy
      }
    })

    if (isFinite(requiredMinutesPerDay)) {
      totalRequiredMinPerDay += requiredMinutesPerDay
    }
  }

  const burnRate = totalRequiredMinPerDay
  const capacityGapMinPerDay = Math.max(0, totalRequiredMinPerDay - dailyAvailableMinutes)
  const overload = capacityGapMinPerDay > 0 || subjectsFeasibility.some(s => s.status === "impossible")

  return {
    overload,
    burnRate,
    currentCapacity: dailyAvailableMinutes,
    suggestedCapacity: Math.max(dailyAvailableMinutes, Math.ceil(totalRequiredMinPerDay)),
    subjects: subjectsFeasibility,
    totalRequiredMinPerDay,
    availableMinPerDay: dailyAvailableMinutes,
    capacityGapMinPerDay,
    overallStatus: overload ? "overloaded" : "feasible"
  }
}
  