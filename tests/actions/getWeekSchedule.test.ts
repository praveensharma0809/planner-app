import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockSubjectRows = vi.fn()
const mockTaskRows = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => {
        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => mockSubjectRows(),
                }),
              }),
            }),
          }
        }

        if (table === "tasks") {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      order: () => ({
                        order: () => mockTaskRows(),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }),
}))

const { getScheduleWeekData } = await import("@/app/actions/schedule/getWeekSchedule")

describe("getScheduleWeekData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await getScheduleWeekData("2026-03-10")

    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("filters canonical intake manual rows from schedule payload", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectRows.mockResolvedValue({
      data: [{ id: "s1", name: "Math", sort_order: 0 }],
      error: null,
    })
    mockTaskRows.mockResolvedValue({
      data: [
        {
          id: "intake-1",
          subject_id: "s1",
          title: "Chapter - Task",
          scheduled_date: "2026-03-09",
          duration_minutes: 60,
          session_type: "core",
          priority: 3,
          completed: false,
          task_source: "manual",
          plan_snapshot_id: null,
          session_number: 0,
          total_sessions: 1,
          created_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "plan-1",
          subject_id: "s1",
          title: "Session 1",
          scheduled_date: "2026-03-10",
          duration_minutes: 90,
          session_type: "core",
          priority: 2,
          completed: false,
          task_source: "plan",
          plan_snapshot_id: "snap-1",
          session_number: 1,
          total_sessions: 4,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      error: null,
    })

    const result = await getScheduleWeekData("2026-03-10")

    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].id).toBe("plan-1")
    expect(result.tasks[0].is_planner_task).toBe(true)
  })
})
