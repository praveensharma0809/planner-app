import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("upsertScheduleTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns INVALID_INPUT for empty title", async () => {
    createServerSupabaseClientMock.mockResolvedValue({} as never)
    const { upsertScheduleTask } = await import("@/app/actions/schedule/upsertScheduleTask")

    const result = await upsertScheduleTask({
      title: "",
      subjectId: "subj-1",
      scheduledDate: "2026-01-15",
      durationMinutes: 60,
    })

    expect(result).toEqual({ status: "INVALID_INPUT", message: "Title is required." })
  })

  it("returns INVALID_INPUT for invalid date", async () => {
    createServerSupabaseClientMock.mockResolvedValue({} as never)
    const { upsertScheduleTask } = await import("@/app/actions/schedule/upsertScheduleTask")

    const result = await upsertScheduleTask({
      title: "Task",
      subjectId: "subj-1",
      scheduledDate: "not-a-date",
      durationMinutes: 30,
    })

    expect(result).toEqual({ status: "INVALID_INPUT", message: "A valid date is required." })
  })

  it("returns UNAUTHORIZED when no user", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { upsertScheduleTask } = await import("@/app/actions/schedule/upsertScheduleTask")

    const result = await upsertScheduleTask({
      title: "Task",
      subjectId: "subj-1",
      scheduledDate: "2026-01-15",
      durationMinutes: 60,
    })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR for 'Others' subject name (insert path)", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "subj-1", name: "Others" }, error: null }),
              })),
            })),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { upsertScheduleTask } = await import("@/app/actions/schedule/upsertScheduleTask")

    const result = await upsertScheduleTask({
      title: "Task",
      subjectId: "subj-1",
      scheduledDate: "2026-01-15",
      durationMinutes: 60,
    })

    expect(result).toEqual({ status: "ERROR", message: "Invalid subject assignment" })
  })

  it("returns SUCCESS with taskId on insert", async () => {
    let callCount = 0
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        callCount++
        if (table === "subjects") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "subj-1", name: "Math" }, error: null }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === "tasks") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: "task-new" }, error: null }),
              })),
            })),
          }
        }
        return { select: vi.fn(), insert: vi.fn() }
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { upsertScheduleTask } = await import("@/app/actions/schedule/upsertScheduleTask")

    const result = await upsertScheduleTask({
      title: "Study Session",
      subjectId: "subj-1",
      scheduledDate: "2026-01-15",
      durationMinutes: 45,
    })

    expect(result).toEqual({ status: "SUCCESS", taskId: "task-new" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/schedule")
  })
})
