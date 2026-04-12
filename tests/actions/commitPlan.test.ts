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
        if (table !== "planner_settings") {
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
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const result = await commitPlan(sessions, "until", "Initial commit")

    expect(result).toEqual({
      status: "SUCCESS",
      taskCount: 1,
      snapshotId: "snapshot-1",
    })

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic_v2",
      expect.objectContaining({
        p_snapshot_summary: "Initial commit",
        p_commit_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )

    const [, args] = supabase.rpc.mock.calls[0]
    expect(args.p_tasks).toEqual([
      {
        ...sessions[0],
        source_topic_task_id: null,
      },
    ])
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

  it("passes none mode and the earliest plan date to the RPC", async () => {
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
        if (table !== "planner_settings") {
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
        session_number: 1,
        total_sessions: 1,
      },
    ]

    await commitPlan(sessions, "none", "None commit")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic_v2",
      expect.objectContaining({
        p_keep_mode: "none",
        p_new_plan_start_date: "2024-01-03",
        p_snapshot_summary: "None commit",
        p_commit_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
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
        if (table !== "planner_settings") {
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
        session_number: 1,
        total_sessions: 1,
      },
    ]

    await commitPlan(sessions, "until", "Until commit")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic_v2",
      expect.objectContaining({
        p_keep_mode: "until",
        p_new_plan_start_date: "2024-01-04",
        p_snapshot_summary: "Until commit",
        p_commit_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )
  })

  it("rejects invalid session payloads before RPC", async () => {
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
        if (table !== "planner_settings") {
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
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const invalidSessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "01-02-2024",
        duration_minutes: 60,
        session_type: "core",
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const result = await commitPlan(invalidSessions, "until", "Invalid commit")

    expect(result).toEqual({
      status: "ERROR",
      message: "Session 1 has invalid scheduled_date. Use YYYY-MM-DD.",
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("normalizes keep mode and forwards commit hash before RPC", async () => {
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
        if (table !== "planner_settings") {
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
          snapshot_id: "snapshot-sanitized",
        },
        error: null,
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const sessions = [
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "  Session A  ",
        scheduled_date: "2024-01-02",
        duration_minutes: 60,
        session_type: "core",
        session_number: 1,
        total_sessions: 1,
      },
    ] as ScheduledSession[]

    await commitPlan(sessions, "bad-mode" as unknown as "until")

    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_plan_atomic_v2",
      expect.objectContaining({
        p_keep_mode: "until",
        p_snapshot_summary: "Committed 1 sessions",
        p_commit_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )

    const [, rpcArgs] = supabase.rpc.mock.calls[0]
    expect(rpcArgs.p_tasks).toEqual([
      expect.objectContaining({
        title: "Session A",
        duration_minutes: 60,
        session_type: "core",
        session_number: 1,
        total_sessions: 1,
      }),
    ])
  })

  it("rejects invalid session type before RPC", async () => {
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
        if (table !== "planner_settings") {
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
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const invalidSessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-02",
        duration_minutes: 60,
        session_type: "focus" as unknown as "core",
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const result = await commitPlan(invalidSessions, "until", "Invalid type")

    expect(result).toEqual({
      status: "ERROR",
      message: "Session 1 has invalid session_type.",
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("forwards source topic task links in commit payload", async () => {
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
        if (table !== "planner_settings") {
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
          snapshot_id: "snapshot-links",
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
        scheduled_date: "2024-01-03",
        duration_minutes: 60,
        session_type: "core",
        session_number: 1,
        total_sessions: 2,
        source_topic_task_id: " topic-task-1 ",
      },
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-04",
        duration_minutes: 60,
        session_type: "core",
        session_number: 2,
        total_sessions: 2,
      },
    ]

    await commitPlan(sessions, "until", "Linked commit")

    const [, rpcArgs] = supabase.rpc.mock.calls[0]
    expect(rpcArgs.p_tasks).toEqual([
      expect.objectContaining({
        source_topic_task_id: "topic-task-1",
      }),
      expect.objectContaining({
        source_topic_task_id: null,
      }),
    ])
  })

  it("rejects manual-only sessions without generated plan sessions", async () => {
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
        if (table !== "planner_settings") {
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
          snapshot_id: "snapshot-custom-session",
        },
        error: null,
      }),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const sessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "",
        title: "Custom Session",
        scheduled_date: "2024-01-05",
        duration_minutes: 45,
        session_type: "core",
        session_number: 1,
        total_sessions: 1,
        is_manual: true,
      },
    ]

    const result = await commitPlan(sessions, "until", "Custom session commit")

    expect(result).toEqual({
      status: "ERROR",
      message: "Missing required generated sessions",
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rejects empty commits before any database write", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const result = await commitPlan([], "until", "Empty commit")

    expect(result).toEqual({
      status: "ERROR",
      message: "Cannot commit empty plan",
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rejects non-manual sessions when topic_id is missing", async () => {
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
        if (table !== "planner_settings") {
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
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const invalidSessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "",
        title: "Generated Session",
        scheduled_date: "2024-01-05",
        duration_minutes: 45,
        session_type: "core",
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const result = await commitPlan(invalidSessions, "until", "Invalid commit")

    expect(result).toEqual({
      status: "ERROR",
      message: "Session 1 is missing topic_id.",
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rejects sessions when session_number is greater than total_sessions", async () => {
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
        if (table !== "planner_settings") {
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
      rpc: vi.fn(),
    }

    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { commitPlan } = await import("@/app/actions/planner/plan")

    const invalidSessions: ScheduledSession[] = [
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Math - Algebra",
        scheduled_date: "2024-01-02",
        duration_minutes: 60,
        session_type: "core",
        session_number: 5,
        total_sessions: 3,
      },
    ]

    const result = await commitPlan(invalidSessions, "until", "Invalid counters")

    expect(result).toEqual({
      status: "ERROR",
      message: "Session 1 has session_number greater than total_sessions.",
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rejects duplicate commits in a short interval", async () => {
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
        if (table !== "planner_settings") {
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
      rpc: vi.fn()
        .mockResolvedValueOnce({
          data: {
            status: "SUCCESS",
            task_count: 1,
            snapshot_id: "snapshot-duplicate-guard",
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: {
            message: "duplicate_commit",
          },
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
        session_number: 1,
        total_sessions: 1,
      },
    ]

    const first = await commitPlan(sessions, "until", "First commit")
    const second = await commitPlan(sessions, "until", "Second commit")

    expect(first).toEqual({
      status: "SUCCESS",
      taskCount: 1,
      snapshotId: "snapshot-duplicate-guard",
    })
    expect(second).toEqual({
      status: "ERROR",
      message: "Duplicate commit detected. Please wait a moment before retrying.",
    })
    expect(supabase.rpc).toHaveBeenCalledTimes(2)

    const firstRpcArgs = supabase.rpc.mock.calls[0][1]
    const secondRpcArgs = supabase.rpc.mock.calls[1][1]
    expect(firstRpcArgs.p_commit_hash).toBe(secondRpcArgs.p_commit_hash)
  })

  it("normalizes manual session counters and commits mixed payloads", async () => {
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
        if (table !== "planner_settings") {
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
          snapshot_id: "snapshot-mixed-manual",
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
        session_number: 1,
        total_sessions: 1,
      },
      {
        subject_id: "subject-1",
        topic_id: "",
        title: "Custom Session",
        scheduled_date: "2024-01-03",
        duration_minutes: 45,
        session_type: "core",
        session_number: 0,
        total_sessions: 0,
        is_manual: true,
      },
    ]

    const result = await commitPlan(sessions, "until", "Mixed manual commit")

    expect(result).toEqual({
      status: "SUCCESS",
      taskCount: 2,
      snapshotId: "snapshot-mixed-manual",
    })

    const [, rpcArgs] = supabase.rpc.mock.calls[0]
    expect(rpcArgs.p_tasks).toEqual([
      expect.objectContaining({
        topic_id: "topic-1",
        session_number: 1,
        total_sessions: 1,
      }),
      expect.objectContaining({
        topic_id: null,
        is_manual: true,
        session_number: 1,
        total_sessions: 1,
      }),
    ])
  })
})

