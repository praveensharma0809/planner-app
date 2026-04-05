import { describe, it, expect } from "vitest"
import { generatePlan } from "@/lib/planner/engine"
import type { GlobalConstraints, PlannableUnit } from "@/lib/planner/engine"

function buildUnit(overrides: Partial<PlannableUnit> = {}): PlannableUnit {
  return {
    id: "topic-1",
    subject_id: "subject-1",
    subject_name: "Physics",
    topic_name: "Kinematics",
    estimated_minutes: 120,
    session_length_minutes: 60,
    deadline: "2024-01-05",
    depends_on: [],
    ...overrides,
  }
}

const baseConstraints: GlobalConstraints = {
  study_start_date: "2024-01-01",
  exam_date: "2024-01-05",
  weekday_capacity_minutes: 120,
  weekend_capacity_minutes: 120,
  plan_order: "balanced" as const,
  final_revision_days: 0,
  buffer_percentage: 0,
  max_active_subjects: 0,
}

describe("generatePlan", () => {
  it("returns NO_UNITS when there is nothing to plan", () => {
    const result = generatePlan({
      units: [],
      constraints: baseConstraints,
      offDays: new Set<string>(),
    })

    expect(result).toEqual({ status: "NO_UNITS" })
  })

  it("returns INFEASIBLE when capacity is zero", () => {
    const result = generatePlan({
      units: [buildUnit()],
      constraints: {
        ...baseConstraints,
        weekday_capacity_minutes: 0,
        weekend_capacity_minutes: 0,
      },
      offDays: new Set<string>(),
    })

    // Zero capacity → no day slots → 0 sessions → INFEASIBLE
    expect(result.status).toBe("INFEASIBLE")
    if (result.status === "INFEASIBLE") {
      expect(result.feasibility.globalGap).toBeGreaterThan(0)
    }
  })

  it("returns READY with scheduled sessions when feasible", () => {
    const result = generatePlan({
      units: [buildUnit()],
      constraints: baseConstraints,
      offDays: new Set<string>(),
    })

    expect(result.status).toBe("READY")
    if (result.status === "READY") {
      expect(result.schedule.length).toBe(2)
      expect(result.schedule.every((s) => s.session_type === "core")).toBe(true)
      expect(result.feasibility.feasible).toBe(true)
    }
  })

  it("returns PARTIAL when some sessions can be placed but not the full plan", () => {
    const result = generatePlan({
      units: [buildUnit({ estimated_minutes: 180, deadline: "2024-01-02" })],
      constraints: {
        ...baseConstraints,
        exam_date: "2024-01-02",
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
      },
      offDays: new Set<string>(),
    })

    expect(result.status).toBe("PARTIAL")
    if (result.status === "PARTIAL") {
      expect(result.schedule).toHaveLength(2)
      expect(result.droppedSessions).toBe(1)
      expect(result.feasibility.feasible).toBe(false)
    }
  })

  it("returns READY with flexFeasible when base capacity is short but flex closes the gap", () => {
    const result = generatePlan({
      units: [
        buildUnit({ id: "topic-1", estimated_minutes: 120, deadline: "2024-01-03" }),
        buildUnit({
          subject_id: "subject-2",
          subject_name: "Chemistry",
          id: "topic-2",
          topic_name: "Dynamics",
          estimated_minutes: 60,
          deadline: "2024-01-03",
        }),
      ],
      constraints: {
        ...baseConstraints,
        exam_date: "2024-01-03",
        weekday_capacity_minutes: 50,
        weekend_capacity_minutes: 50,
        flexibility_minutes: 10,
      },
      offDays: new Set<string>(),
    })

    expect(result.status).toBe("READY")
    if (result.status === "READY") {
      expect(result.schedule).toHaveLength(3)
      expect(result.feasibility.feasible).toBe(false)
      expect(result.feasibility.flexFeasible).toBe(true)
    }
  })
})
