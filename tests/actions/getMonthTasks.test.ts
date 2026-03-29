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
            gte: () => ({
              lte: () => ({
                order: () => ({
                  order: () => mockResult(),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
}))

const { getMonthTasks } = await import("@/app/actions/dashboard/getMonthTasks")

describe("getMonthTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getMonthTasks("2026-03")
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns empty tasks when no rows exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({ data: [] })

    const result = await getMonthTasks("2026-03")
    expect(result).toEqual({ status: "SUCCESS", tasks: [] })
  })

  it("filters canonical intake manual rows", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockResult.mockReturnValue({
      data: [
        {
          id: "intake",
          user_id: "u1",
          subject_id: "s1",
          topic_id: "t1",
          title: "Chapter - Task",
          scheduled_date: "2026-03-09",
          duration_minutes: 60,
          priority: 3,
          completed: false,
          task_source: "manual",
          session_type: "core",
          plan_snapshot_id: null,
          session_number: 0,
          total_sessions: 1,
          sort_order: 0,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "plan-1",
          user_id: "u1",
          subject_id: "s1",
          topic_id: "t1",
          title: "Session 1",
          scheduled_date: "2026-03-10",
          duration_minutes: 90,
          priority: 2,
          completed: false,
          task_source: "plan",
          session_type: "core",
          plan_snapshot_id: "snap-1",
          session_number: 1,
          total_sessions: 4,
          sort_order: 0,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    })

    const result = await getMonthTasks("2026-03")
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].id).toBe("plan-1")
  })
})
