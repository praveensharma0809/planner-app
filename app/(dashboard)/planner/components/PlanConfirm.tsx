"use client"

import Link from "next/link"
import { useState } from "react"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/engine"
import type { KeepPreviousMode } from "@/app/actions/planner/plan"

interface PlanConfirmProps {
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult
  onCommit: (keepMode: KeepPreviousMode, summary?: string) => void
  isCommitting: boolean
  commitResult: { status: string; taskCount?: number; message?: string } | null
  commitBlocked?: boolean
  commitBlockedReason?: string
  onResolveIssues?: () => void
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export default function PlanConfirm({
  sessions,
  feasibility,
  onCommit,
  isCommitting,
  commitResult,
  commitBlocked,
  commitBlockedReason,
  onResolveIssues,
}: PlanConfirmProps) {
  const [keepMode, setKeepMode] = useState<KeepPreviousMode>("until")
  const [summary, setSummary] = useState("")

  const totalMinutes = sessions.reduce((s, t) => s + t.duration_minutes, 0)
  const uniqueDays = new Set(sessions.map((s) => s.scheduled_date)).size
  const uniqueSubjects = new Set(sessions.map((session) => session.subject_id)).size
  const uniqueTopics = new Set(
    sessions
      .map((session) => session.topic_id)
      .filter((topicId) => topicId.trim().length > 0)
  ).size

  // Derive new plan's start date for display
  const newPlanStart = sessions.length > 0
    ? sessions.reduce((earliest, s) =>
        s.scheduled_date < earliest ? s.scheduled_date : earliest,
        sessions[0].scheduled_date)
    : null
  const summaryPlaceholder = newPlanStart
    ? `${newPlanStart} | ${sessions.length} session${sessions.length === 1 ? "" : "s"} | ${formatMinutes(totalMinutes)}`
    : `${sessions.length} session${sessions.length === 1 ? "" : "s"} | ${formatMinutes(totalMinutes)}`
  const calendarMonthHref = newPlanStart
    ? `/dashboard/calendar?month=${newPlanStart.slice(0, 7)}`
    : "/dashboard/calendar"

  const keepOptions: { value: KeepPreviousMode; label: string; desc: string; tone: "emerald" | "red" }[] = [
    {
      value: "until",
      label: "Keep previous tasks until new plan start date",
      desc: newPlanStart
        ? `Keep all tasks before ${newPlanStart}. Delete all tasks on/after ${newPlanStart}, then insert the new plan from that date onward.`
        : "Keep all tasks before the new plan start date. Delete all tasks on/after the new start date, then insert the new plan from that date onward.",
      tone: "emerald",
    },
    {
      value: "none",
      label: "Delete all previous tasks",
      desc: "Delete all previous tasks, then insert the full new plan.",
      tone: "red",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Sessions", value: sessions.length },
          { label: "Study Days", value: uniqueDays },
          { label: "Subjects", value: uniqueSubjects },
          { label: "Topics", value: uniqueTopics },
          { label: "Total Time", value: formatMinutes(totalMinutes) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-xl font-bold text-white/90">{value}</div>
          </div>
        ))}
      </div>

      {!feasibility.feasible && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
          <span className="font-semibold">Warning:</span>{" "}
          {commitBlocked
            ? "The plan has unresolved critical issues. Resolve them before commit."
            : "The plan may not cover all topics fully. Review and adjust if needed before commit."}
        </div>
      )}

      <div className="text-[11px] text-white/35">
        Feasibility indicators are based on the last generated plan snapshot.
      </div>

      {commitBlocked && (
        <div className="bg-red-500/[0.07] border border-red-500/25 rounded-xl p-3 text-xs text-red-300 flex items-center justify-between gap-3">
          <span>
            <span className="font-semibold">Commit locked:</span>{" "}
            {commitBlockedReason ?? "Resolve critical plan issues first."}
          </span>
          {onResolveIssues && (
            <button
              type="button"
              onClick={onResolveIssues}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded border border-red-400/35 text-red-200 hover:bg-red-500/20"
            >
              Open Issue Window
            </button>
          )}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
          <span className="font-semibold">No sessions to commit.</span> Return to the preview and regenerate or restore sessions first.
        </div>
      )}

      {/* Previous plan handling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Previous Plan</p>
        </div>
        <p className="text-xs text-white/40">Choose what happens to existing tasks before the new plan is inserted.</p>

        <div className="space-y-2">
          {keepOptions.map((opt) => {
            const colors: Record<string, string> = {
              emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
              red: "border-red-500/40 bg-red-500/10 text-red-300",
            }
            const inactiveColors: Record<string, string> = {
              emerald: "border-white/[0.08] hover:border-emerald-500/25",
              red: "border-white/[0.08] hover:border-red-500/25",
            }
            const isSelected = keepMode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKeepMode(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                  isSelected ? colors[opt.tone] : `bg-white/[0.02] ${inactiveColors[opt.tone]} text-white/50`
                }`}
              >
                <div className={`text-sm font-semibold mb-0.5 ${isSelected ? "" : "text-white/70"}`}>{opt.label}</div>
                <div className={`text-[11px] leading-relaxed ${isSelected ? "opacity-80" : "text-white/35"}`}>{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-gradient-to-b from-sky-400 to-indigo-500 rounded-full" />
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Snapshot Summary</p>
        </div>
        <p className="text-xs text-white/40">Optional label for plan history and later comparisons.</p>
        <input
          type="text"
          maxLength={120}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={summaryPlaceholder}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/80 outline-none transition-all duration-200 placeholder:text-white/20 hover:border-sky-400/30 focus:border-sky-400/60 focus:bg-white/[0.04]"
        />
      </div>

      {/* What happens note */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-1 text-[11px] text-white/35">
        <div className="font-medium text-white/50 mb-1.5">After committing:</div>
        <div>- Manually created tasks are always preserved.</div>
        <div>- A snapshot of this plan is saved for history.</div>
        <div>- You can return here any time and commit a new version.</div>
      </div>

      {/* Commit result messages */}
      {commitResult?.status === "SUCCESS" && (
        <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-3 text-sm text-emerald-300">
          Plan committed successfully. {commitResult.taskCount} tasks created.
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-md border border-emerald-400/35 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/20">
              Open Dashboard
            </Link>
            <Link href={calendarMonthHref} className="rounded-md border border-emerald-400/35 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/20">
              Open Calendar
            </Link>
            <Link href="/schedule" className="rounded-md border border-emerald-400/35 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/20">
              Open Scheduler
            </Link>
          </div>
        </div>
      )}
      {commitResult?.status === "ERROR" && (
        <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl p-3 text-sm text-red-300">
          {commitResult.message ?? "Failed to commit plan. Please try again."}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => onCommit(keepMode, summary.trim() || undefined)}
          disabled={isCommitting || sessions.length === 0 || commitBlocked}
          className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-white/10 disabled:to-white/10 text-white disabled:text-white/40 text-sm font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {commitBlocked
            ? "Resolve Issues to Commit"
            : sessions.length === 0
            ? "No Sessions to Commit"
            : isCommitting
            ? "Committing..."
            : commitResult?.status === "SUCCESS"
              ? "Recommit Plan"
              : "Commit Plan"}
        </button>
      </div>
    </div>
  )
}
