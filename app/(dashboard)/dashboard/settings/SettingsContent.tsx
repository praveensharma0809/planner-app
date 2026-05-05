"use client"

import { Tabs } from "@/app/components/ui/Tabs"
import { SettingsForm } from "./SettingsForm"
import { SettingsFounderMessageButton } from "@/app/components/SettingsFounderMessageButton"
import { Checkbox } from "@/app/components/ui/Checkbox"

interface Props {
  profile: {
    full_name: string | null
    email: string | null
    phone_number: string | null
  }
}

export function SettingsContent({ profile }: Props) {
  const tabs = [
    {
      id: "profile",
      label: "Profile",
      content: <ProfileTab profile={profile} />,
    },
    {
      id: "preferences",
      label: "Preferences",
      content: <PreferencesTab />,
    },
    {
      id: "billing",
      label: "Billing",
      content: <BillingTab />,
    },
  ]

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page-root flex flex-col gap-6 pb-8 pt-6 sm:pt-8">
          <header className="space-y-1">
            <h1 className="text-2xl md:text-3xl xl:text-4xl font-medium tracking-tight text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Manage your profile and preferences.
            </p>
          </header>

          <Tabs tabs={tabs} defaultTab="profile" className="w-full" />
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ profile }: Props) {
  return (
    <section className="panel p-5 sm:p-6">
      <header className="mb-5 space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Profile</h2>
        <p className="text-sm text-[var(--text-secondary)]">Manage your basic identity details.</p>
      </header>
      <SettingsForm
        profile={{
          full_name: profile.full_name,
          email: profile.email,
          phone_number: profile.phone_number,
        }}
      />
    </section>
  )
}

function PreferencesTab() {
  return (
    <section className="panel p-5 sm:p-6 space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Preferences</h2>
        <p className="text-sm text-[var(--text-secondary)]">Customize your experience.</p>
      </header>

      <div className="space-y-4">
        <Checkbox
          id="notifications-toggle"
          label="Email notifications"
          description="Receive email updates about your study plan."
        />
        <Checkbox
          id="reminders-toggle"
          label="Task reminders"
          description="Get reminded before scheduled tasks."
        />
      </div>

      <div className="border-t border-[var(--border-hairline)] pt-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Tutorial &amp; Founder&apos;s Message</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Go through the onboarding tutorial to learn how to use PrepVeda, or read the welcome message from our founder.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/onboarding"
            className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white px-4 text-sm font-medium text-[var(--text-primary)] transition-all hover:bg-[var(--surface-hover)]"
          >
            Restart Tutorial
          </a>
          <SettingsFounderMessageButton />
        </div>
      </div>
    </section>
  )
}

function BillingTab() {
  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Free Plan</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">You are currently on the free plan.</p>
          </div>
          <span className="chip-mint">Current Plan</span>
        </div>
        <ul className="mt-4 space-y-2">
          {[
            "Basic study planning",
            "Up to 5 subjects",
            "Calendar & schedule views",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <svg className="w-4 h-4 text-[var(--pastel-mint-text)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Upgrade to Pro</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Unlock unlimited subjects, advanced analytics, and priority support.
        </p>
        <button
          disabled
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 min-h-[44px] text-sm font-semibold bg-black text-white opacity-40 cursor-not-allowed"
        >
          Coming Soon
        </button>
      </section>
    </div>
  )
}
