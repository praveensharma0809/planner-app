import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockSubjectResult = vi.fn()
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

  it("returns SUCCESS with taskId when all valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mockSubjectResult.mockResolvedValue({ data: { id: "s1", priority: 2 }, error: null })
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
