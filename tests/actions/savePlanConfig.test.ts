import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("savePlanConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("clears inherited topic deadlines when global exam date changes", async () => {
    const topicDeadlineEqMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const topicUserEqMock = vi.fn(() => ({ eq: topicDeadlineEqMock }))
    const topicsUpdateMock = vi.fn(() => ({ eq: topicUserEqMock }))

    const plannerSettingsMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { exam_date: "2026-05-13" },
      error: null,
    })
    const plannerSettingsEqMock = vi.fn(() => ({ maybeSingle: plannerSettingsMaybeSingleMock }))
    const plannerSettingsSelectMock = vi.fn(() => ({ eq: plannerSettingsEqMock }))
    const plannerSettingsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "planner_settings") {
          return {
            select: plannerSettingsSelectMock,
            upsert: plannerSettingsUpsertMock,
          }
        }

        if (table === "topics") {
          return {
            update: topicsUpdateMock,
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { savePlanConfig } = await import("@/app/actions/planner/setup")

    const result = await savePlanConfig({
      study_start_date: "2026-03-29",
      exam_date: "2026-07-30",
      weekday_capacity_minutes: 180,
      weekend_capacity_minutes: 240,
      max_active_subjects: 0,
      day_of_week_capacity: [null, null, null, null, null, null, null],
      custom_day_capacity: {},
      flexibility_minutes: 0,
      max_daily_minutes: 480,
    })

    expect(result).toEqual({ status: "SUCCESS" })
    expect(topicsUpdateMock).toHaveBeenCalledWith({ deadline: null })
    expect(topicUserEqMock).toHaveBeenCalledWith("user_id", "user-1")
    expect(topicDeadlineEqMock).toHaveBeenCalledWith("deadline", "2026-05-13")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })

  it("does not touch topic deadlines when global exam date is unchanged", async () => {
    const topicsUpdateMock = vi.fn()

    const plannerSettingsMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { exam_date: "2026-07-30" },
      error: null,
    })
    const plannerSettingsEqMock = vi.fn(() => ({ maybeSingle: plannerSettingsMaybeSingleMock }))
    const plannerSettingsSelectMock = vi.fn(() => ({ eq: plannerSettingsEqMock }))
    const plannerSettingsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "planner_settings") {
          return {
            select: plannerSettingsSelectMock,
            upsert: plannerSettingsUpsertMock,
          }
        }

        if (table === "topics") {
          return {
            update: topicsUpdateMock,
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { savePlanConfig } = await import("@/app/actions/planner/setup")

    const result = await savePlanConfig({
      study_start_date: "2026-03-29",
      exam_date: "2026-07-30",
      weekday_capacity_minutes: 180,
      weekend_capacity_minutes: 240,
      max_active_subjects: 0,
      day_of_week_capacity: [null, null, null, null, null, null, null],
      custom_day_capacity: {},
      flexibility_minutes: 0,
      max_daily_minutes: 480,
    })

    expect(result).toEqual({ status: "SUCCESS" })
    expect(topicsUpdateMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })
})
