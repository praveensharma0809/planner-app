"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { OffDay } from "@/lib/types/db"

export async function getOffDays(): Promise<
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; offDays: OffDay[] }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data } = await supabase
    .from("off_days")
    .select("id, user_id, date, reason, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: true })

  return { status: "SUCCESS", offDays: data ?? [] }
}
