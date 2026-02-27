"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export type GetStreakResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_PROFILE" }
  | {
      status: "SUCCESS"
      streak_current: number
      streak_longest: number
      streak_last_completed_date: string | null
    }

export async function getStreak(): Promise<GetStreakResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_current, streak_longest, streak_last_completed_date")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    return { status: "NO_PROFILE" }
  }

  return {
    status: "SUCCESS",
    streak_current: profile.streak_current ?? 0,
    streak_longest: profile.streak_longest ?? 0,
    streak_last_completed_date: profile.streak_last_completed_date ?? null
  }
}