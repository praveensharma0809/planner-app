/// <reference types="vitest/globals" />

import { overloadAnalyzer } from "@/lib/planner/overloadAnalyzer"
import type { Subject } from "@/lib/types/db"

function buildSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: "subject-1",
    user_id: "user-1",
    name: "Biology",
    total_items: 10,
    completed_items: 0,
    avg_duration_minutes: 30,
    deadline: "2024-01-15",
    priority: 1,
    mandatory: false,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("overloadAnalyzer", () => {
  const today = new Date("2024-01-01T00:00:00Z")

  it("returns feasible when no active subjects", () => {
    const result = overloadAnalyzer([], 60, today)
    expect(result.overload).toBe(false)
    expect(result.overallStatus).toBe("feasible")
    expect(result.subjects).toHaveLength(0)
  })

  it("returns feasible when capacity exceeds requirements", () => {
    const subjects = [
      buildSubject({
        total_items: 4,
        completed_items: 0,
        avg_duration_minutes: 30,
        deadline: "2024-01-15",
      }),
    ]

    const result = overloadAnalyzer(subjects, 120, today)
    expect(result.overload).toBe(false)
    expect(result.overallStatus).toBe("feasible")
    expect(result.subjects[0].status).toBe("safe")
    expect(result.capacityGapMinPerDay).toBe(0)
  })

  it("returns overloaded when capacity is far exceeded", () => {
    const subjects = [
      buildSubject({
        total_items: 100,
        completed_items: 0,
        avg_duration_minutes: 60,
        deadline: "2024-01-03", // 3 days to do 100 hours
      }),
    ]

    const result = overloadAnalyzer(subjects, 60, today)
    expect(result.overload).toBe(true)
    expect(result.overallStatus).toBe("overloaded")
    expect(result.subjects[0].status).toBe("impossible")
    expect(result.capacityGapMinPerDay).toBeGreaterThan(0)
  })

  it("filters out fully-completed subjects", () => {
    const subjects = [
      buildSubject({ total_items: 10, completed_items: 10 }),
      buildSubject({ id: "s2", name: "Active", total_items: 5, completed_items: 0 }),
    ]

    const result = overloadAnalyzer(subjects, 60, today)
    expect(result.subjects).toHaveLength(1)
    expect(result.subjects[0].name).toBe("Active")
  })

  it("skips off-days when counting available days", () => {
    const subjects = [
      buildSubject({
        total_items: 3,
        completed_items: 0,
        avg_duration_minutes: 60,
        deadline: "2024-01-05",
      }),
    ]

    const withoutOff = overloadAnalyzer(subjects, 60, today)
    const withOff = overloadAnalyzer(subjects, 60, today, null, new Set(["2024-01-02", "2024-01-03"]))

    // Fewer available days → higher required min/day
    expect(withOff.subjects[0].requiredMinutesPerDay).toBeGreaterThan(
      withoutOff.subjects[0].requiredMinutesPerDay
    )
  })

  it("clamps subject deadline to exam date", () => {
    const subjects = [
      buildSubject({ deadline: "2024-01-20" }),
    ]

    const result = overloadAnalyzer(subjects, 60, today, "2024-01-10")
    expect(result.subjects[0].effectiveDeadline).toBe("2024-01-10")
  })

  it("provides suggestions when overloaded", () => {
    const subjects = [
      buildSubject({
        total_items: 50,
        avg_duration_minutes: 60,
        deadline: "2024-01-05",
      }),
    ]

    const result = overloadAnalyzer(subjects, 60, today)
    const sub = result.subjects[0]
    expect(sub.suggestions.increaseDailyMinutesBy).toBeDefined()
    expect(sub.suggestions.increaseDailyMinutesBy!).toBeGreaterThan(0)
  })
})
