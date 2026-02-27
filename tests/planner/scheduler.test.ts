/// <reference types="vitest" />

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
})
