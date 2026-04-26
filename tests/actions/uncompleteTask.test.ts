import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("uncompleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns UNAUTHORIZED when no user", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { uncompleteTask } = await import("@/app/actions/plan/uncompleteTask")

    const result = await uncompleteTask("task-1")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns NOT_FOUND when task update yields no rows", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { uncompleteTask } = await import("@/app/actions/plan/uncompleteTask")

    const result = await uncompleteTask("task-1")

    expect(result).toEqual({ status: "NOT_FOUND" })
  })

  it("returns ERROR when task update fails", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
                })),
              })),
            })),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { uncompleteTask } = await import("@/app/actions/plan/uncompleteTask")

    const result = await uncompleteTask("task-1")

    expect(result).toEqual({ status: "ERROR", message: "db error" })
  })

  it("returns SUCCESS and revalidates, no streak modification", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { subject_id: "s1", task_source: "manual", source_topic_task_id: null },
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return { select: vi.fn(), update: vi.fn() }
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { uncompleteTask } = await import("@/app/actions/plan/uncompleteTask")

    const result = await uncompleteTask("task-1")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/schedule")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
