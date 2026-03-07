import { describe, it, expect } from "vitest"
import { schedule } from "@/lib/planner/scheduler"
import type { GlobalConstraints, PlannableUnit } from "@/lib/planner/types"

function buildUnit(overrides: Partial<PlannableUnit> = {}): PlannableUnit {
  return {
    id: "topic-1",
    subject_id: "subject-1",
    subject_name: "Physics",
    topic_name: "Mechanics",
    estimated_minutes: 180,
    priority: 2,
    deadline: "2024-01-05",
    depends_on: [],
    revision_sessions: 0,
    practice_sessions: 0,
    ...overrides,
  }
}

const baseConstraints: GlobalConstraints = {
  study_start_date: "2024-01-01",
  exam_date: "2024-01-07",
  weekday_capacity_minutes: 120,
  weekend_capacity_minutes: 120,
  session_length_minutes: 60,
  final_revision_days: 0,
  buffer_percentage: 0,
}

describe("schedule", () => {
  it("returns empty schedule for empty units", () => {
    const result = schedule([], baseConstraints, new Set<string>())
    expect(result).toEqual([])
  })

  it("skips off-days when scheduling", () => {
    const offDay = "2024-01-02"
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-04" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set([offDay])
    )

    expect(result.map((t) => t.scheduled_date)).not.toContain(offDay)
  })

  it("never schedules sessions past a unit deadline", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 300, deadline: "2024-01-02" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.every((t) => t.scheduled_date <= "2024-01-02")).toBe(true)
  })

  it("respects earliest_start", () => {
    const result = schedule(
      [buildUnit({ earliest_start: "2024-01-03", estimated_minutes: 120 })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.every((t) => t.scheduled_date >= "2024-01-03")).toBe(true)
  })

  it("does not exceed daily capacity", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 600, deadline: "2024-01-05" })],
      { ...baseConstraints, weekday_capacity_minutes: 120, weekend_capacity_minutes: 120 },
      new Set<string>()
    )

    const byDay = new Map<string, number>()
    for (const s of result) {
      byDay.set(s.scheduled_date, (byDay.get(s.scheduled_date) ?? 0) + s.duration_minutes)
    }

    for (const totalMinutes of byDay.values()) {
      expect(totalMinutes).toBeLessThanOrEqual(120)
    }
  })

  it("prioritizes more urgent units first", () => {
    const urgent = buildUnit({
      id: "urgent",
      topic_name: "Urgent Topic",
      priority: 1,
      deadline: "2024-01-02",
      estimated_minutes: 60,
    })
    const relaxed = buildUnit({
      id: "relaxed",
      topic_name: "Relaxed Topic",
      priority: 5,
      deadline: "2024-01-07",
      estimated_minutes: 60,
    })

    const result = schedule(
      [relaxed, urgent],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result[0].topic_id).toBe("urgent")
  })

  it("returns empty schedule for circular dependencies", () => {
    const a = buildUnit({ id: "a", depends_on: ["b"], estimated_minutes: 60 })
    const b = buildUnit({ id: "b", depends_on: ["a"], estimated_minutes: 60 })

    const result = schedule([a, b], baseConstraints, new Set<string>())
    expect(result).toEqual([])
  })

  it("adds practice sessions when configured", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 120, practice_sessions: 1, deadline: "2024-01-01" })],
      {
        ...baseConstraints,
        study_start_date: "2024-01-01",
        exam_date: "2024-01-01",
        weekday_capacity_minutes: 180,
        weekend_capacity_minutes: 180,
      },
      new Set<string>()
    )

    expect(result.some((s) => s.session_type === "practice")).toBe(true)
  })
})
