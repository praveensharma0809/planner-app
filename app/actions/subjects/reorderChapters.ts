"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ReorderChaptersActionResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function reorderChapters(
  subjectId: string,
  updates: Array<{ id: string; sort_order: number }>
): Promise<ReorderChaptersActionResponse> {
  if (updates.length === 0) {
    return { status: "SUCCESS" }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("topics")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id)
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }
  }

  revalidatePath("/dashboard/subjects")
  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
