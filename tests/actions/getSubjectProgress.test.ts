import { describe, it, expect, vi, beforeEach } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

type SubjectRow = { id: string; name: string }
type TopicRow = { id: string; subject_id: string; deadline: string | null }
type TaskRow = { subject_id: string; completed: boolean }

function datePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function buildSupabaseProgressMock(options: {
  userId?: string | null
  subjects?: SubjectRow[]
  topics?: TopicRow[]
  tasks?: TaskRow[]
}) {
  const {
    userId = "u1",
    subjects = [],
    topics = [],
    tasks = [],
  } = options

  const subjectsOrder = vi.fn().mockResolvedValue({ data: subjects, error: null })
  const subjectsEqArchived = vi.fn(() => ({ order: subjectsOrder }))
  const subjectsEqUser = vi.fn(() => ({ eq: subjectsEqArchived }))

  const topicsIn = vi.fn().mockResolvedValue({ data: topics, error: null })

  const tasksIn = vi.fn().mockResolvedValue({ data: tasks, error: null })
  const tasksEqUser = vi.fn(() => ({ in: tasksIn }))

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "subjects") {
        return {
          select: vi.fn(() => ({ eq: subjectsEqUser })),
        }
      }
      if (table === "topics") {
        return {
          select: vi.fn(() => ({ in: topicsIn })),
        }
      }
      if (table === "tasks") {
        return {
          select: vi.fn(() => ({ eq: tasksEqUser })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return supabase
}

describe("getSubjectProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns UNAUTHORIZED when not signed in", async () => {
    const supabase = buildSupabaseProgressMock({ userId: null })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getSubjectProgress } = await import("@/app/actions/dashboard/getSubjectProgress")

    const result = await getSubjectProgress()
    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("returns empty subjects when user has none", async () => {
    const supabase = buildSupabaseProgressMock({ subjects: [] })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getSubjectProgress } = await import("@/app/actions/dashboard/getSubjectProgress")

    const result = await getSubjectProgress()
    expect(result).toEqual({ status: "SUCCESS", subjects: [] })
  })

  it("computes health statuses from deadlines and completion percent", async () => {
    const subjects: SubjectRow[] = [
      { id: "s1", name: "Physics" },
      { id: "s2", name: "Chemistry" },
      { id: "s3", name: "Math" },
    ]

    const topicsWithDeadlines: TopicRow[] = [
      { id: "t1", subject_id: "s1", deadline: datePlusDays(2) },
      { id: "t2", subject_id: "s2", deadline: datePlusDays(30) },
      { id: "t3", subject_id: "s3", deadline: datePlusDays(-3) },
    ]

    const tasks: TaskRow[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ subject_id: "s1", completed: i < 5 })),
      ...Array.from({ length: 10 }, (_, i) => ({ subject_id: "s2", completed: i < 6 })),
      ...Array.from({ length: 10 }, (_, i) => ({ subject_id: "s3", completed: i < 8 })),
    ]

    const supabase = buildSupabaseProgressMock({ subjects, topics: topicsWithDeadlines, tasks })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getSubjectProgress } = await import("@/app/actions/dashboard/getSubjectProgress")

    const result = await getSubjectProgress()
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    const physics = result.subjects.find((s) => s.id === "s1")
    expect(physics?.percent).toBe(50)
    expect(physics?.health).toBe("at_risk")

    const chemistry = result.subjects.find((s) => s.id === "s2")
    expect(chemistry?.percent).toBe(60)
    expect(chemistry?.health).toBe("on_track")

    const math = result.subjects.find((s) => s.id === "s3")
    expect(math?.percent).toBe(80)
    expect(math?.health).toBe("overdue")
  })

  it("keeps 100% complete past-deadline subjects on_track", async () => {
    const subjects: SubjectRow[] = [{ id: "s1", name: "Done Subject" }]
    const topics: TopicRow[] = [{ id: "t1", subject_id: "s1", deadline: datePlusDays(-5) }]
    const tasks: TaskRow[] = Array.from({ length: 5 }, () => ({
      subject_id: "s1",
      completed: true,
    }))

    const supabase = buildSupabaseProgressMock({ subjects, topics, tasks })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)

    const { getSubjectProgress } = await import("@/app/actions/dashboard/getSubjectProgress")

    const result = await getSubjectProgress()
    expect(result.status).toBe("SUCCESS")
    if (result.status !== "SUCCESS") return

    expect(result.subjects[0].percent).toBe(100)
    expect(result.subjects[0].health).toBe("on_track")
  })
})
