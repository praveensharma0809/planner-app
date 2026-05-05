import { createServerSupabaseClient } from "@/lib/supabase/server"
import { SettingsContent } from "./SettingsContent"

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <SettingsContent profile={{ full_name: null, email: null, phone_number: null }} />
  }

  const profileResult = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single()

  const profile = profileResult.data
  if (!profile) {
    return <SettingsContent profile={{ full_name: null, email: null, phone_number: null }} />
  }

  return (
    <SettingsContent
      profile={{
        full_name: profile.full_name,
        email: user.email ?? null,
        phone_number: profile.phone,
      }}
    />
  )
}
