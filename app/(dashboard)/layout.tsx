import { createServerSupabaseClient } from "@/lib/supabase/server"
import { AppShell } from "@/app/components/layout/AppShell"

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let showFounderMessage = false

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("welcomed_at")
        .eq("id", user.id)
        .maybeSingle()

      // Show the modal only if the user has never dismissed it.
      // welcomed_at is a new column; cast to bypass generated-types lag.
      const profile = data as { welcomed_at: string | null } | null
      showFounderMessage = profile !== null && profile.welcomed_at === null
    }
  } catch {
    // If the profile fetch fails for any reason, don't show the modal.
    showFounderMessage = false
  }

  return (
    <AppShell showFounderMessage={showFounderMessage}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-stretch overflow-hidden">
        {children}
      </div>
    </AppShell>
  )
}
