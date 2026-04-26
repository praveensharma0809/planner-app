import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("updateSubject", () => {
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
    const { updateSubject } = await import("@/app/actions/subjects/updateSubject")

    const result = await updateSubject({ id: "s1", name: "Math" })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR for empty name", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateSubject } = await import("@/app/actions/subjects/updateSubject")

    const result = await updateSubject({ id: "s1", name: "" })

    expect(result).toEqual({ status: "ERROR", message: "Subject name is required." })
  })

  it("returns ERROR for reserved name", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateSubject } = await import("@/app/actions/subjects/updateSubject")

    const result = await updateSubject({ id: "s1", name: "Others" })

    expect(result).toEqual({ status: "ERROR", message: "'Others' is reserved for standalone tasks." })
  })

  it("returns ERROR when update query fails", async () => {
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
    const { updateSubject } = await import("@/app/actions/subjects/updateSubject")

    const result = await updateSubject({ id: "s1", name: "Biology" })

    expect(result).toEqual({ status: "ERROR", message: "update failed" })
  })

  it("returns SUCCESS and revalidates on successful update", async () => {
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
    const { updateSubject } = await import("@/app/actions/subjects/updateSubject")

    const result = await updateSubject({ id: "s1", name: "Biology" })

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
