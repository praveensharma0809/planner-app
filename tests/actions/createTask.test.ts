import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockSubjectResult = vi.fn()
const mockTopicResult = vi.fn()
const mockInsertResult = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => {
        if (table === "subjects") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => mockSubjectResult(),
                }),
              }),
            }),
          }
        }
        if (table === "topics") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => mockTopicResult(),
                }),
              }),
            }),
          }
        }
        // tasks table
        return {
          insert: () => ({
            select: () => ({
              single: () => mockInsertResult(),
            }),
          }),
        }
      },
    }),
}))

const { createTask } = await import("@/app/actions/plan/createTask")

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"))
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", deadline: null, archived: false }, error: null })
    mockTopicResult.mockResolvedValue({
      data: { id: "t1", subject_id: "s1", deadline: null, earliest_start: null, archived: false },
      error: null,
    })
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await createTask({
      subject_id: "s1",
      title: "Test",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })
    expect(result.status).toBe("UNAUTHORIZED")
  })

  it("returns ERROR for empty title", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await createTask({
      subject_id: "s1",
      title: "   ",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })
    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("Title")
  })

  it("returns ERROR for zero duration", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await createTask({
      subject_id: "s1",
      title: "Valid title",
      scheduled_date: "2026-03-10",
      duration_minutes: 0,
    })
    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("Duration")
  })

  it("returns ERROR for missing date", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await createTask({
      subject_id: "s1",
      title: "Valid title",
      scheduled_date: "",
      duration_minutes: 30,
    })
    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("Date")
  })

  it("returns ERROR for invalid date format", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    const result = await createTask({
      subject_id: "s1",
      title: "Valid title",
      scheduled_date: "10-03-2026",
      duration_minutes: 30,
    })
    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("YYYY-MM-DD")
  })

  it("returns ERROR when date is in the past", async () => {
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"))
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })

    const result = await createTask({
      subject_id: "s1",
      title: "Valid title",
      scheduled_date: "2026-03-09",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("past")
  })

  it("normalizes unknown session type to core", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", priority: 2 }, error: null })
    mockInsertResult.mockResolvedValue({ data: { id: "new-task-123" }, error: null })

    const result = await createTask({
      subject_id: "s1",
      title: "My custom task",
      scheduled_date: "2026-03-10",
      duration_minutes: 45,
      session_type: "invalid" as unknown as "core",
    })

    expect(result).toEqual({ status: "SUCCESS", taskId: "new-task-123" })
  })

  it("returns ERROR when subject not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: null, error: { message: "Not found" } })

    const result = await createTask({
      subject_id: "bad-id",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })
    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("Subject")
  })

  it("returns ERROR when subject is archived", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", archived: true, deadline: null }, error: null })

    const result = await createTask({
      subject_id: "s1",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("archived subjects")
  })

  it("returns ERROR when date exceeds subject deadline", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", archived: false, deadline: "2026-03-09" }, error: null })

    const result = await createTask({
      subject_id: "s1",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("subject deadline")
  })

  it("returns ERROR when topic does not belong to selected subject", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTopicResult.mockResolvedValue({
      data: { id: "t1", subject_id: "s2", deadline: null, earliest_start: null, archived: false },
      error: null,
    })

    const result = await createTask({
      subject_id: "s1",
      topic_id: "t1",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("does not belong")
  })

  it("returns ERROR when date is before topic earliest start", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTopicResult.mockResolvedValue({
      data: { id: "t1", subject_id: "s1", deadline: null, earliest_start: "2026-03-11", archived: false },
      error: null,
    })

    const result = await createTask({
      subject_id: "s1",
      topic_id: "t1",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("topic start")
  })

  it("returns ERROR when date exceeds topic deadline", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockTopicResult.mockResolvedValue({
      data: { id: "t1", subject_id: "s1", deadline: "2026-03-09", earliest_start: null, archived: false },
      error: null,
    })

    const result = await createTask({
      subject_id: "s1",
      topic_id: "t1",
      title: "Valid",
      scheduled_date: "2026-03-10",
      duration_minutes: 30,
    })

    expect(result.status).toBe("ERROR")
    if (result.status === "ERROR") expect(result.message).toContain("topic deadline")
  })

  it("returns SUCCESS with taskId when all valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", archived: false, deadline: null }, error: null })
    mockInsertResult.mockResolvedValue({ data: { id: "new-task-123" }, error: null })

    const result = await createTask({
      subject_id: "s1",
      title: "My custom task",
      scheduled_date: "2026-03-10",
      duration_minutes: 45,
    })
    expect(result).toEqual({ status: "SUCCESS", taskId: "new-task-123" })
  })
})
