import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("deleteScheduleTask", () => {
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
    const { deleteScheduleTask } = await import("@/app/actions/schedule/deleteScheduleTask")

    const result = await deleteScheduleTask("task-1")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns NOT_FOUND when task does not exist", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
        delete: vi.fn(),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteScheduleTask } = await import("@/app/actions/schedule/deleteScheduleTask")

    const result = await deleteScheduleTask("task-1")

    expect(result).toEqual({ status: "NOT_FOUND" })
  })

  it("returns ERROR when existing check fails", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "query error" } }),
            })),
          })),
        })),
        delete: vi.fn(),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteScheduleTask } = await import("@/app/actions/schedule/deleteScheduleTask")

    const result = await deleteScheduleTask("task-1")

    expect(result).toEqual({ status: "ERROR", message: "query error" })
  })

  it("returns SUCCESS and revalidates on delete", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "task-1" }, error: null }),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteScheduleTask } = await import("@/app/actions/schedule/deleteScheduleTask")

    const result = await deleteScheduleTask("task-1")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/schedule")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
  })
})
