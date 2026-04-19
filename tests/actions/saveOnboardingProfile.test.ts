import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns UNAUTHORIZED when user is missing", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeOnboarding } = await import("@/app/actions/onboarding/completeOnboarding")

    const result = await completeOnboarding()

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("upserts onboarding completion and revalidates routes", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "alex@example.com" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== "profiles") {
          throw new Error(`Unexpected table: ${table}`)
        }

        return { upsert }
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeOnboarding } = await import("@/app/actions/onboarding/completeOnboarding")

    const result = await completeOnboarding()

    expect(result).toEqual({ status: "SUCCESS" })
    expect(upsert).toHaveBeenCalledWith(
      {
        id: "user-1",
        full_name: "alex",
        onboarding_completed: true,
      },
      { onConflict: "id" }
    )
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
    expect(revalidatePathMock).toHaveBeenCalledWith("/onboarding")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
  })

  it("returns a safe message when upsert fails", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { message: "db write failed" },
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "alex@example.com" } },
        }),
      },
      from: vi.fn(() => ({ upsert })),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { completeOnboarding } = await import("@/app/actions/onboarding/completeOnboarding")

    const result = await completeOnboarding()

    expect(result).toEqual({
      status: "ERROR",
      message: "Could not mark onboarding as complete. Please try again.",
    })
  })

  it("returns thrown error message from catch block", async () => {
    createServerSupabaseClientMock.mockRejectedValue(new Error("boom"))
    const { completeOnboarding } = await import("@/app/actions/onboarding/completeOnboarding")

    const result = await completeOnboarding()

    expect(result).toEqual({
      status: "ERROR",
      message: "boom",
    })
  })
})
