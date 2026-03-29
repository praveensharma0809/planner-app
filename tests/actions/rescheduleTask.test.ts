import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockTaskSelectResult = vi.fn()
const mockSubjectSelectResult = vi.fn()
const mockTopicSelectResult = vi.fn()
const mockUpdateResult = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => {
    return Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => {
        if (table === "tasks") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => mockTaskSelectResult(),
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => mockUpdateResult(),
              }),
            }),
          }
        }

        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => mockSubjectSelectResult(),
                }),
              }),
            }),
          }
        }

        if (table === "topics") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => mockTopicSelectResult(),
                }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    })
  },
}))

const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

describe("rescheduleTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockSubjectSelectResult.mockResolvedValue({ data: { deadline: null, archived: false } })
    mockTopicSelectResult.mockResolvedValue({ data: { deadline: null, earliest_start: null, archived: false } })
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await rescheduleTask("task-1", "2099-01-15")
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns INVALID_DATE for a past date", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const result = await rescheduleTask("task-1", "2025-01-01")
    expect(result.status).toBe("INVALID_DATE")
  })

  it("returns INVALID_DATE for empty string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await rescheduleTask("task-1", "")
    expect(result.status).toBe("INVALID_DATE")
  })

  it("returns INVALID_DATE for invalid date string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await rescheduleTask("task-1", "not-a-date")
    expect(result.status).toBe("INVALID_DATE")
  })

  it("returns NOT_FOUND when task does not exist", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTaskSelectResult.mockResolvedValue({ data: null })

    const result = await rescheduleTask("nonexistent", "2026-06-15")
    expect(result.status).toBe("NOT_FOUND")
  })

  it("returns SUCCESS when task exists and date is valid", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTaskSelectResult.mockResolvedValue({
      data: { id: "task-1", subject_id: "subject-1", topic_id: "topic-1" },
    })
    mockUpdateResult.mockResolvedValue({ error: null })

    const result = await rescheduleTask("task-1", "2026-06-15")
    expect(result.status).toBe("SUCCESS")
  })

  it("returns ERROR when date exceeds subject deadline", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTaskSelectResult.mockResolvedValue({
      data: { id: "task-1", subject_id: "subject-1", topic_id: null },
    })
    mockSubjectSelectResult.mockResolvedValue({ data: { deadline: "2026-06-10", archived: false } })

    const result = await rescheduleTask("task-1", "2026-06-15")

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") {
      expect(result.message).toContain("subject deadline")
    }
  })

  it("returns ERROR when date exceeds topic deadline", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTaskSelectResult.mockResolvedValue({
      data: { id: "task-1", subject_id: "subject-1", topic_id: "topic-1" },
    })
    mockTopicSelectResult.mockResolvedValue({
      data: { deadline: "2026-06-10", earliest_start: null, archived: false },
    })

    const result = await rescheduleTask("task-1", "2026-06-15")

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") {
      expect(result.message).toContain("topic deadline")
    }
  })

  it("returns ERROR when date is before topic earliest start", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTaskSelectResult.mockResolvedValue({
      data: { id: "task-1", subject_id: "subject-1", topic_id: "topic-1" },
    })
    mockTopicSelectResult.mockResolvedValue({
      data: { deadline: null, earliest_start: "2026-06-10", archived: false },
    })

    const result = await rescheduleTask("task-1", "2026-06-09")

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") {
      expect(result.message).toContain("before topic start date")
    }
  })
})
