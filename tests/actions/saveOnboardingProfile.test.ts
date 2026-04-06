import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("saveOnboardingProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns validation error when full name is blank", async () => {
    const { saveOnboardingProfile } = await import("@/app/actions/onboarding/saveProfile")

    const result = await saveOnboardingProfile({ full_name: "   " })

    expect(result).toEqual({
      status: "ERROR",
      message: "Full name is required.",
    })
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it("returns UNAUTHORIZED when user is missing", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { saveOnboardingProfile } = await import("@/app/actions/onboarding/saveProfile")

    const result = await saveOnboardingProfile({ full_name: "Alex" })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("upserts the profile and revalidates onboarding routes", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "profiles") {
          throw new Error(`Unexpected table: ${table}`)
        }

        return { upsert }
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { saveOnboardingProfile } = await import("@/app/actions/onboarding/saveProfile")

    const result = await saveOnboardingProfile({ full_name: "  Alex Doe  " })

    expect(result).toEqual({ status: "SUCCESS" })
    expect(upsert).toHaveBeenCalledWith(
      {
        id: "user-1",
        full_name: "Alex Doe",
      },
      { onConflict: "id" }
    )
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
    expect(revalidatePathMock).toHaveBeenCalledWith("/onboarding")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
  })

  it("returns a safe message when write fails", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "null value in column \"primary_exam\" violates not-null constraint" },
    })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(() => ({ upsert })),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { saveOnboardingProfile } = await import("@/app/actions/onboarding/saveProfile")

    const result = await saveOnboardingProfile({ full_name: "Alex Doe" })

    expect(result).toEqual({
      status: "ERROR",
      message: "Could not save your profile right now. Please try again.",
    })
  })
})
