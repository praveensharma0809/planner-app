"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ScheduledSession } from "@/lib/planner/types"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"

export type KeepPreviousMode = "future" | "until" | "none" | "merge"

export type CommitPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskCount: number; snapshotId: string }

export async function commitPlan(
  sessions: ScheduledSession[],
  keepMode: KeepPreviousMode = "future",
  summary?: string
): Promise<CommitPlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  // Load config for snapshot
  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  // Derive the earliest date in the new plan
  const newPlanStartDate = sessions.length > 0
    ? sessions.reduce((earliest, s) =>
        s.scheduled_date < earliest ? s.scheduled_date : earliest,
        sessions[0].scheduled_date)
    : null

  const { data, error } = await supabase.rpc("commit_plan_atomic", {
    p_user_id: user.id,
    p_tasks: sessions,
    p_snapshot_summary: summary ?? `Committed ${sessions.length} sessions`,
    p_config_snapshot: config ?? {},
    p_keep_mode: keepMode,
    p_new_plan_start_date: newPlanStartDate,
  })

  if (error) {
    console.error("commitPlan error:", error.message)
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata: {
        reason: "rpc_error",
        keepMode,
        sessionCount: sessions.length,
        message: error.message,
      },
    })
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  const result = data as { status: string; task_count: number; snapshot_id: string } | null

  if (!result || result.status !== "SUCCESS") {
    await trackServerEvent({
      supabase,
      eventName: "planner.commit",
      status: "error",
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata: {
        reason: "rpc_non_success",
        keepMode,
        sessionCount: sessions.length,
        rpcStatus: result?.status ?? null,
      },
    })
    return { status: "ERROR", message: "Failed to commit plan." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/calendar")
  revalidatePath("/planner")

  await trackServerEvent({
    supabase,
    eventName: "planner.commit",
    status: "success",
    userId: user.id,
    durationMs: durationSince(startedAt),
    metadata: {
      keepMode,
      sessionCount: sessions.length,
      taskCount: result.task_count,
      snapshotId: result.snapshot_id,
    },
  })

  return {
    status: "SUCCESS",
    taskCount: result.task_count,
    snapshotId: result.snapshot_id,
  }
}
