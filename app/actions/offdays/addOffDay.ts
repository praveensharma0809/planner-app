"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface AddOffDayInput {
  date: string
  reason?: string
}

export async function addOffDay(input: AddOffDayInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" as const }
  }

  if (!input.date) {
    return { status: "ERROR" as const, message: "Date is required." }
  }

  const { data, error } = await supabase.from("off_days").insert({
    user_id: user.id,
    date: input.date,
    reason: input.reason?.trim() || null,
  }).select("id").single()

  if (error) {
    // Unique constraint violation means day already exists
    if (error.code === "23505") {
      return { status: "ERROR" as const, message: "This date is already marked as an off day." }
    }
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/settings")
  return { status: "SUCCESS" as const, id: data.id as string }
}
