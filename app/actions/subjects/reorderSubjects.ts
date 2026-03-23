"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ReorderSubjectsActionResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function reorderSubjects(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ReorderSubjectsActionResponse> {
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
      .from("subjects")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR", message: error.message }
    }
  }

  revalidatePath("/dashboard/subjects")
  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
