/// <reference types="vitest" />

import { createServerSupabaseClientMock, buildSupabaseMock } from "../utils/supabaseMock"

describe("completeTask", () => {
  it("invokes complete_task_with_streak RPC when a user is present", async () => {
    const { supabase } = buildSupabaseMock()
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    await completeTask("task-123")

    expect(supabase.rpc).toHaveBeenCalledWith("complete_task_with_streak", { p_task_id: "task-123" })
  })

  it("does nothing when no user is returned", async () => {
    const { supabase } = buildSupabaseMock()
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    const { completeTask } = await import("@/app/actions/plan/completeTask")

    await completeTask("task-456")

    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
