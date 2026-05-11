"use client"

import { useState } from "react"
import { updateProfile } from "@/app/actions/dashboard/updateProfile"
import { Input } from "@/app/components/ui/Input"
import { Button } from "@/app/components/ui/Button"

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
        setSavedValues(result.saved)
        setFullName(result.saved.fullName)
        setEmail(result.saved.email)
        setPhoneNumber(result.saved.phoneNumber)
        setMessage({ type: "success", text: "Profile updated." })
      } else if (result.status === "PARTIAL_SUCCESS") {
        setSavedValues(result.saved)
        setFullName(result.saved.fullName)
        setEmail(result.saved.email)
        setPhoneNumber(result.saved.phoneNumber)
        setMessage({ type: "error", text: result.message })
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
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 gap-[var(--gap-card)] sm:gap-[var(--gap-card-md)]">
      <Input
        id="settings-fullname"
        label="Full name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />

      <Input
        id="settings-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        hint="Optional. Must be valid if provided."
      />

      <Input
        id="settings-phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="+91 98765 43210"
        hint="Optional. Indian mobile (10 digits starting 6-9, optional +91 prefix)."
      />

      {message && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            message.type === "success"
              ? "border-[var(--pastel-mint-text)]/20 bg-[var(--pastel-mint)] text-[var(--pastel-mint-text)]"
              : "border-[var(--pastel-rose-text)]/20 bg-[var(--pastel-rose)] text-[var(--pastel-rose-text)]"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="pt-1 mt-auto lg:static sticky bottom-0 bg-surface-card pb-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={saving || !isDirty}
          className="min-h-[44px] !bg-black"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  )
}
