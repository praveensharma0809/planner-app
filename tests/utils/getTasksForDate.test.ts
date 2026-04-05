import { describe, expect, it } from "vitest"
import { getTasksForDate, getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

describe("getTasksForDate", () => {
  it("keeps canonical date-only strings stable", () => {
    expect(normalizeLocalDate("2026-04-05")).toBe("2026-04-05")
  })

  it("normalizes timestamp strings to local YYYY-MM-DD", () => {
    const source = "2026-04-05T00:00:00Z"
    const parsed = new Date(source)
    const expected = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`

    expect(normalizeLocalDate(source)).toBe(expected)
  })

  it("returns matching tasks using local-date normalization", () => {
    const timestampTaskDate = "2026-04-05T00:00:00Z"
    const localDay = normalizeLocalDate(timestampTaskDate)

    expect(localDay).not.toBeNull()

    const tasks = [
      { id: "task-a", scheduled_date: timestampTaskDate },
      { id: "task-b", scheduled_date: localDay },
      { id: "task-c", scheduled_date: "2026-04-10" },
      { id: "task-d", scheduled_date: null },
    ]

    const matching = getTasksForDate(tasks, localDay!)

    expect(matching.map((task) => task.id).sort()).toEqual(["task-a", "task-b"])
  })

  it("returns empty list for invalid target dates", () => {
    const tasks = [{ id: "task-a", scheduled_date: "2026-04-05" }]
    expect(getTasksForDate(tasks, "not-a-date")).toEqual([])
  })

  it("handles 11:30 PM and 12:30 AM timestamps on different local days", () => {
    const lateNight = new Date(2026, 0, 4, 23, 30, 0, 0)
    const afterMidnight = new Date(2026, 0, 5, 0, 30, 0, 0)

    const sunday = normalizeLocalDate(lateNight)
    const monday = normalizeLocalDate(afterMidnight)

    expect(sunday).toBe("2026-01-04")
    expect(monday).toBe("2026-01-05")

    const tasks = [
      { id: "late", scheduled_date: lateNight.toISOString() },
      { id: "early", scheduled_date: afterMidnight.toISOString() },
    ]

    expect(getTasksForDate(tasks, sunday!).map((task) => task.id)).toEqual(["late"])
    expect(getTasksForDate(tasks, monday!).map((task) => task.id)).toEqual(["early"])
  })

  it("keeps Sunday week-boundary tasks scoped to Sunday", () => {
    const sundayNight = new Date(2026, 2, 1, 23, 30, 0, 0)
    const mondayMorning = new Date(2026, 2, 2, 8, 0, 0, 0)
    const sundayKey = normalizeLocalDate(sundayNight)
    const mondayKey = normalizeLocalDate(mondayMorning)

    expect(sundayKey).toBe("2026-03-01")
    expect(mondayKey).toBe("2026-03-02")

    const tasks = [
      { id: "sun", scheduled_date: sundayNight.toISOString() },
      { id: "mon", scheduled_date: mondayMorning.toISOString() },
    ]

    expect(getTasksForDate(tasks, sundayKey!)).toHaveLength(1)
    expect(getTasksForDate(tasks, sundayKey!)[0]?.id).toBe("sun")
  })

  it("returns a today key that matches current local date normalization", () => {
    expect(getTodayLocalDate()).toBe(normalizeLocalDate(new Date()))
  })
})
