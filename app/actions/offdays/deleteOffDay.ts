"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteOffDay(offDayId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" as const }
  }

  if (!offDayId || typeof offDayId !== "string") {
    return { status: "ERROR" as const, message: "Invalid off day ID." }
  }

  const { error } = await supabase
    .from("off_days")
    .delete()
    .eq("id", offDayId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/settings")
  return { status: "SUCCESS" as const }
}
