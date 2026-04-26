import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("subjectTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("createSubjectTask returns UNAUTHORIZED when no user", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { createSubjectTask } = await import("@/app/actions/subjects/tasks")

    const result = await createSubjectTask({ chapterId: "ch1", title: "Read" })

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("createSubjectTask returns ERROR for empty title", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { createSubjectTask } = await import("@/app/actions/subjects/tasks")

    const result = await createSubjectTask({ chapterId: "ch1", title: "" })

    expect(result).toEqual({ status: "ERROR", message: "Task title is required." })
  })

  it("createSubjectTask returns SUCCESS with taskId", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: createChapterAndInsertMock("ch1", "subj-1", { id: "task-42" }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { createSubjectTask } = await import("@/app/actions/subjects/tasks")

    const result = await createSubjectTask({ chapterId: "ch1", title: "Read Chapter 1" })

    expect(result).toEqual({ status: "SUCCESS", taskId: "task-42" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })

  it("updateSubjectTaskTitle returns SUCCESS and revalidates", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "topic_tasks") {
          return buildTopicTasksTable({ id: "task-1" })
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() }
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { updateSubjectTaskTitle } = await import("@/app/actions/subjects/tasks")

    const result = await updateSubjectTaskTitle("task-1", "Updated Title")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/planner")
  })

  it("deleteSubjectTask returns ERROR when task not found", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "topic_tasks") {
          return buildTopicTasksTable(null)
        }
        return { select: vi.fn() }
      }),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteSubjectTask } = await import("@/app/actions/subjects/tasks")

    const result = await deleteSubjectTask("task-1")

    expect(result).toEqual({ status: "ERROR", message: "Task not found." })
  })
})

function createChapterAndInsertMock(
  chapterId: string,
  subjectId: string,
  inserted: unknown
) {
  const fromCallCounts: Record<string, number> = {}

  return vi.fn((table: string) => {
    fromCallCounts[table] = (fromCallCounts[table] ?? 0) + 1
    const callN = fromCallCounts[table]

    if (table === "topics" && callN === 1) {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: chapterId, subject_id: subjectId }, error: null }),
            })),
          })),
        })),
      }
    }

    if (table === "topic_tasks" && callN === 1) {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { sort_order: 5 }, error: null }),
                  })),
                })),
              })),
            })),
          })),
        })),
      }
    }

    if (table === "topic_tasks" && callN === 2) {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
          })),
        })),
      }
    }

    return { select: vi.fn(), insert: vi.fn(), update: vi.fn() }
  })
}

function buildTopicTasksTable(existing: unknown) {
  let callCount = 0
  const eqMaybeSingle = vi.fn().mockResolvedValue({
    data: existing,
    error: existing ? null : null,
  })

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: eqMaybeSingle,
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  }
}
