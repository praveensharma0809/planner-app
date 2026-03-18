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

const DURATION_PRESETS = [15, 30, 45, 60]

export function QuickAddTask({ subjects }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [duration, setDuration] = useState(30)
  const [saving, setSaving] = useState(false)

  if (subjects.length === 0) return null

  const today = new Date().toISOString().split("T")[0]

  const handleSubmit = async () => {
    if (!title.trim() || !subjectId) return
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[18px] border border-dashed px-4 py-3 text-left transition-all"
        style={{
          background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
          borderColor: "rgba(124,108,255,0.18)",
        }}
      >
        <span className="block text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
          + Quick add task for today
        </span>
        <span className="block mt-1 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
          Drop a manual task straight into today&apos;s lane.
        </span>
      </button>
    )
  }

  return (
    <div
      className="rounded-[20px] border p-4 space-y-3"
      style={{
        background: "color-mix(in srgb, var(--sh-card) 90%, var(--foreground) 10%)",
        borderColor: "var(--sh-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            Quick add for today
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--sh-text-muted)" }}>
            Useful for short tasks that do not need a full plan rerun.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setTitle("")
          }}
          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
          style={{
            color: "var(--sh-text-secondary)",
            borderColor: "var(--sh-border)",
          }}
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              void handleSubmit()
            }
          }}
          autoFocus
          className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "var(--sh-border)",
            color: "var(--sh-text-primary)",
          }}
          aria-label="Task title"
        />

        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "var(--sh-border)",
            color: "var(--sh-text-primary)",
          }}
          aria-label="Subject"
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: "var(--sh-text-muted)" }}>
          Duration
        </span>

        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setDuration(preset)}
            className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={duration === preset
              ? {
                  background: "rgba(124,108,255,0.16)",
                  borderColor: "rgba(124,108,255,0.28)",
                  color: "#C5BEFF",
                }
              : {
                  borderColor: "var(--sh-border)",
                  color: "var(--sh-text-secondary)",
                }}
          >
            {preset}m
          </button>
        ))}

        <input
          type="number"
          min={5}
          max={240}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Math.max(5, Math.min(240, Number(e.target.value) || 5)))}
          className="w-20 rounded-lg border px-2 py-1.5 text-xs text-center outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "var(--sh-border)",
            color: "var(--sh-text-primary)",
          }}
          aria-label="Duration in minutes"
        />

        <span className="text-[10px]" style={{ color: "var(--sh-text-muted)" }}>min</span>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !title.trim()}
          className="ml-auto btn-primary text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Adding..." : "Add task"}
        </button>
      </div>
    </div>
  )
}
