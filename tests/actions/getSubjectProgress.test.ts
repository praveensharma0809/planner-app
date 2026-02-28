import { describe, it, expect, vi, beforeEach } from "vitest"

// Shared mock state
const mockGetUser = vi.fn()
let orderResult: { data: unknown[] | null } = { data: [] }

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => orderResult,
          }),
        }),
      }),
    }),
}))

const { getSubjectProgress } = await import("@/app/actions/dashboard/getSubjectProgress")

describe("getSubjectProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getSubjectProgress()
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns empty subjects when user has none", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    orderResult = { data: [] }
    const result = await getSubjectProgress()
    expect(result).toEqual({ status: "SUCCESS", subjects: [] })
  })

  it("computes health correctly for subjects", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const today = new Date()
    // Subject due in 2 days, only 50% done → at_risk
    const twoDaysOut = new Date(today)
    twoDaysOut.setDate(twoDaysOut.getDate() + 2)
    const twoDaysStr = twoDaysOut.toISOString().split("T")[0]

    // Subject due in 30 days, 60% done → on_track
    const thirtyDaysOut = new Date(today)
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30)
    const thirtyDaysStr = thirtyDaysOut.toISOString().split("T")[0]

    // Subject past deadline, 80% done → overdue
    const pastDate = new Date(today)
    pastDate.setDate(pastDate.getDate() - 5)
    const pastDateStr = pastDate.toISOString().split("T")[0]

    orderResult = {
      data: [
        { id: "s1", name: "Physics", total_items: 100, completed_items: 50, deadline: twoDaysStr, priority: 1, mandatory: true },
        { id: "s2", name: "Chemistry", total_items: 100, completed_items: 60, deadline: thirtyDaysStr, priority: 2, mandatory: false },
        { id: "s3", name: "Math", total_items: 100, completed_items: 80, deadline: pastDateStr, priority: 1, mandatory: true },
      ],
    }

    const result = await getSubjectProgress()
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    const physics = result.subjects.find(s => s.name === "Physics")!
    expect(physics.health).toBe("at_risk")
    expect(physics.percent).toBe(50)

    const chemistry = result.subjects.find(s => s.name === "Chemistry")!
    expect(chemistry.health).toBe("on_track")
    expect(chemistry.percent).toBe(60)

    const math = result.subjects.find(s => s.name === "Math")!
    expect(math.health).toBe("overdue")
    expect(math.percent).toBe(80)
  })

  it("marks 100% complete subjects past deadline as on_track (not overdue)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 3)
    const pastDateStr = pastDate.toISOString().split("T")[0]

    orderResult = {
      data: [
        { id: "s1", name: "Done Subject", total_items: 50, completed_items: 50, deadline: pastDateStr, priority: 1, mandatory: false },
      ],
    }

    const result = await getSubjectProgress()
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    // 100% → not overdue, stays on_track
    expect(result.subjects[0].health).toBe("on_track")
    expect(result.subjects[0].percent).toBe(100)
  })
})
