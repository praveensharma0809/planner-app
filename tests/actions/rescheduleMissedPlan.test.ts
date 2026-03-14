import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()
const trackServerEventMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/ops/telemetry", () => ({
  durationSince: vi.fn(() => 0),
  trackServerEvent: trackServerEventMock,
}))

type QueryResult<T> = {
  data: T
  error: { message: string } | null
}

type PendingTaskRow = {
  subject_id: string
  topic_id: string | null
  title: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  priority: number
  session_number: number | null
  total_sessions: number | null
  scheduled_date: string
}

type ExistingTaskRow = {
  scheduled_date: string
  duration_minutes: number
  is_plan_generated: boolean
  completed: boolean
}

function createThenableQuery<T>(
  result: QueryResult<T>,
  record?: {
    eq?: Array<[string, unknown]>
    gte?: Array<[string, unknown]>
    lte?: Array<[string, unknown]>
    order?: Array<[string, unknown]>
  }
) {
  const query = {
    eq: vi.fn((column: string, value: unknown) => {
      record?.eq?.push([column, value])
      return query
    }),
    gte: vi.fn((column: string, value: unknown) => {
      record?.gte?.push([column, value])
      return query
    }),
    lte: vi.fn((column: string, value: unknown) => {
      record?.lte?.push([column, value])
      return query
    }),
    order: vi.fn((column: string, value: unknown) => {
      record?.order?.push([column, value])
      return query
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: QueryResult<T>) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return query
}

function buildRescheduleSupabaseMock(options: {
  userId?: string | null
  pendingTasks?: PendingTaskRow[]
  existingTasks?: ExistingTaskRow[]
  profile?: { daily_available_minutes: number; exam_date: string | null } | null
  config?: Record<string, unknown> | null
  offDays?: Array<{ date: string }>
  subjects?: Array<{ id: string; name: string; sort_order: number }>
  topics?: Array<{ id: string; user_id: string; subject_id: string; name: string; sort_order: number; created_at: string }>
  topicParams?: Array<Record<string, unknown>>
  snapshotId?: string | null
} = {}) {
  const {
    userId = "user-1",
    pendingTasks = [],
    existingTasks = [],
    profile = {
      daily_available_minutes: 60,
      exam_date: "2026-03-03",
    },
    config = {
      study_start_date: "2026-03-01",
      exam_date: "2026-03-03",
      weekday_capacity_minutes: 60,
      weekend_capacity_minutes: 60,
      plan_order: "balanced",
      final_revision_days: 0,
      buffer_percentage: 0,
      max_active_subjects: 0,
      day_of_week_capacity: null,
      custom_day_capacity: null,
      plan_order_stack: ["urgency", "priority", "deadline"],
      flexibility_minutes: 0,
      max_daily_minutes: 480,
      max_topics_per_subject_per_day: 1,
      min_subject_gap_days: 0,
      subject_ordering: null,
      flexible_threshold: null,
    },
    offDays = [],
    subjects = [],
    topics = [],
    topicParams = [],
    snapshotId = "snapshot-1",
  } = options

  const deleteFilters = {
    eq: [] as Array<[string, unknown]>,
    gte: [] as Array<[string, unknown]>,
    lte: [] as Array<[string, unknown]>,
    order: [] as Array<[string, unknown]>,
  }

  const taskInsertPayloads: unknown[] = []
  const snapshotInsertPayloads: unknown[] = []

  const pendingTasksQuery = createThenableQuery({ data: pendingTasks, error: null })
  const existingTasksQuery = createThenableQuery({ data: existingTasks, error: null })
  const deleteQuery = createThenableQuery({ data: null, error: null }, deleteFilters)
  const profileQuery = createThenableQuery({ data: profile, error: null })
  const configQuery = createThenableQuery({ data: config, error: null })
  const offDaysQuery = createThenableQuery({ data: offDays, error: null })
  const subjectsQuery = createThenableQuery({ data: subjects, error: null })
  const topicsQuery = createThenableQuery({ data: topics, error: null })
  const topicParamsQuery = createThenableQuery({ data: topicParams, error: null })
  const snapshotMaybeSingle = vi.fn().mockResolvedValue({
    data: snapshotId ? { id: snapshotId } : null,
    error: null,
  })

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "tasks") {
        return {
          select: vi.fn((columns: string) => {
            if (columns.includes("subject_id, topic_id, title")) {
              return pendingTasksQuery
            }
            if (columns.includes("scheduled_date, duration_minutes, is_plan_generated, completed")) {
              return existingTasksQuery
            }
            throw new Error(`Unexpected tasks select: ${columns}`)
          }),
          delete: vi.fn(() => deleteQuery),
          insert: vi.fn(async (payload: unknown) => {
            taskInsertPayloads.push(payload)
            return { data: null, error: null }
          }),
        }
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => profileQuery),
        }
      }

      if (table === "plan_config") {
        return {
          select: vi.fn(() => configQuery),
        }
      }

      if (table === "off_days") {
        return {
          select: vi.fn(() => offDaysQuery),
        }
      }

      if (table === "subjects") {
        return {
          select: vi.fn(() => subjectsQuery),
        }
      }

      if (table === "topics") {
        return {
          select: vi.fn(() => topicsQuery),
        }
      }

      if (table === "topic_params") {
        return {
          select: vi.fn(() => topicParamsQuery),
        }
      }

      if (table === "plan_snapshots") {
        return {
          insert: vi.fn((payload: unknown) => {
            snapshotInsertPayloads.push(payload)
            return {
              select: vi.fn(() => ({
                maybeSingle: snapshotMaybeSingle,
              })),
            }
          }),
        }
      }

      if (table === "ops_events") {
        return {
          insert: vi.fn(async () => ({ data: null, error: null })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return {
    supabase,
    deleteFilters,
    taskInsertPayloads,
    snapshotInsertPayloads,
  }
}

describe("rescheduleMissedPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useRealTimers()
    trackServerEventMock.mockResolvedValue(undefined)
  })

  it("returns UNAUTHORIZED when no user is signed in", async () => {
    const { supabase } = buildRescheduleSupabaseMock({ userId: null })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { rescheduleMissedPlan } = await import("@/app/actions/plan/rescheduleMissedPlan")

    const result = await rescheduleMissedPlan()

    expect(result).toEqual({ status: "UNAUTHORIZED" })
    expect(supabase.from).not.toHaveBeenCalledWith("tasks")
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("returns NO_CAPACITY when no usable study days remain", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))

    const { supabase, taskInsertPayloads } = buildRescheduleSupabaseMock({
      pendingTasks: [
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Math - Algebra (1/1)",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 1,
          total_sessions: 1,
          scheduled_date: "2026-02-27",
        },
      ],
      config: {
        study_start_date: "2026-03-01",
        exam_date: "2026-03-01",
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        plan_order: "balanced",
        final_revision_days: 0,
        buffer_percentage: 0,
        max_active_subjects: 0,
        day_of_week_capacity: null,
        custom_day_capacity: null,
        plan_order_stack: ["urgency", "priority", "deadline"],
        flexibility_minutes: 0,
        max_daily_minutes: 480,
        max_topics_per_subject_per_day: 1,
        min_subject_gap_days: 0,
        subject_ordering: null,
        flexible_threshold: null,
      },
      offDays: [{ date: "2026-03-01" }],
    })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { rescheduleMissedPlan } = await import("@/app/actions/plan/rescheduleMissedPlan")

    const result = await rescheduleMissedPlan()

    expect(result).toEqual({
      status: "NO_CAPACITY",
      message: "No available study days found between today and your exam date.",
    })
    expect(taskInsertPayloads).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("reschedules all pending generated sessions when capacity exists", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))

    const { supabase, taskInsertPayloads, snapshotInsertPayloads } = buildRescheduleSupabaseMock({
      pendingTasks: [
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Math - Algebra (1/1)",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 1,
          total_sessions: 1,
          scheduled_date: "2026-02-28",
        },
      ],
      subjects: [{ id: "subject-1", name: "Math", sort_order: 0 }],
      topics: [
        {
          id: "topic-1",
          user_id: "user-1",
          subject_id: "subject-1",
          name: "Algebra",
          sort_order: 0,
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      topicParams: [
        {
          id: "param-1",
          user_id: "user-1",
          topic_id: "topic-1",
          estimated_hours: 1,
          priority: 1,
          deadline: "2026-03-03",
          earliest_start: null,
          depends_on: [],
          revision_sessions: 0,
          practice_sessions: 0,
          session_length_minutes: 60,
          rest_after_days: 0,
          max_sessions_per_day: 1,
          study_frequency: "daily",
          tier: 0,
          created_at: "2026-02-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
    })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { rescheduleMissedPlan } = await import("@/app/actions/plan/rescheduleMissedPlan")

    const result = await rescheduleMissedPlan()

    expect(result).toEqual({
      status: "SUCCESS",
      movedTaskCount: 1,
      unscheduledTaskCount: 0,
      keptCompletedCount: 0,
      droppedReasons: [],
    })

    expect(taskInsertPayloads).toHaveLength(1)
    expect(taskInsertPayloads[0]).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-1",
        topic_id: "topic-1",
        scheduled_date: "2026-03-01",
        duration_minutes: 60,
        session_number: 1,
        total_sessions: 1,
        is_plan_generated: true,
        plan_version: "snapshot-1",
      }),
    ])

    expect(snapshotInsertPayloads).toHaveLength(1)
    expect(snapshotInsertPayloads[0]).toEqual(
      expect.objectContaining({
        user_id: "user-1",
        task_count: 1,
        summary: "Rescheduled 1 pending plan sessions",
      })
    )

    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/calendar")
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })

  it("returns dropped reasons when some pending sessions cannot fit before their deadline", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))

    const { supabase, taskInsertPayloads, deleteFilters } = buildRescheduleSupabaseMock({
      pendingTasks: [
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Math - Algebra (1/2)",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 1,
          total_sessions: 2,
          scheduled_date: "2026-02-26",
        },
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Math - Algebra (2/2)",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 2,
          total_sessions: 2,
          scheduled_date: "2026-02-27",
        },
      ],
      existingTasks: [
        {
          scheduled_date: "2026-03-02",
          duration_minutes: 60,
          is_plan_generated: true,
          completed: true,
        },
      ],
      subjects: [{ id: "subject-1", name: "Math", sort_order: 0 }],
      topics: [
        {
          id: "topic-1",
          user_id: "user-1",
          subject_id: "subject-1",
          name: "Algebra",
          sort_order: 0,
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      topicParams: [
        {
          id: "param-1",
          user_id: "user-1",
          topic_id: "topic-1",
          estimated_hours: 2,
          priority: 1,
          deadline: "2026-03-02",
          earliest_start: null,
          depends_on: [],
          revision_sessions: 0,
          practice_sessions: 0,
          session_length_minutes: 60,
          rest_after_days: 0,
          max_sessions_per_day: 1,
          study_frequency: "daily",
          tier: 0,
          created_at: "2026-02-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
    })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { rescheduleMissedPlan } = await import("@/app/actions/plan/rescheduleMissedPlan")

    const result = await rescheduleMissedPlan()

    expect(result).toEqual({
      status: "SUCCESS",
      movedTaskCount: 1,
      unscheduledTaskCount: 1,
      keptCompletedCount: 1,
      droppedReasons: [
        {
          topicId: "topic-1",
          title: "Algebra",
          droppedSessions: 1,
          reason: "no slot before deadline after preserving existing tasks",
        },
      ],
    })

    expect(taskInsertPayloads).toHaveLength(1)
    expect(taskInsertPayloads[0]).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-1",
        topic_id: "topic-1",
        scheduled_date: "2026-03-01",
        session_number: 1,
        total_sessions: 2,
      }),
    ])

    expect(deleteFilters.eq).toEqual([
      ["user_id", "user-1"],
      ["is_plan_generated", true],
      ["completed", false],
    ])
  })

  it("preserves dependency ordering when rebuilding pending tasks", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))

    const { supabase, taskInsertPayloads } = buildRescheduleSupabaseMock({
      pendingTasks: [
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Math - Foundations",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 1,
          total_sessions: 1,
          scheduled_date: "2026-02-25",
        },
        {
          subject_id: "subject-1",
          topic_id: "topic-2",
          title: "Math - Advanced",
          duration_minutes: 60,
          session_type: "core",
          priority: 1,
          session_number: 1,
          total_sessions: 1,
          scheduled_date: "2026-02-26",
        },
      ],
      config: {
        study_start_date: "2026-03-01",
        exam_date: "2026-03-04",
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
        plan_order: "balanced",
        final_revision_days: 0,
        buffer_percentage: 0,
        max_active_subjects: 0,
        day_of_week_capacity: null,
        custom_day_capacity: null,
        plan_order_stack: ["urgency", "priority", "deadline"],
        flexibility_minutes: 0,
        max_daily_minutes: 480,
        max_topics_per_subject_per_day: 2,
        min_subject_gap_days: 0,
        subject_ordering: { "subject-1": "parallel" },
        flexible_threshold: null,
      },
      subjects: [{ id: "subject-1", name: "Math", sort_order: 0 }],
      topics: [
        {
          id: "topic-1",
          user_id: "user-1",
          subject_id: "subject-1",
          name: "Foundations",
          sort_order: 0,
          created_at: "2026-02-01T00:00:00Z",
        },
        {
          id: "topic-2",
          user_id: "user-1",
          subject_id: "subject-1",
          name: "Advanced",
          sort_order: 1,
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      topicParams: [
        {
          id: "param-1",
          user_id: "user-1",
          topic_id: "topic-1",
          estimated_hours: 1,
          priority: 1,
          deadline: "2026-03-04",
          earliest_start: null,
          depends_on: [],
          revision_sessions: 0,
          practice_sessions: 0,
          session_length_minutes: 60,
          rest_after_days: 0,
          max_sessions_per_day: 1,
          study_frequency: "daily",
          tier: 0,
          created_at: "2026-02-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
        {
          id: "param-2",
          user_id: "user-1",
          topic_id: "topic-2",
          estimated_hours: 1,
          priority: 1,
          deadline: "2026-03-04",
          earliest_start: null,
          depends_on: ["topic-1"],
          revision_sessions: 0,
          practice_sessions: 0,
          session_length_minutes: 60,
          rest_after_days: 0,
          max_sessions_per_day: 1,
          study_frequency: "daily",
          tier: 0,
          created_at: "2026-02-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
    })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { rescheduleMissedPlan } = await import("@/app/actions/plan/rescheduleMissedPlan")

    const result = await rescheduleMissedPlan()

    expect(result).toEqual({
      status: "SUCCESS",
      movedTaskCount: 2,
      unscheduledTaskCount: 0,
      keptCompletedCount: 0,
      droppedReasons: [],
    })

    expect(taskInsertPayloads).toHaveLength(1)
    expect(taskInsertPayloads[0]).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-1",
        topic_id: "topic-1",
        scheduled_date: "2026-03-01",
        session_number: 1,
        total_sessions: 1,
      }),
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-1",
        topic_id: "topic-2",
        scheduled_date: "2026-03-02",
        session_number: 1,
        total_sessions: 1,
      }),
    ])
  })
})
