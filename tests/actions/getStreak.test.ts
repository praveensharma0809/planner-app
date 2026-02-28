import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockProfileResult = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => mockProfileResult(),
          }),
        }),
      }),
    }),
}))

const { getStreak } = await import("@/app/actions/dashboard/getStreak")

describe("getStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getStreak()
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns NO_PROFILE when profile does not exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockProfileResult.mockResolvedValue({ data: null })

    const result = await getStreak()
    expect(result.status).toBe("NO_PROFILE")
  })

  it("returns streak data on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockProfileResult.mockResolvedValue({
      data: {
        streak_current: 5,
        streak_longest: 12,
        streak_last_completed_date: "2026-02-27",
      },
    })

    const result = await getStreak()
    expect(result).toEqual({
      status: "SUCCESS",
      streak_current: 5,
      streak_longest: 12,
      streak_last_completed_date: "2026-02-27",
    })
  })

  it("defaults null streak fields to zero", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockProfileResult.mockResolvedValue({
      data: {
        streak_current: null,
        streak_longest: null,
        streak_last_completed_date: null,
      },
    })

    const result = await getStreak()
    expect(result).toEqual({
      status: "SUCCESS",
      streak_current: 0,
      streak_longest: 0,
      streak_last_completed_date: null,
    })
  })
})
