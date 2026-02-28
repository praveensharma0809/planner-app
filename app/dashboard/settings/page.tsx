import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./SettingsForm"
import { OffDaysManager } from "./OffDaysManager"
import { getOffDays } from "@/app/actions/offdays/getOffDays"
import { ThemeToggle } from "@/app/components/ThemeToggle"
import Link from "next/link"

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [profileResult, offDaysResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, primary_exam, exam_date, daily_available_minutes")
      .eq("id", user.id)
      .single(),
    getOffDays(),
  ])

  const profile = profileResult.data
  if (!profile) redirect("/onboarding")

  const offDays = offDaysResult.status === "SUCCESS" ? offDaysResult.offDays : []

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-10">
      <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Settings</h1>
      <SettingsForm profile={profile} />

      <hr className="border-white/[0.06]" />

      <OffDaysManager initialOffDays={offDays} />

      <hr className="border-white/[0.06]" />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Appearance</h2>
        <ThemeToggle />
      </section>

      <hr className="border-white/[0.06]" />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Onboarding</h2>
        <p className="text-sm text-white/40">
          Re-run the setup wizard to update your profile, subjects, and study preferences from scratch.
        </p>
        <Link
          href="/onboarding"
          className="inline-block px-4 py-2 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all text-white/60"
        >
          Re-run Onboarding Wizard
        </Link>
      </section>
    </div>
  )
}