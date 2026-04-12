import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("completeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns UNAUTHORIZED when no user is present", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    const result = await completeTask("task-1")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns ERROR when task update fails", async () => {
    const taskMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "write failed" },
    })

    const taskUpdateEqCompleted = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: taskMaybeSingle,
      })),
    }))

    const taskUpdateEqUser = vi.fn(() => ({
      eq: taskUpdateEqCompleted,
    }))

    const taskUpdateEqId = vi.fn(() => ({
      eq: taskUpdateEqUser,
    }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "tasks") {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          update: vi.fn(() => ({
            eq: taskUpdateEqId,
          })),
        }
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    const result = await completeTask("task-1")

    expect(result).toEqual({ status: "ERROR", message: "write failed" })
  })

  it("completes task, updates streak, and revalidates routes", async () => {
    const taskMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        subject_id: "subject-1",
        task_source: "plan",
        source_topic_task_id: "topic-task-1",
      },
      error: null,
    })

    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        streak_current: 1,
        streak_longest: 2,
        streak_last_completed_date: null,
      },
      error: null,
    })

    const profileUpdateMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "user-1" },
      error: null,
    })

    const incompleteLinkedLimit = vi.fn().mockResolvedValue({ data: [], error: null })

    const topicTaskUpdateEqUser = vi.fn(async () => ({ error: null }))

    const taskUpdateEqCompleted = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: taskMaybeSingle,
      })),
    }))

    const taskUpdateEqUser = vi.fn(() => ({ eq: taskUpdateEqCompleted }))
    const taskUpdateEqId = vi.fn(() => ({ eq: taskUpdateEqUser }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          return {
            update: vi.fn(() => ({ eq: taskUpdateEqId })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      limit: incompleteLinkedLimit,
                    })),
                  })),
                })),
              })),
            })),
          }
        }

        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: profileMaybeSingle })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: profileUpdateMaybeSingle,
                  })),
                })),
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: profileUpdateMaybeSingle,
                  })),
                })),
              })),
            })),
          }
        }

        if (table === "topic_tasks") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: topicTaskUpdateEqUser,
              })),
            })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    const result = await completeTask("task-1")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/schedule")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
