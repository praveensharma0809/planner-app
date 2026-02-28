/// <reference types="vitest/globals" />

import { scheduler } from "@/lib/planner/scheduler"
import type { Subject } from "@/lib/types/db"

function buildSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: "subject-1",
    user_id: "user-1",
    name: "Physics",
    total_items: 3,
    completed_items: 0,
    avg_duration_minutes: 60,
    deadline: "2024-01-10",
    priority: 1,
    mandatory: false,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides
  }
}

describe("scheduler", () => {
  const today = new Date("2024-01-01T00:00:00Z")

  it("never schedules past the exam date", () => {
    const examDate = "2024-01-03"
    const result = scheduler(
      [buildSubject({ total_items: 5, deadline: "2024-01-08" })],
      180,
      today,
      { examDeadline: examDate }
    )

    const scheduledDates = result.tasks.map(task => task.scheduled_date)
    expect(scheduledDates.every(date => date <= examDate)).toBe(true)
  })

  it("skips off-days when creating tasks", () => {
    const offDay = "2024-01-02"
    const result = scheduler(
      [buildSubject({ total_items: 3, deadline: "2024-01-05" })],
      60,
      today,
      { offDays: new Set([offDay]) }
    )

    const scheduledDates = result.tasks.map(task => task.scheduled_date)
    expect(scheduledDates).not.toContain(offDay)
  })

  it("returns empty tasks when all subjects are complete", () => {
    const result = scheduler(
      [buildSubject({ total_items: 5, completed_items: 5 })],
      180,
      today
    )
    expect(result.tasks).toEqual([])
  })

  it("returns empty tasks when subjects list is empty", () => {
    const result = scheduler([], 180, today)
    expect(result.tasks).toEqual([])
  })

  it("schedules tasks for a single day when only one day is available", () => {
    const result = scheduler(
      [buildSubject({ total_items: 2, avg_duration_minutes: 30, deadline: "2024-01-01" })],
      120,
      today
    )
    // All tasks on the same day (today)
    const dates = new Set(result.tasks.map(t => t.scheduled_date))
    expect(dates.size).toBe(1)
    expect(dates.has("2024-01-01")).toBe(true)
  })

  it("handles multiple subjects and interleaves by urgency", () => {
    const subjectA = buildSubject({
      id: "a",
      name: "Urgent",
      total_items: 2,
      avg_duration_minutes: 30,
      deadline: "2024-01-02",
      priority: 1,
      mandatory: true,
    })
    const subjectB = buildSubject({
      id: "b",
      name: "Relaxed",
      total_items: 2,
      avg_duration_minutes: 30,
      deadline: "2024-01-10",
      priority: 2,
      mandatory: false,
    })
    const result = scheduler([subjectA, subjectB], 120, today)
    // Mandatory/closer deadline subject should appear first
    expect(result.tasks[0].subject_id).toBe("a")
    expect(result.tasks.length).toBeGreaterThanOrEqual(4)
  })

  it("does not exceed daily capacity", () => {
    const result = scheduler(
      [buildSubject({ total_items: 10, avg_duration_minutes: 60, deadline: "2024-01-05" })],
      120,
      today
    )
    // Group tasks by date and check no day exceeds 120 min
    const byDay = new Map<string, number>()
    for (const t of result.tasks) {
      byDay.set(t.scheduled_date, (byDay.get(t.scheduled_date) ?? 0) + t.duration_minutes)
    }
    for (const [, totalMin] of byDay) {
      expect(totalMin).toBeLessThanOrEqual(120)
    }
  })

  it("handles off-days covering entire scheduling range gracefully", () => {
    const offDays = new Set(["2024-01-01", "2024-01-02", "2024-01-03"])
    const result = scheduler(
      [buildSubject({ total_items: 2, deadline: "2024-01-03" })],
      120,
      today,
      { offDays }
    )
    // With all days blocked before/on deadline, no tasks can be scheduled
    expect(result.tasks).toEqual([])
  })

  it("assigns correct priority from subject to tasks", () => {
    const result = scheduler(
      [buildSubject({ priority: 3, total_items: 1, deadline: "2024-01-05" })],
      180,
      today
    )
    expect(result.tasks.length).toBe(1)
    expect(result.tasks[0].priority).toBe(3)
  })
})
