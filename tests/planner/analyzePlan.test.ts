/// <reference types="vitest/globals" />

import { analyzePlan, type AnalyzePlanStatus } from "@/lib/planner/analyzePlan"
import type { Subject } from "@/lib/types/db"

type OverloadStatus = Extract<AnalyzePlanStatus, { status: "OVERLOAD" }>
type ReadyStatus    = Extract<AnalyzePlanStatus, { status: "READY" }>

function buildSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: "subject-1",
    user_id: "user-1",
    name: "Calculus",
    total_items: 6,
    completed_items: 0,
    avg_duration_minutes: 60,
    deadline: "2024-01-05",
    priority: 1,
    mandatory: false,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides
  }
}

describe("analyzePlan", () => {
  const today = new Date("2024-01-01T00:00:00Z")

  it("returns OVERLOAD in strict mode when required work exceeds capacity", () => {
    const subjects = [
      buildSubject({
        total_items: 8,
        avg_duration_minutes: 120,
        deadline: "2024-01-02"
      })
    ]

    const result = analyzePlan(subjects, 60, today, "strict")

    expect(result.status).toBe("OVERLOAD")
    expect((result as OverloadStatus).overload).toBe(true)
  })

  it("returns READY in auto mode even when overload is detected", () => {
    const subjects = [
      buildSubject({
        total_items: 4,
        avg_duration_minutes: 60,
        deadline: "2024-01-02"
      })
    ]

    const result = analyzePlan(subjects, 60, today, "auto")

    expect(result.status).toBe("READY")
    expect((result as ReadyStatus).overload.overload).toBe(true)
    expect((result as ReadyStatus).tasks.length).toBeGreaterThan(0)
  })
})

