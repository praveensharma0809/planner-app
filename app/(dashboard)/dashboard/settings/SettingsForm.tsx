"use client"

import { useState } from "react"
import { updateProfile } from "@/app/actions/dashboard/updateProfile"

interface Props {
  profile: {
    full_name: string | null
    email: string | null
    phone_number: string | null
  }
}

export function SettingsForm({ profile }: Props) {
  const [savedValues, setSavedValues] = useState({
    fullName: profile.full_name ?? "",
    email: profile.email ?? "",
    phoneNumber: profile.phone_number ?? "",
  })
  const [fullName, setFullName] = useState(savedValues.fullName)
  const [email, setEmail] = useState(savedValues.email)
  const [phoneNumber, setPhoneNumber] = useState(savedValues.phoneNumber)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const isDirty =
    fullName !== savedValues.fullName
    || email !== savedValues.email
    || phoneNumber !== savedValues.phoneNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setSaving(true)
    setMessage(null)

    try {
      const result = await updateProfile({
        full_name: fullName,
        email,
        phone_number: phoneNumber,
      })

      if (result.status === "SUCCESS") {
        setSavedValues({ fullName, email, phoneNumber })
        setMessage({ type: "success", text: "Profile updated." })
      } else if (result.status === "ERROR") {
        setMessage({ type: "error", text: result.message })
      } else {
        setMessage({ type: "error", text: "Unauthorized. Please log in again." })
      }
    } catch {
      setMessage({ type: "error", text: "Network error - please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="settings-fullname"
          className="text-sm font-medium text-white/55"
        >
          Full name
        </label>
        <input
          id="settings-fullname"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 text-sm text-white/90 placeholder:text-white/35 transition-[border-color,box-shadow,background-color] focus:border-indigo-300/45 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="settings-email"
          className="text-sm font-medium text-white/55"
        >
          Email
        </label>
        <input
          id="settings-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 text-sm text-white/90 placeholder:text-white/35 transition-[border-color,box-shadow,background-color] focus:border-indigo-300/45 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        />
        <p className="text-xs text-white/40">Optional. Must be valid if provided.</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="settings-phone"
          className="text-sm font-medium text-white/55"
        >
          Phone
        </label>
        <input
          id="settings-phone"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 555 123 4567"
          className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 text-sm text-white/90 placeholder:text-white/35 transition-[border-color,box-shadow,background-color] focus:border-indigo-300/45 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        />
        <p className="text-xs text-white/40">Optional. Must be valid if provided.</p>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
              : "border-rose-400/30 bg-rose-500/[0.08] text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !isDirty}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)] transition-all hover:from-indigo-400 hover:to-violet-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
      >
        {saving ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Saving...
          </>
        ) : (
          "Save changes"
        )}
      </button>
    </form>
  )
}