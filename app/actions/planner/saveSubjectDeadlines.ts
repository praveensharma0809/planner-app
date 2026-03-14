"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function saveSubjectDeadlines(
  updates: Array<{ id: string; deadline: string | null }>
): Promise<{ status: "SUCCESS" | "ERROR" | "UNAUTHORIZED"; message?: string }> {
  if (updates.length === 0) return { status: "SUCCESS" }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  for (const { id, deadline } of updates) {
    const { error } = await supabase
      .from("subjects")
      .update({ deadline: deadline || null })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { status: "ERROR", message: error.message }
  }

  return { status: "SUCCESS" }
}
