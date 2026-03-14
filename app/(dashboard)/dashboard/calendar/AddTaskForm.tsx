"use client"

import { useState } from "react"
import { createTask } from "@/app/actions/plan/createTask"
import { useToast } from "@/app/components/Toast"

interface Subject {
  id: string
  name: string
}

interface Props {
  subjects: Subject[]
  defaultDate?: string
}

export function AddTaskForm({ subjects, defaultDate }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split("T")[0])
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3.5 py-1.5 text-xs bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 rounded-xl hover:bg-indigo-500/25 transition-all font-medium"
      >
        + Add Task
      </button>
    )
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await createTask({
        subject_id: subjectId,
        title,
        scheduled_date: date,
        duration_minutes: duration,
      })
      if (res.status === "SUCCESS") {
        addToast("Task created", "success")
        setTitle("")
        setOpen(false)
      } else if (res.status === "ERROR") {
        setError(res.message)
      } else {
        setError("Session expired. Please sign in again.")
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card !p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">New Custom Task</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors" aria-label="Close add task form">&#x2715;</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Practice past paper Q4"
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white/90 placeholder:text-white/25 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Subject</label>
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            min={1}
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 px-3 py-2 rounded-xl">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving || !title.trim() || !subjectId}
        className="btn-primary"
      >
        {saving ? "Creating..." : "Create Task"}
      </button>
    </div>
  )
}