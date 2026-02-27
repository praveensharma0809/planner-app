/// <reference types="vitest" />

import { vi } from "vitest"
import { createServerSupabaseClientMock, buildSupabaseMock } from "../utils/supabaseMock"
import type { ScheduledTask } from "@/lib/planner/scheduler"

describe("commitPlan", () => {
  it("inserts only future generated tasks", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    const { supabase, deleteFilters, insertPayloads } = buildSupabaseMock()
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { commitPlan } = await import("@/app/actions/plan/commitPlan")

    const tasks: ScheduledTask[] = [
      {
        subject_id: "history",
        scheduled_date: "2023-12-30",
        duration_minutes: 30,
        title: "Past Task",
        priority: 1
      },
      {
        subject_id: "math",
        scheduled_date: "2024-01-02",
        duration_minutes: 45,
        title: "Future Task",
        priority: 2
      }
    ]

    const result = await commitPlan({ tasks })

    expect(result).toEqual({ status: "SUCCESS", taskCount: 1 })
    expect(insertPayloads).toHaveLength(1)

    const inserted = insertPayloads[0] as Array<Record<string, unknown>>
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      subject_id: "math",
      scheduled_date: "2024-01-02",
      is_plan_generated: true,
      completed: false,
      user_id: "user-1"
    })

    expect(deleteFilters.eq).toContainEqual(["user_id", "user-1"])
    expect(deleteFilters.eq).toContainEqual(["is_plan_generated", true])
    expect(deleteFilters.gte).toContainEqual(["scheduled_date", "2024-01-01"])
  })

  it("returns UNAUTHORIZED when no user is present", async () => {
    const { supabase } = buildSupabaseMock()
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    createServerSupabaseClientMock.mockResolvedValue(supabase)

    const { commitPlan } = await import("@/app/actions/plan/commitPlan")

    const result = await commitPlan({ tasks: [] })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })
})
