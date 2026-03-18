import { describe, it, expect, vi, beforeEach } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"
import type { ScheduledSession } from "@/lib/planner/engine"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("commitPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("commits sessions via commit_plan_atomic RPC", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        study_start_date: "2024-01-01",
        exam_date: "2024-01-31",
      },
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "plan_config") {
          throw new Error(`Unexpected table: ${table}`)
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        }
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "SUCCESS",
          task_count: 1,
          snapshot_id: "snapshot-1",
        },
        error: null,
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const sessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-02",
        duration_minutes: 60,
        session_type: "core",
        priority: 1,
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const result = await commitPlan(sessions, "future", "Initial commit")

    expect(result).toEqual({
      status: "SUCCESS",
      taskCount: 1,
      snapshotId: "snapshot-1",
    })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic",
      expect.objectContaining({
        p_user_id: "user-1",
        p_snapshot_summary: "Initial commit",
      })
    )

    const [, args] = supabase.rpc.mock.calls[0]
    expect(args.p_tasks).toEqual(sessions)
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })

  it("returns UNAUTHORIZED when no user is present", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const result = await commitPlan([])

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("passes merge mode and the earliest plan date to the RPC", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        study_start_date: "2024-01-01",
        exam_date: "2024-01-31",
      },
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "plan_config") {
          throw new Error(`Unexpected table: ${table}`)
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        }
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "SUCCESS",
          task_count: 2,
          snapshot_id: "snapshot-merge",
        },
        error: null,
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const sessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-2",
        title: "Math - Geometry",
        scheduled_date: "2024-01-07",
        duration_minutes: 60,
        session_type: "core",
        priority: 2,
        session_number: 1,
        total_sessions: 2,
      },
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-03",
        duration_minutes: 60,
        session_type: "core",
        priority: 1,
        session_number: 1,
        total_sessions: 1,
      },
    ]

    await commitPlan(sessions, "merge", "Merge commit")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic",
      expect.objectContaining({
        p_keep_mode: "merge",
        p_new_plan_start_date: "2024-01-03",
        p_snapshot_summary: "Merge commit",
      })
    )
  })

  it("passes until mode and the earliest plan date to the RPC", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        study_start_date: "2024-01-01",
        exam_date: "2024-01-31",
      },
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table !== "plan_config") {
          throw new Error(`Unexpected table: ${table}`)
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        }
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "SUCCESS",
          task_count: 2,
          snapshot_id: "snapshot-until",
        },
        error: null,
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const sessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-2",
        title: "Math - Geometry",
        scheduled_date: "2024-01-08",
        duration_minutes: 60,
        session_type: "core",
        priority: 2,
        session_number: 1,
        total_sessions: 2,
      },
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-04",
        duration_minutes: 60,
        session_type: "core",
        priority: 1,
        session_number: 1,
        total_sessions: 1,
      },
    ]

    await commitPlan(sessions, "until", "Until commit")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic",
      expect.objectContaining({
        p_keep_mode: "until",
        p_new_plan_start_date: "2024-01-04",
        p_snapshot_summary: "Until commit",
      })
    )
  })
})
