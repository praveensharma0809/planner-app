import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("saveTopicParams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("rejects session lengths below the planner minimum", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { saveTopicParams } = await import("@/app/actions/planner/setup")

    const result = await saveTopicParams([
      {
        topic_id: "topic-1",
        estimated_hours: 5,
        priority: 3,
        deadline: null,
        earliest_start: null,
        depends_on: [],
        session_length_minutes: 10,
      },
    ])

    expect(result).toEqual({
      status: "ERROR",
      message: "Session length must be at least 15 minutes.",
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("rejects dependency cycles before writing topic params", async () => {
    const upsertMock = vi.fn()
    const topicsInMock = vi.fn().mockResolvedValue({
      data: [
        { id: "topic-1", name: "Algebra" },
        { id: "topic-2", name: "Geometry" },
      ],
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "topics") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: topicsInMock,
              })),
            })),
          }
        }

        if (table === "topic_params") {
          return {
            upsert: upsertMock,
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { saveTopicParams } = await import("@/app/actions/planner/setup")

    const result = await saveTopicParams([
      {
        topic_id: "topic-1",
        estimated_hours: 5,
        priority: 2,
        deadline: null,
        earliest_start: null,
        depends_on: ["topic-2"],
        session_length_minutes: 60,
      },
      {
        topic_id: "topic-2",
        estimated_hours: 4,
        priority: 3,
        deadline: null,
        earliest_start: null,
        depends_on: ["topic-1"],
        session_length_minutes: 60,
      },
    ])

    expect(result).toEqual({
      status: "ERROR",
      message: "Dependency loop detected: Algebra -> Geometry -> Algebra. Remove one dependency and try again.",
    })
    expect(upsertMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})