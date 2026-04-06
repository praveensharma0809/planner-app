import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("rescheduleTask", () => {
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
    const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

    const result = await rescheduleTask("task-1", "2099-01-01")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("returns INVALID_DATE for malformed dates", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

    const result = await rescheduleTask("task-1", "01-01-2099")

    expect(result).toEqual({ status: "INVALID_DATE" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("blocks reschedule when subject is archived", async () => {
    const existingTask = {
      id: "task-1",
      task_type: "session",
      subject_id: "subject-1",
      topic_id: null,
    }

    const tasksSelectMaybeSingle = vi.fn().mockResolvedValue({ data: existingTask, error: null })
    const subjectsSelectMaybeSingle = vi.fn().mockResolvedValue({ data: { archived: true, deadline: null }, error: null })

    const tasksSelectChain = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: tasksSelectMaybeSingle,
        })),
      })),
    }

    const subjectsSelectChain = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: subjectsSelectMaybeSingle,
        })),
      })),
    }

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          return {
            select: vi.fn(() => tasksSelectChain),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          }
        }

        if (table === "subjects") {
          return {
            select: vi.fn(() => subjectsSelectChain),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

    const result = await rescheduleTask("task-1", "2099-01-01")

    expect(result).toEqual({
      status: "ERROR",
      message: "Cannot reschedule tasks for archived subjects.",
    })
  })

  it("updates date and revalidates routes on success", async () => {
    const existingTask = {
      id: "task-1",
      task_type: "session",
      subject_id: "subject-1",
      topic_id: null,
    }

    const tasksSelectMaybeSingle = vi.fn().mockResolvedValue({ data: existingTask, error: null })
    const subjectsSelectMaybeSingle = vi.fn().mockResolvedValue({ data: { archived: false, deadline: null }, error: null })

    const tasksUpdateEqUser = vi.fn(async () => ({ error: null }))
    const tasksUpdateEqId = vi.fn(() => ({ eq: tasksUpdateEqUser }))
    const tasksUpdate = vi.fn(() => ({ eq: tasksUpdateEqId }))

    const tasksSelectChain = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: tasksSelectMaybeSingle,
        })),
      })),
    }

    const subjectsSelectChain = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: subjectsSelectMaybeSingle,
        })),
      })),
    }

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          return {
            select: vi.fn(() => tasksSelectChain),
            update: tasksUpdate,
          }
        }

        if (table === "subjects") {
          return {
            select: vi.fn(() => subjectsSelectChain),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { rescheduleTask } = await import("@/app/actions/plan/rescheduleTask")

    const result = await rescheduleTask("task-1", "2099-01-01")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(tasksUpdate).toHaveBeenCalledWith({ scheduled_date: "2099-01-01" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/schedule")
  })
})
