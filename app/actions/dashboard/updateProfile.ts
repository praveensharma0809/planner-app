"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface UpdateProfileInput {
  full_name: string
  primary_exam: string
  exam_date: string
  daily_available_minutes: number
}

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" as const }
  }

  // Validate
  if (!input.full_name.trim()) {
    return { status: "ERROR" as const, message: "Full name is required." }
  }
  if (!input.primary_exam.trim()) {
    return { status: "ERROR" as const, message: "Goal name is required." }
  }
  if (!input.exam_date) {
    return { status: "ERROR" as const, message: "Goal deadline is required." }
  }
  if (
    !input.daily_available_minutes ||
    input.daily_available_minutes < 15 ||
    input.daily_available_minutes > 960
  ) {
    return {
      status: "ERROR" as const,
      message: "Daily minutes must be between 15 and 960.",
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      primary_exam: input.primary_exam.trim(),
      exam_date: input.exam_date,
      daily_available_minutes: input.daily_available_minutes,
    })
    .eq("id", user.id)

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
  return { status: "SUCCESS" as const }
}
