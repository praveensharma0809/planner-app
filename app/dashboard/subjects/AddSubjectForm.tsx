"use client"

import { useState } from "react"
import { addSubject } from "@/app/actions/subjects/addSubject"

export function AddSubjectForm() {
  const [name, setName] = useState("")
  const [totalItems, setTotalItems] = useState(1)
  const [avgDuration, setAvgDuration] = useState(60)
  const [deadline, setDeadline] = useState("")
  const [priority, setPriority] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const result = await addSubject({
        name,
        total_items: totalItems,
        avg_duration_minutes: avgDuration,
        deadline,
        priority,
      })

      if (result.status === "SUCCESS") {
        setName("")
        setTotalItems(1)
        setAvgDuration(60)
        setDeadline("")
        setPriority(3)
      } else if (result.status === "UNAUTHORIZED") {
        setError("Session expired. Please sign in again.")
      } else if (result.status === "ERROR") {
        setError(result.message)
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card !p-6 mb-8 space-y-4">
      <input
        placeholder="Subject name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-label="Subject name"
        className="w-full p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-white/25"
      />

      <div className="grid grid-cols-2 gap-4">
        <input
          type="number"
          placeholder="Total items"
          value={totalItems}
          onChange={(e) => setTotalItems(Number(e.target.value))}
          min={1}
          aria-label="Total items"
          className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
        <input
          type="number"
          placeholder="Avg duration (mins)"
          value={avgDuration}
          onChange={(e) => setAvgDuration(Number(e.target.value))}
          min={1}
          aria-label="Average duration in minutes"
          className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          aria-label="Deadline"
          className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          aria-label="Priority"
          className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none"
        >
          <option value={1}>High</option>
          <option value={2}>Medium-High</option>
          <option value={3}>Medium</option>
          <option value={4}>Low</option>
          <option value={5}>Very Low</option>
        </select>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn-primary"
      >
        {saving ? "Adding..." : "Add Subject"}
      </button>
    </form>
  )
}