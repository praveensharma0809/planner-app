import { vi } from "vitest"

// Centralized Supabase mock so tests can safely import server actions
export const createServerSupabaseClientMock = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock
}))

export interface DeleteFilters {
  eq: Array<[string, unknown]>
  gte: Array<[string, unknown]>
}

export function buildSupabaseMock(userId = "user-1") {
  const deleteFilters: DeleteFilters = { eq: [], gte: [] }
  const insertPayloads: unknown[] = []

  const deleteChain = {
    eq: vi.fn((column: string, value: unknown) => {
      deleteFilters.eq.push([column, value])
      return deleteChain
    }),
    gte: vi.fn((column: string, value: unknown) => {
      deleteFilters.gte.push([column, value])
      return deleteChain
    })
  }

  const tasksTable = {
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(async (payload: unknown) => {
      insertPayloads.push(payload)
      return { data: null, error: null }
    })
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } })
    },
    from: vi.fn((table: string) => {
      if (table !== "tasks") {
        throw new Error(`Unexpected table ${table}`)
      }
      return tasksTable
    }),
    rpc: vi.fn(async () => ({ data: null, error: null }))
  }

  return { supabase, deleteFilters, insertPayloads, tasksTable }
}
