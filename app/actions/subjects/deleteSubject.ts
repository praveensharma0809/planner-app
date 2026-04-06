"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteSubject(subjectId: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" as const }
    }

    if (!subjectId || typeof subjectId !== "string") {
      return { status: "ERROR" as const, message: "Invalid subject ID." }
    }

    const { data: existingSubject, error: existingError } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      return { status: "ERROR" as const, message: existingError.message }
    }

    if (!existingSubject) {
      return { status: "ERROR" as const, message: "Subject not found." }
    }

    // Defensive cleanup: remove children first so subject deletion cannot leave residual rows
    // even if foreign keys are misconfigured in a downstream environment.
    const { error: taskError } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)

    if (taskError) {
      return { status: "ERROR" as const, message: taskError.message }
    }

    const { error: topicTaskError } = await supabase
      .from("topic_tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)

    if (topicTaskError) {
      return { status: "ERROR" as const, message: topicTaskError.message }
    }

    const { error: topicError } = await supabase
      .from("topics")
      .delete()
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)

    if (topicError) {
      return { status: "ERROR" as const, message: topicError.message }
    }

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR" as const, message: error.message }
    }

    revalidatePath("/dashboard/subjects")
    revalidatePath("/dashboard")
    revalidatePath("/planner")
    return { status: "SUCCESS" as const }
  } catch (error) {
    return {
      status: "ERROR" as const,
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
