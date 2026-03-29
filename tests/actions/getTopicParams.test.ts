import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

describe("getTopicParams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("clears inherited deadlines that match subject or global deadlines", async () => {
    const topicsUpdateInMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const topicsUpdateEqMock = vi.fn(() => ({ in: topicsUpdateInMock }))
    const topicsUpdateMock = vi.fn(() => ({ eq: topicsUpdateEqMock }))

    const topicsSelectMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: "topic-1",
            subject_id: "subject-1",
            estimated_hours: 4,
            priority: 3,
            deadline: "2026-06-25",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
          {
            id: "topic-2",
            subject_id: "subject-1",
            estimated_hours: 5,
            priority: 3,
            deadline: "2026-07-30",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
          {
            id: "topic-3",
            subject_id: "subject-2",
            estimated_hours: 2,
            priority: 3,
            deadline: "2026-08-10",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 45,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
        ],
        error: null,
      }),
    }))

    const subjectSelectMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "subject-1", deadline: "2026-06-25" },
            { id: "subject-2", deadline: null },
          ],
          error: null,
        }),
      })),
    }))

    const settingsSelectMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { exam_date: "2026-07-30" },
          error: null,
        }),
      })),
    }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "planner_settings") {
          return { select: settingsSelectMock }
        }

        if (table === "topics") {
          return {
            select: topicsSelectMock,
            update: topicsUpdateMock,
          }
        }

        if (table === "subjects") {
          return { select: subjectSelectMock }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getTopicParams } = await import("@/app/actions/planner/setup")
    const result = await getTopicParams()

    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.params.find((row) => row.topic_id === "topic-1")?.deadline).toBeNull()
    expect(result.params.find((row) => row.topic_id === "topic-2")?.deadline).toBeNull()
    expect(result.params.find((row) => row.topic_id === "topic-3")?.deadline).toBe("2026-08-10")

    expect(topicsUpdateMock).toHaveBeenCalledWith({ deadline: null })
    expect(topicsUpdateEqMock).toHaveBeenCalledWith("user_id", "user-1")
    expect(topicsUpdateInMock).toHaveBeenCalledWith("id", ["topic-1", "topic-2"])
  })

  it("does not write cleanup updates when no inherited deadlines are present", async () => {
    const topicsUpdateMock = vi.fn()

    const topicsSelectMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: "topic-1",
            subject_id: "subject-1",
            estimated_hours: 4,
            priority: 3,
            deadline: "2026-08-15",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
        ],
        error: null,
      }),
    }))

    const subjectSelectMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: [{ id: "subject-1", deadline: "2026-06-25" }],
          error: null,
        }),
      })),
    }))

    const settingsSelectMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { exam_date: "2026-07-30" },
          error: null,
        }),
      })),
    }))

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "planner_settings") {
          return { select: settingsSelectMock }
        }

        if (table === "topics") {
          return {
            select: topicsSelectMock,
            update: topicsUpdateMock,
          }
        }

        if (table === "subjects") {
          return { select: subjectSelectMock }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getTopicParams } = await import("@/app/actions/planner/setup")
    const result = await getTopicParams()

    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.params.find((row) => row.topic_id === "topic-1")?.deadline).toBe("2026-08-15")
    expect(topicsUpdateMock).not.toHaveBeenCalled()
  })

})
