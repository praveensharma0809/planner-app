import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("saveStructure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("rejects duplicate topic names within the same subject before mutating data", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { saveStructure } = await import("@/app/actions/planner/saveStructure")

    const result = await saveStructure([
      {
        name: "Mathematics",
        sort_order: 0,
        topics: [
          {
            name: " Algebra ",
            sort_order: 0,
            subtopics: [],
          },
          {
            name: "algebra",
            sort_order: 1,
            subtopics: [],
          },
        ],
      },
    ])

    expect(result).toEqual({
      status: "ERROR",
      message: 'Duplicate topic "algebra" in "Mathematics".',
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})