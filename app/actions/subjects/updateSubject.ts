"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface UpdateSubjectInput {
  id: string
  name: string
  sort_order?: number
  start_date?: string | null
  deadline?: string | null
  rest_after_days?: number
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function updateSubject(input: UpdateSubjectInput) {
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

  const startDate = normalizeOptionalDate(input.start_date)
  const deadline = normalizeOptionalDate(input.deadline)
  if (startDate && deadline && startDate > deadline) {
    return {
      status: "ERROR" as const,
      message: "Subject start date must be on or before subject deadline.",
    }
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      name: input.name.trim(),
      sort_order: input.sort_order,
      start_date: startDate,
      deadline,
      rest_after_days: Math.max(0, Math.trunc(input.rest_after_days ?? 0)),
    })
    .eq("id", input.id)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS" as const }
}
