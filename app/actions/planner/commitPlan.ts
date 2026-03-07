"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ScheduledSession } from "@/lib/planner/types"

export type CommitPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskCount: number; snapshotId: string }

export async function commitPlan(
  sessions: ScheduledSession[],
  summary?: string
): Promise<CommitPlanResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  // Load config for snapshot
  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  const tasksJson = JSON.stringify(sessions)
  const configJson = config ? JSON.stringify(config) : "{}"

  const { data, error } = await supabase.rpc("commit_plan_atomic", {
    p_user_id: user.id,
    p_tasks: tasksJson,
    p_snapshot_summary: summary ?? `Committed ${sessions.length} sessions`,
    p_config_snapshot: configJson,
  })

  if (error) {
    console.error("commitPlan error:", error.message)
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  const result = data as { status: string; task_count: number; snapshot_id: string }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/planner")

  return {
    status: "SUCCESS",
    taskCount: result.task_count,
    snapshotId: result.snapshot_id,
  }
}
