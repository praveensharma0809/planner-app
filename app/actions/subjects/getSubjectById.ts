"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject } from "@/lib/types/db"

export type GetSubjectByIdResponse =
  | { status: "SUCCESS"; subject: Subject }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function getSubjectById(subjectId: string): Promise<GetSubjectByIdResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { status: "UNAUTHORIZED" }

    const { data, error } = await supabase
      .from("subjects")
      .select("id, user_id, name, sort_order, archived, deadline, created_at")
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .single()

    if (error || !data) {
      return { status: "ERROR", message: "Subject not found." }
    }

    return { status: "SUCCESS", subject: data as Subject }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
