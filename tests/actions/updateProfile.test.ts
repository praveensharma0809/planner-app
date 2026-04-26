import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("updateProfile", () => {
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
    const { updateProfile } = await import("@/app/actions/dashboard/updateProfile")

    const result = await updateProfile({ full_name: "Test" })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns ERROR for invalid email", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "old@test.com" } } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateProfile } = await import("@/app/actions/dashboard/updateProfile")

    const result = await updateProfile({ full_name: "Test", email: "not-an-email" })

    expect(result).toEqual({ status: "ERROR", message: "Please enter a valid email address." })
  })

  it("returns PARTIAL_SUCCESS when email update fails but name+phone saved", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "old@test.com" } } }),
        updateUser: vi.fn().mockResolvedValue({ error: { message: "Email already in use" } }),
      },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateProfile } = await import("@/app/actions/dashboard/updateProfile")

    const result = await updateProfile({ full_name: "New Name", email: "new@test.com" })

    expect(result.status).toBe("PARTIAL_SUCCESS")
    if (result.status === "PARTIAL_SUCCESS") {
      expect(result.saved.fullName).toBe("New Name")
      expect(result.saved.email).toBe("old@test.com")
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
  })

  it("returns SUCCESS when name-only update succeeds", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "old@test.com" } } }),
      },
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateProfile } = await import("@/app/actions/dashboard/updateProfile")

    const result = await updateProfile({ full_name: "New Name" })

    expect(result).toEqual({
      status: "SUCCESS",
      saved: { fullName: "New Name", email: "old@test.com", phoneNumber: "" },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settings")
  })
})
