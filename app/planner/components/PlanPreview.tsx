"use client"

import { useMemo, useState } from "react"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/types"

interface PlanPreviewProps {
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult
  onEdit: (sessions: ScheduledSession[]) => void
  onConfirm: () => void
}

interface DayBucket {
  date: string
  sessions: ScheduledSession[]
  totalMinutes: number
}

export default function PlanPreview({
  sessions,
  feasibility,
  onEdit,
  onConfirm,
}: PlanPreviewProps) {
  const [localSessions, setLocalSessions] = useState(sessions)

  const grouped = useMemo(() => {
    const byDate = new Map<string, ScheduledSession[]>()
    for (const s of localSessions) {
      const list = byDate.get(s.scheduled_date) ?? []
      list.push(s)
      byDate.set(s.scheduled_date, list)
    }
    const buckets: DayBucket[] = []
    for (const [date, items] of Array.from(byDate.entries()).sort(([a], [b]) =>
      a > b ? 1 : -1
    )) {
      buckets.push({
        date,
        sessions: items,
        totalMinutes: items.reduce((s, i) => s + i.duration_minutes, 0),
      })
    }
    return buckets
  }, [localSessions])

  const totalSessions = localSessions.length
  const totalDays = grouped.length
  const avgPerDay =
    totalDays > 0
      ? Math.round(
          localSessions.reduce((s, t) => s + t.duration_minutes, 0) /
            totalDays
        )
      : 0
  const lastDay = grouped.length > 0 ? grouped[grouped.length - 1].date : "—"

  const removeSession = (date: string, index: number) => {
    const daySessionsSoFar: ScheduledSession[] = []
    const result: ScheduledSession[] = []
    let removed = false
    for (const s of localSessions) {
      if (!removed && s.scheduled_date === date) {
        daySessionsSoFar.push(s)
        if (daySessionsSoFar.length - 1 === index) {
          removed = true
          continue
        }
      }
      result.push(s)
    }
    setLocalSessions(result)
    onEdit(result)
  }

  const sessionTypeColor = (type: string) => {
    switch (type) {
      case "revision":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30"
      case "practice":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-white/[0.04] text-white/80 border-white/[0.06]"
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
          Phase 4
        </p>
        <h2 className="text-xl font-semibold">Plan Preview</h2>
        <p className="text-sm text-white/50">
          Review and edit your plan. Changes here are local until you confirm.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{totalSessions}</div>
          <div className="text-[11px] text-white/40">Sessions</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{totalDays}</div>
          <div className="text-[11px] text-white/40">Days</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{avgPerDay}</div>
          <div className="text-[11px] text-white/40">Avg min/day</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{lastDay}</div>
          <div className="text-[11px] text-white/40">Last day</div>
        </div>
      </div>

      {/* Feasibility warnings */}
      {feasibility.units.some(
        (u) => u.status === "at_risk" || u.status === "tight"
      ) && (
        <div className="warning-card">
          <div className="text-xs font-semibold text-amber-300">
            Some topics are tight on time
          </div>
          <div className="mt-1 space-y-1">
            {feasibility.units
              .filter(
                (u) => u.status === "at_risk" || u.status === "tight"
              )
              .map((u) => (
                <div key={u.unitId} className="text-xs text-amber-200/70">
                  {u.name}: {u.totalSessions} sessions needed, {u.availableSlots} slots available
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Day-by-day schedule */}
      <div className="grid gap-3 md:grid-cols-2">
        {grouped.map((bucket) => (
          <div
            key={bucket.date}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-white/80">
              <div className="font-semibold text-sm">{bucket.date}</div>
              <div className="text-xs text-white/40">
                {bucket.sessions.length} sessions · {bucket.totalMinutes} min
              </div>
            </div>
            <div className="space-y-1">
              {bucket.sessions.map((session, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-xl px-2 py-1.5 border ${sessionTypeColor(session.session_type)}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs truncate">{session.title}</span>
                    {session.session_type !== "core" && (
                      <span className="text-[9px] uppercase font-bold opacity-60">
                        {session.session_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-white/50">
                      {session.duration_minutes}m
                    </span>
                    <button
                      onClick={() => removeSession(bucket.date, idx)}
                      className="text-red-400/40 hover:text-red-400 text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={onConfirm} className="btn-primary">
          Continue to Confirm
        </button>
      </div>
    </div>
  )
}
