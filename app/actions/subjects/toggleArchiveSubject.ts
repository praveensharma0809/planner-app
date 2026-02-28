"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ToggleArchiveResponse =
  | { status: "SUCCESS"; archived: boolean }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function toggleArchiveSubject(subjectId: string): Promise<ToggleArchiveResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  try {
    // Fetch current archive state
    const { data: subject, error: fetchErr } = await supabase
      .from("subjects")
      .select("id, archived")
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .single()

    if (fetchErr || !subject) {
      // Column may not exist if migration hasn't been run
      if (fetchErr?.message?.includes("archived")) {
        return { status: "ERROR", message: "Archive feature requires a database migration. Please run the latest migration SQL." }
      }
      return { status: "ERROR", message: "Subject not found" }
    }

    const newArchived = !subject.archived

    const { error } = await supabase
      .from("subjects")
      .update({ archived: newArchived })
      .eq("id", subjectId)
      .eq("user_id", user.id)

    if (error) {
      if (error.message?.includes("archived")) {
        return { status: "ERROR", message: "Archive feature requires a database migration. Please run the latest migration SQL." }
      }
      return { status: "ERROR", message: error.message }
    }

    revalidatePath("/dashboard/subjects")
    revalidatePath("/dashboard")
    return { status: "SUCCESS", archived: newArchived }
  } catch {
    return { status: "ERROR", message: "Failed to toggle archive status." }
  }
}
