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
}

export function QuickAddTask({ subjects }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)

  if (subjects.length === 0) return null

  const today = new Date().toISOString().split("T")[0]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 text-xs text-white/30 hover:text-indigo-400 hover:bg-indigo-500/[0.04] border border-dashed border-white/[0.06] hover:border-indigo-500/20 rounded-xl transition-all"
      >
        + Quick add task for today
      </button>
    )
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await createTask({
        subject_id: subjectId,
        title: title.trim(),
        scheduled_date: today,
        duration_minutes: duration,
      })
      if (res.status === "SUCCESS") {
        addToast("Task added", "success")
        setTitle("")
        setOpen(false)
      } else if (res.status === "ERROR") {
        addToast(res.message, "error")
      } else {
        addToast("Session expired", "error")
      }
    } catch {
      addToast("Network error", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card !p-3 space-y-2.5">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Task title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSubmit() }}
          autoFocus
          className="flex-1 min-w-0 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/25 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
          aria-label="Task title"
        />
        <select
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          className="px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs text-white/70 max-w-[120px] focus:border-indigo-500/30 focus:outline-none"
          aria-label="Subject"
        >
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Duration</label>
        <input
          type="number"
          min={5}
          max={240}
          step={5}
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          className="w-16 px-2 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white text-center focus:border-indigo-500/30 focus:outline-none"
          aria-label="Duration in minutes"
        />
        <span className="text-[10px] text-white/20">min</span>
        <div className="flex-1" />
        <button
          onClick={() => { setOpen(false); setTitle("") }}
          className="btn-ghost text-xs px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="btn-primary text-xs px-4 py-1.5"
        >
          {saving ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  )
}