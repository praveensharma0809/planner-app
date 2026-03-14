"use client"

import { useState } from "react"
import { updateProfile } from "@/app/actions/dashboard/updateProfile"

interface Props {
  profile: {
    full_name: string | null
    primary_exam: string | null
    exam_date: string | null
    daily_available_minutes: number
  }
}

export function SettingsForm({ profile }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? "")
  const [primaryExam, setPrimaryExam] = useState(profile.primary_exam ?? "")
  const [examDate, setExamDate] = useState(profile.exam_date ?? "")
  const [dailyHours, setDailyHours] = useState(
    String(Math.round(profile.daily_available_minutes / 60))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseInt(dailyHours)
    if (isNaN(parsed) || parsed <= 0) {
      setMessage({ type: "error", text: "Please enter a valid number of hours." })
      return
    }
    setSaving(true)
    setMessage(null)

    try {
      const result = await updateProfile({
        full_name: fullName,
        primary_exam: primaryExam,
        exam_date: examDate,
        daily_available_minutes: parsed * 60,
      })

      if (result.status === "SUCCESS") {
        setMessage({ type: "success", text: "Settings saved." })
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <label htmlFor="settings-fullname" className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Full name</label>
        <input
          id="settings-fullname"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="settings-goal" className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Goal name</label>
        <input
          id="settings-goal"
          type="text"
          value={primaryExam}
          onChange={(e) => setPrimaryExam(e.target.value)}
          placeholder="e.g. CPA certification, product launch, research thesis..."
          required
          className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-white/25"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="settings-hours" className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Daily available hours</label>
        <input
          id="settings-hours"
          type="number"
          value={dailyHours}
          onChange={(e) => setDailyHours(e.target.value)}
          min={1}
          max={16}
          required
          className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
        <p className="text-xs text-white/30">
          {!isNaN(parseInt(dailyHours)) && parseInt(dailyHours) > 0 ? `${parseInt(dailyHours) * 60} minutes` : "&#x2014;"}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="settings-deadline" className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Goal deadline</label>
        <input
          id="settings-deadline"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          required
          className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
      </div>

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-xl ${
            message.type === "success"
              ? "bg-emerald-500/[0.06] text-emerald-400 border border-emerald-500/15"
              : "bg-red-500/[0.06] text-red-400 border border-red-500/15"
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn-primary"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  )
}