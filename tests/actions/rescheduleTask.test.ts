import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockSelectResult = vi.fn()
const mockUpdateResult = vi.fn()
let selectCallCount = 0

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => {
    selectCallCount = 0
    return Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => {
                selectCallCount++
                return mockSelectResult()
              },
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => mockUpdateResult(),
          }),
        }),
      }),
    })
  },
}))

const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

describe("rescheduleTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
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
    mockSelectResult.mockResolvedValue({ data: null })

    const result = await rescheduleTask("nonexistent", "2026-06-15")
    expect(result.status).toBe("NOT_FOUND")
  })

  it("returns SUCCESS when task exists and date is valid", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSelectResult.mockResolvedValue({ data: { id: "task-1" } })
    mockUpdateResult.mockResolvedValue({ error: null })

    const result = await rescheduleTask("task-1", "2026-06-15")
    expect(result.status).toBe("SUCCESS")
  })
})
