import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("reorderSubjects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns SUCCESS for empty updates array", async () => {
    createServerSupabaseClientMock.mockResolvedValue({} as never)
    const { reorderSubjects } = await import("@/app/actions/subjects/reorderSubjects")

    const result = await reorderSubjects([])

    expect(result).toEqual({ status: "SUCCESS" })
  })

  it("returns UNAUTHORIZED when no user", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { reorderSubjects } = await import("@/app/actions/subjects/reorderSubjects")

    const result = await reorderSubjects([{ id: "s1", sort_order: 0 }])

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR when an update fails mid-loop", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: { message: "update failed" } }),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { reorderSubjects } = await import("@/app/actions/subjects/reorderSubjects")

    const result = await reorderSubjects([{ id: "s1", sort_order: 0 }])

    expect(result).toEqual({ status: "ERROR", message: "update failed" })
  })

  it("returns SUCCESS and revalidates after updating multiple items", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { reorderSubjects } = await import("@/app/actions/subjects/reorderSubjects")

    const result = await reorderSubjects([
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
    ])

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
