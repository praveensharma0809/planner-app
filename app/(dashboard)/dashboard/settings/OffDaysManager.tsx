"use client"

import { useState } from "react"
import { addOffDay } from "@/app/actions/offdays/addOffDay"
import { deleteOffDay } from "@/app/actions/offdays/deleteOffDay"
import type { OffDay } from "@/lib/types/db"

interface Props {
  initialOffDays: OffDay[]
}

export function OffDaysManager({ initialOffDays }: Props) {
  const [offDays, setOffDays] = useState<OffDay[]>(initialOffDays)
  const [newDate, setNewDate] = useState("")
  const [newReason, setNewReason] = useState("")
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDate) return
    setAdding(true)
    setError(null)

    try {
      const result = await addOffDay({ date: newDate, reason: newReason || undefined })

      if (result.status === "SUCCESS") {
        setOffDays(prev => [
          ...prev,
          {
            id: result.id,
            user_id: "",
            date: newDate,
            reason: newReason.trim() || null,
            created_at: new Date().toISOString(),
          },
        ].sort((a, b) => (a.date > b.date ? 1 : -1)))
        setNewDate("")
        setNewReason("")
      } else if (result.status === "ERROR") {
        setError(result.message)
      } else {
        setError("Please sign in again.")
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)

    try {
      const result = await deleteOffDay(id)

      if (result.status === "SUCCESS") {
        setOffDays(prev => prev.filter(d => d.id !== id))
      } else if (result.status === "ERROR") {
        setError(result.message)
      } else {
        setError("Please sign in again.")
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Off Days</h2>
        <span className="text-xs text-white/30">{offDays.length} day{offDays.length !== 1 ? "s" : ""}</span>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          min={today}
          required
          aria-label="Off day date"
          className="flex-1 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
        <input
          type="text"
          value={newReason}
          onChange={e => setNewReason(e.target.value)}
          placeholder="Reason (optional)"
          aria-label="Reason for off day"
          className="flex-1 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-white/25"
        />
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add off day"}
        </button>
      </form>

      {error && (
        <div className="text-sm px-3 py-2 rounded-xl bg-red-500/[0.06] text-red-400 border border-red-500/15">
          {error}
        </div>
      )}

      {offDays.length === 0 ? (
        <p className="text-sm text-white/30">No off days configured. Add rest days or holidays above.</p>
      ) : (
        <div className="space-y-2">
          {offDays.map(day => {
            const formatted = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })
            const isPast = day.date < today
            return (
              <div
                key={day.id}
                className={`flex items-center justify-between gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 ${
                  isPast ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/80">{formatted}</div>
                  {day.reason && (
                    <div className="text-xs text-white/40 truncate">{day.reason}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(day.id)}
                  disabled={deletingId === day.id}
                  className="text-xs text-white/25 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
                  aria-label={`Remove off day ${formatted}`}
                >
                  {deletingId === day.id ? "..." : "Remove"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}