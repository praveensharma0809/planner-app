import { describe, it, expect } from "vitest"
import { checkFeasibility } from "@/lib/planner/engine"
import type { GlobalConstraints, PlannableUnit } from "@/lib/planner/engine"

function buildUnit(overrides: Partial<PlannableUnit> = {}): PlannableUnit {
  return {
    id: "topic-1",
    subject_id: "subject-1",
    subject_name: "Biology",
    topic_name: "Genetics",
    estimated_minutes: 120,
    session_length_minutes: 60,
    priority: 2,
    deadline: "2024-01-03",
    depends_on: [],
    ...overrides,
  }
}

const baseConstraints: GlobalConstraints = {
  study_start_date: "2024-01-01",
  exam_date: "2024-01-03",
  weekday_capacity_minutes: 120,
  weekend_capacity_minutes: 120,
  plan_order: "balanced" as const,
  final_revision_days: 0,
  buffer_percentage: 0,
  max_active_subjects: 0,
}

describe("checkFeasibility", () => {
  it("returns feasible when capacity covers all sessions", () => {
    const result = checkFeasibility(
      [buildUnit({ estimated_minutes: 120 })],
      baseConstraints,
      new Set<string>()
    )

    expect(result.feasible).toBe(true)
    expect(result.globalGap).toBe(0)
  })

  it("returns infeasible when a unit has no available slots", () => {
    const result = checkFeasibility(
      [buildUnit({ estimated_minutes: 240, deadline: "2023-12-31" })],
      baseConstraints,
      new Set<string>()
    )

    expect(result.feasible).toBe(false)
    expect(result.units[0].status).toBe("impossible")
  })

  it("shows higher gap when off-days remove available capacity", () => {
    const units = [buildUnit({ estimated_minutes: 360 })]

    const withoutOffDays = checkFeasibility(units, baseConstraints, new Set<string>())
    const withOffDays = checkFeasibility(
      units,
      baseConstraints,
      new Set(["2024-01-02", "2024-01-03"])
    )

    expect(withOffDays.totalSlotsAvailable).toBeLessThan(withoutOffDays.totalSlotsAvailable)
    expect(withOffDays.globalGap).toBeGreaterThanOrEqual(withoutOffDays.globalGap)
  })

  it("provides global suggestions when plan is infeasible", () => {
    const result = checkFeasibility(
      [buildUnit({ estimated_minutes: 1000, deadline: "2024-01-03" })],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
      },
      new Set<string>()
    )

    expect(result.feasible).toBe(false)
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.some((s) => s.kind === "increase_capacity")).toBe(true)
  })
})
