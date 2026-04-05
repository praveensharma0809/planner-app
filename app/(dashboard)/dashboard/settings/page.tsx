import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./SettingsForm"
import { ThemeToggle } from "@/app/components/ThemeToggle"
import Link from "next/link"

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const profileResult = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single()

  const profile = profileResult.data
  if (!profile) redirect("/onboarding")

  return (
    <div className="page-root flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full space-y-6 pb-8 pt-6 sm:pt-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight gradient-text sm:text-4xl">Settings</h1>
            <p className="text-sm text-white/45">Manage your profile and preferences.</p>
          </header>

          <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
            <section className="space-y-5 rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-white/90">Profile</h2>
                <p className="text-sm text-white/45">Manage your basic identity details.</p>
              </header>
              <SettingsForm
                profile={{
                  full_name: profile.full_name,
                  email: user.email ?? null,
                  phone_number: profile.phone,
                }}
              />
            </section>

            <div className="space-y-6">
              <section className="space-y-4 overflow-x-hidden rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
                <header className="space-y-1">
                  <h2 className="text-lg font-semibold text-white/90">Appearance</h2>
                </header>
                <ThemeToggle />
              </section>

              <section className="space-y-4 rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
                <header className="space-y-1">
                  <h2 className="text-lg font-semibold text-white/90">Onboarding</h2>
                  <p className="text-sm text-white/45">Reconfigure your subjects, plan, and preferences.</p>
                </header>
                <Link
                  href="/onboarding"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.1]"
                >
                  Re-run onboarding
                </Link>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}