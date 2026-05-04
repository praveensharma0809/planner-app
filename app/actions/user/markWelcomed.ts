"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Sets profiles.welcomed_at to the current timestamp for the signed-in user.
 * Called when the user closes the founder welcome modal for the first time.
 */
export async function markWelcomed(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from("profiles")
    // welcomed_at is a new column not yet in generated types — cast to bypass.
    .update({ welcomed_at: new Date().toISOString() } as never)
    .eq("id", user.id)
}
