/// <reference types="vitest" />

import { vi, describe, it, expect, beforeEach } from "vitest"
import { createServerSupabaseClientMock } from "../utils/supabaseMock"

function buildCompleteTaskMock(options: {
  userId?: string | null
  taskUpdateResult?: { subject_id: string } | null
  subjectResult?: { completed_items: number } | null
  profileResult?: {
    streak_current: number
    streak_longest: number
    streak_last_completed_date: string | null
  } | null
} = {}) {
  const {
    userId = "user-1",
    taskUpdateResult = { subject_id: "subject-1" },
    subjectResult = { completed_items: 2 },
    profileResult = {
      streak_current: 0,
      streak_longest: 0,
      streak_last_completed_date: null
    }
  } = options

  const calls: string[] = []

  // Chainable query builder factory
  function makeChain(finalValue: unknown) {
    const chain: Record<string, unknown> = {}
    const methods = ["update", "select", "eq", "maybeSingle", "single"]
    for (const m of methods) {
      chain[m] = vi.fn((..._args: unknown[]) => {
        // maybeSingle resolves with the final value
        if (m === "maybeSingle" || m === "single") {
          return Promise.resolve({ data: finalValue, error: null })
        }
        return chain
      })
    }
    return chain
  }

  const tasksChain = makeChain(taskUpdateResult)
  const subjectsSelectChain = makeChain(subjectResult)
  const subjectsUpdateChain = makeChain(null)
  const profilesSelectChain = makeChain(profileResult)
  const profilesUpdateChain = makeChain(null)

  let subjectsSelectCalled = false

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null }
      })
    },
    from: vi.fn((table: string) => {
      calls.push(table)
      if (table === "tasks") return tasksChain
      if (table === "subjects") {
        if (!subjectsSelectCalled) {
          subjectsSelectCalled = true
          return subjectsSelectChain
        }
        return subjectsUpdateChain
      }
      if (table === "profiles") {
        if (!profileResult) return profilesSelectChain
        const already = calls.filter(c => c === "profiles").length
        return already <= 1 ? profilesSelectChain : profilesUpdateChain
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
    rpc: vi.fn(async () => ({ data: null, error: null }))
  }

  return { supabase, calls }
}

describe("completeTask", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("marks the task complete via direct table update, not RPC", async () => {
    const { supabase } = buildCompleteTaskMock()
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    await completeTask("task-123")

    // Must NOT use RPC at all
    expect(supabase.rpc).not.toHaveBeenCalled()
    // Must have queried the tasks table
    expect(supabase.from).toHaveBeenCalledWith("tasks")
  })

  it("does nothing when no user is returned", async () => {
    const { supabase } = buildCompleteTaskMock({ userId: null })
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    await completeTask("task-456")

    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("does not update subject or profile when task was already complete", async () => {
    const { supabase } = buildCompleteTaskMock({ taskUpdateResult: null })
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    await completeTask("task-789")

    // tasks table queried, but subjects and profiles should NOT be queried
    expect(supabase.from).toHaveBeenCalledWith("tasks")
    expect(supabase.from).not.toHaveBeenCalledWith("subjects")
    expect(supabase.from).not.toHaveBeenCalledWith("profiles")
  })
})

