import { beforeEach, describe, expect, it, vi } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

const revalidatePathMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

describe("chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("addChapter returns UNAUTHORIZED", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addChapter } = await import("@/app/actions/subjects/chapters")

    const result = await addChapter("subj-1", "Chapter 1")

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("addChapter returns SUCCESS with chapterId", async () => {
    const supabase = buildChapterMock({
      subjectExists: true,
      lastSortOrder: null,
      inserted: { id: "ch-99" },
    })
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { addChapter } = await import("@/app/actions/subjects/chapters")

    const result = await addChapter("subj-1", "Chapter 1")

    expect(result).toEqual({ status: "SUCCESS", chapterId: "ch-99" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
  })

  it("getArchivedChapters returns UNAUTHORIZED", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { getArchivedChapters } = await import("@/app/actions/subjects/chapters")

    const result = await getArchivedChapters()

    expect(result).toEqual({ status: "UNAUTHORIZED" })
  })

  it("archiveChapter returns SUCCESS", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { archived: false }, error: null }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { archiveChapter } = await import("@/app/actions/subjects/chapters")

    const result = await archiveChapter("ch-1")

    expect(result).toEqual({ status: "SUCCESS" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/subjects")
  })

  it("deleteChapter returns ERROR when chapter not found", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
        delete: vi.fn(),
      })),
    }
    createServerSupabaseClientMock.mockResolvedValue(supabase as never)
    const { deleteChapter } = await import("@/app/actions/subjects/chapters")

    const result = await deleteChapter("ch-1")

    expect(result).toEqual({ status: "ERROR", message: "Chapter not found." })
  })
})

function buildChapterMock(opts: {
  subjectExists: boolean
  lastSortOrder: number | null
  inserted: unknown
}) {
  let callCount = 0

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn((table: string) => {
      callCount++

      if (table === "subjects" && callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts.subjectExists ? { id: "subj-1" } : null,
                  error: null,
                }),
              })),
            })),
          })),
        }
      }

      if (table === "topics" && callCount === 2) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: opts.lastSortOrder != null ? { sort_order: opts.lastSortOrder } : null,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        }
      }

      if (table === "topics" && callCount === 3) {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: opts.inserted, error: null }),
            })),
          })),
        }
      }

      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() }
    }),
  }
}
