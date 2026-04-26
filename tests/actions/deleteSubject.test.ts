import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("deleteSubject", () => {
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
    const { deleteSubject } = await import("@/app/actions/subjects/deleteSubject")

    const result = await deleteSubject("s1")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR when subject not found", async () => {
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
    const { deleteSubject } = await import("@/app/actions/subjects/deleteSubject")

    const result = await deleteSubject("s1")

    expect(result).toEqual({ status: "ERROR", message: "Subject not found." })
  })

  it("returns ERROR when child task deletion fails", async () => {
    const selectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
          })),
        })),
      })),
    }

    const deleteChain = vi.fn()
    const tasksDelete = {
      delete: deleteChain,
    }

    let fromCallCount = 0
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        fromCallCount++
        if (table === "subjects" && fromCallCount === 1) {
          return selectChain
        }
        if (table === "tasks") {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: { message: "task delete failed" } }),
              })),
            })),
          }
        }
        return tasksDelete
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteSubject } = await import("@/app/actions/subjects/deleteSubject")

    const result = await deleteSubject("s1")

    expect(result).toEqual({ status: "ERROR", message: "task delete failed" })
  })

  it("returns SUCCESS and revalidates on full cleanup", async () => {
    const eqDeleteOk = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }))

    let fromCallCount = 0
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        fromCallCount++
        if (table === "subjects" && fromCallCount === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
                })),
              })),
            })),
          }
        }
        return {
          delete: vi.fn(() => ({
            eq: eqDeleteOk,
          })),
        }
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteSubject } = await import("@/app/actions/subjects/deleteSubject")

    const result = await deleteSubject("s1")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
  })
})
