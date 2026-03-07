import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetUser = vi.fn()
const mockInsertResult = vi.fn()
let insertPayload: Record<string, unknown> | null = null

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => {
        if (table !== "off_days") throw new Error(`Unexpected table: ${table}`)
        return {
          insert: (payload: Record<string, unknown>) => {
            insertPayload = payload
            return {
              select: () => ({
                single: () => mockInsertResult(),
              }),
            }
          },
        }
      },
    }),
}))

const { addOffDay } = await import("@/app/actions/offdays/addOffDay")

describe("addOffDay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertPayload = null
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await addOffDay({ date: "2026-03-10" })

    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("includes a generated id in the insert payload", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockInsertResult.mockResolvedValue({ data: { id: "off-1" }, error: null })
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("generated-off-day-id")

    const result = await addOffDay({ date: "2026-03-10", reason: "Rest" })

    expect(insertPayload).toEqual({
      id: "generated-off-day-id",
      user_id: "user-1",
      date: "2026-03-10",
      reason: "Rest",
    })
    expect(result).toEqual({ status: "SUCCESS", id: "off-1" })
  })
})