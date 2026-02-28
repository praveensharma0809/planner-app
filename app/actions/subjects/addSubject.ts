"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface AddSubjectInput {
  name: string
  total_items: number
  avg_duration_minutes: number
  deadline: string
  priority: number
}

export async function addSubject(input: AddSubjectInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" as const }
  }

  if (!input.name.trim()) {
    return { status: "ERROR" as const, message: "Subject name is required." }
  }
  if (input.total_items < 1) {
    return { status: "ERROR" as const, message: "Total items must be at least 1." }
  }
  if (input.avg_duration_minutes < 1) {
    return { status: "ERROR" as const, message: "Avg duration must be at least 1 minute." }
  }
  if (!input.deadline) {
    return { status: "ERROR" as const, message: "Deadline is required." }
  }

  const { error } = await supabase.from("subjects").insert({
    user_id: user.id,
    name: input.name.trim(),
    total_items: input.total_items,
    completed_items: 0,
    avg_duration_minutes: input.avg_duration_minutes,
    deadline: input.deadline,
    priority: input.priority,
    mandatory: false,
  })

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS" as const }
}
