import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockResult = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        select: () => ({
          eq: () => ({
            lt: () => ({
              eq: () => ({
                order: () => mockResult(),
              }),
            }),
          }),
        }),
      }),
    }),
}))

const { getBacklog } = await import("@/app/actions/dashboard/getBacklog")

describe("getBacklog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getBacklog()
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns empty array when no overdue tasks", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({ data: [] })

    const result = await getBacklog()
    expect(result).toEqual({ status: "SUCCESS", tasks: [] })
  })

  it("returns overdue tasks", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({
      data: [
        { id: "t1", title: "Old task", scheduled_date: "2025-12-20", completed: false },
        { id: "t2", title: "Older task", scheduled_date: "2025-12-15", completed: false },
      ],
    })

    const result = await getBacklog()
    expect(result.status).toBe("SUCCESS")
    if (result.status === "SUCCESS") {
      expect(result.tasks).toHaveLength(2)
    }
  })

  it("handles null data gracefully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({ data: null })

    const result = await getBacklog()
    expect(result).toEqual({ status: "SUCCESS", tasks: [] })
  })
})
