"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ReorderTopicsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

/**
 * Batch-update sort_order for multiple topics in one shot.
 * Used by the StudyOrderPanel drag-and-drop reordering UI.
 */
export async function reorderTopics(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ReorderTopicsResponse> {
  if (updates.length === 0) return { status: "SUCCESS" }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from("topics")
      .update({ sort_order })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { status: "ERROR", message: error.message }
  }

  return { status: "SUCCESS" }
}
