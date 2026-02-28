import { describe, it, expect, vi, beforeEach } from "vitest"

// Shared mock state
const mockGetUser = vi.fn()
const mockResult = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => mockResult(),
            }),
          }),
        }),
      }),
    }),
}))

const { getMonthTaskCounts } = await import("@/app/actions/dashboard/getMonthTaskCounts")

describe("getMonthTaskCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getMonthTaskCounts()
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns empty days when no tasks exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({ data: [] })
    const result = await getMonthTaskCounts("2026-03")
    expect(result).toEqual({ status: "SUCCESS", days: [] })
  })

  it("aggregates task counts per day", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({
      data: [
        { scheduled_date: "2026-03-10", completed: false },
        { scheduled_date: "2026-03-10", completed: true },
        { scheduled_date: "2026-03-10", completed: false },
        { scheduled_date: "2026-03-15", completed: true },
        { scheduled_date: "2026-03-15", completed: true },
      ],
    })

    const result = await getMonthTaskCounts("2026-03")
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.days).toHaveLength(2)

    const mar10 = result.days.find(d => d.date === "2026-03-10")!
    expect(mar10.count).toBe(3)
    expect(mar10.completed).toBe(1)

    const mar15 = result.days.find(d => d.date === "2026-03-15")!
    expect(mar15.count).toBe(2)
    expect(mar15.completed).toBe(2)
  })

  it("returns sorted days", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({
      data: [
        { scheduled_date: "2026-03-20", completed: false },
        { scheduled_date: "2026-03-05", completed: true },
      ],
    })

    const result = await getMonthTaskCounts("2026-03")
    if (result.status !== "SUCCESS") return
    expect(result.days[0].date).toBe("2026-03-05")
    expect(result.days[1].date).toBe("2026-03-20")
  })

  it("handles null data gracefully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({ data: null })

    const result = await getMonthTaskCounts("2026-03")
    expect(result).toEqual({ status: "SUCCESS", days: [] })
  })
})
