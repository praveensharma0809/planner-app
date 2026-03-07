"use client"

import { useState } from "react"

interface ConstraintValues {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  session_length_minutes: number
  final_revision_days: number
  buffer_percentage: number
}

interface ConstraintsFormProps {
  initial: ConstraintValues | null
  onSave: (config: ConstraintValues) => void
  isSaving: boolean
}

export type { ConstraintValues }

export default function ConstraintsForm({
  initial,
  onSave,
  isSaving,
}: ConstraintsFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const [config, setConfig] = useState<ConstraintValues>(
    initial ?? {
      study_start_date: today,
      exam_date: "",
      weekday_capacity_minutes: 120,
      weekend_capacity_minutes: 180,
      session_length_minutes: 45,
      final_revision_days: 0,
      buffer_percentage: 10,
    }
  )

  const update = (field: keyof ConstraintValues, value: string | number) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  const canProceed =
    config.study_start_date &&
    config.exam_date &&
    config.study_start_date < config.exam_date &&
    (config.weekday_capacity_minutes > 0 || config.weekend_capacity_minutes > 0) &&
    config.session_length_minutes > 0

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
          Phase 3
        </p>
        <h2 className="text-xl font-semibold">Planning Constraints</h2>
        <p className="text-sm text-white/50">
          Set your study window, daily capacity, and session preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Study start date *
          </label>
          <input
            type="date"
            value={config.study_start_date}
            onChange={(e) => update("study_start_date", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Exam date *
          </label>
          <input
            type="date"
            value={config.exam_date}
            onChange={(e) => update("exam_date", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Weekday capacity (min)
          </label>
          <input
            type="number"
            min="0"
            value={config.weekday_capacity_minutes}
            onChange={(e) =>
              update(
                "weekday_capacity_minutes",
                parseInt(e.target.value) || 0
              )
            }
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Weekend capacity (min)
          </label>
          <input
            type="number"
            min="0"
            value={config.weekend_capacity_minutes}
            onChange={(e) =>
              update(
                "weekend_capacity_minutes",
                parseInt(e.target.value) || 0
              )
            }
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Session length (min)
          </label>
          <input
            type="number"
            min="1"
            value={config.session_length_minutes}
            onChange={(e) =>
              update(
                "session_length_minutes",
                parseInt(e.target.value) || 45
              )
            }
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Buffer %
          </label>
          <input
            type="number"
            min="0"
            max="50"
            value={config.buffer_percentage}
            onChange={(e) =>
              update("buffer_percentage", parseInt(e.target.value) || 0)
            }
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Final revision days (reserved before exam)
          </label>
          <input
            type="number"
            min="0"
            value={config.final_revision_days}
            onChange={(e) =>
              update(
                "final_revision_days",
                parseInt(e.target.value) || 0
              )
            }
            className="w-full md:w-1/2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSave(config)}
          disabled={!canProceed || isSaving}
          className="btn-primary disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save & Generate Plan"}
        </button>
      </div>
    </div>
  )
}
