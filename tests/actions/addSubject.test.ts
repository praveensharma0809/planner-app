import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("addSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns UNAUTHORIZED when no user is present", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addSubject } = await import("@/app/actions/subjects/addSubject")

    const result = await addSubject({ name: "Math" })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR for reserved 'Others' name", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addSubject } = await import("@/app/actions/subjects/addSubject")

    const result = await addSubject({ name: "Others" })

    expect(result).toEqual({ status: "ERROR", message: "'Others' is reserved for standalone tasks." })
  })

  it("returns ERROR when insert fails", async () => {
    const updateSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: updateSingle })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addSubject } = await import("@/app/actions/subjects/addSubject")

    const result = await addSubject({ name: "Physics" })

    expect(result).toEqual({ status: "ERROR", message: "Could not save this subject right now. Please try again." })
  })

  it("returns SUCCESS with subject id on insert", async () => {
    const updateSingle = vi.fn().mockResolvedValue({ data: { id: "subject-99" }, error: null })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: updateSingle })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addSubject } = await import("@/app/actions/subjects/addSubject")

    const result = await addSubject({ name: "Chemistry" })

    expect(result).toEqual({ status: "SUCCESS", id: "subject-99" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
