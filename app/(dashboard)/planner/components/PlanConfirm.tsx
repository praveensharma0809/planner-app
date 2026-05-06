"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/app/components/ui"
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
  keepMode?: KeepPreviousMode
  summary?: string
  onKeepModeChange?: (mode: KeepPreviousMode) => void
  onSummaryChange?: (summary: string) => void
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
  keepMode: externalKeepMode,
  summary: externalSummary,
  onKeepModeChange,
  onSummaryChange,
}: PlanConfirmProps) {
  const [internalKeepMode, setInternalKeepMode] = useState<KeepPreviousMode>("until")
  const [internalSummary, setInternalSummary] = useState("")

  const keepMode = externalKeepMode ?? internalKeepMode
  const summary = externalSummary ?? internalSummary

  function setKeepMode(mode: KeepPreviousMode) {
    setInternalKeepMode(mode)
    onKeepModeChange?.(mode)
  }

  function setSummary(value: string) {
    setInternalSummary(value)
    onSummaryChange?.(value)
  }

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

  const keepOptions: { value: KeepPreviousMode; label: string; desc: string; tone: "mint" | "rose" }[] = [
    {
      value: "until",
      label: "Keep previous tasks until new plan start date",
      desc: newPlanStart
        ? `Keep all tasks before ${newPlanStart}. Delete all tasks on/after ${newPlanStart}, then insert the new plan from that date onward.`
        : "Keep all tasks before the new plan start date. Delete all tasks on/after the new start date, then insert the new plan from that date onward.",
      tone: "mint",
    },
    {
      value: "none",
      label: "Delete all previous tasks",
      desc: "Delete all previous tasks, then insert the full new plan.",
      tone: "rose",
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
          <div key={label} className="surface-card p-3 text-center">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div>
            <div className="text-xl font-bold text-text-primary">{value}</div>
          </div>
        ))}
      </div>

      {!feasibility.feasible && (
        <div className="bg-pastel-peach/20 border border-pastel-peach-text/20 rounded-2xl p-3 text-xs text-pastel-peach-text">
          <span className="font-semibold">Warning:</span>{" "}
          {commitBlocked
            ? "The plan has unresolved critical issues. Resolve them before commit."
            : "The plan may not cover all topics fully. Review and adjust if needed before commit."}
        </div>
      )}

      <div className="text-[11px] text-text-muted">
        Feasibility indicators are based on the last generated plan snapshot.
      </div>

      {commitBlocked && (
        <div className="bg-pastel-rose/20 border border-pastel-rose-text/20 rounded-2xl p-3 text-xs text-pastel-rose-text flex items-center justify-between gap-3">
          <span>
            <span className="font-semibold">Commit locked:</span>{" "}
            {commitBlockedReason ?? "Resolve critical plan issues first."}
          </span>
          {onResolveIssues && (
            <button
              type="button"
              onClick={onResolveIssues}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-pastel-rose-text/30 text-pastel-rose-text hover:bg-pastel-rose/30 transition-colors"
            >
              Open Issue Window
            </button>
          )}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="bg-pastel-rose/15 border border-pastel-rose-text/15 rounded-2xl p-3 text-xs text-pastel-rose-text">
          <span className="font-semibold">No sessions to commit.</span> Return to the preview and regenerate or restore sessions first.
        </div>
      )}

      {/* Previous plan handling */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-pastel-peach rounded-full" />
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Previous Plan</p>
        </div>
        <p className="text-xs text-text-muted">Choose what happens to existing tasks before the new plan is inserted.</p>

        <div className="space-y-2">
          {keepOptions.map((opt) => {
            const colors: Record<string, string> = {
              mint: "border-pastel-mint-text/30 bg-pastel-mint/20 text-pastel-mint-text",
              rose: "border-pastel-rose-text/30 bg-pastel-rose/20 text-pastel-rose-text",
            }
            const inactiveColors: Record<string, string> = {
              mint: "border-border-hairline hover:border-pastel-mint-text/20",
              rose: "border-border-hairline hover:border-pastel-rose-text/20",
            }
            const isSelected = keepMode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKeepMode(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition-all duration-200 ${
                  isSelected ? colors[opt.tone] : `bg-surface-card-muted ${inactiveColors[opt.tone]} text-text-muted`
                }`}
              >
                <div className={`text-sm font-semibold mb-0.5 ${isSelected ? "" : "text-text-primary"}`}>{opt.label}</div>
                <div className={`text-[11px] leading-relaxed ${isSelected ? "opacity-80" : "text-text-muted"}`}>{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-pastel-sky rounded-full" />
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Snapshot Summary</p>
        </div>
        <p className="text-xs text-text-muted">Optional label for plan history and later comparisons.</p>
        <input
          type="text"
          maxLength={120}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={summaryPlaceholder}
          className="ui-input"
        />
      </div>

      {/* What happens note */}
      <div className="bg-surface-card-muted border border-border-hairline rounded-2xl p-3 space-y-1 text-[11px] text-text-muted">
        <div className="font-medium text-text-secondary mb-1.5">After committing:</div>
        <div>- Manually created tasks are always preserved.</div>
        <div>- A snapshot of this plan is saved for history.</div>
        <div>- You can return here any time and commit a new version.</div>
      </div>

      {/* Commit result messages */}
      {commitResult?.status === "SUCCESS" && (
        <div className="bg-pastel-mint/15 border border-pastel-mint-text/15 rounded-2xl p-3 text-sm text-pastel-mint-text">
          Plan committed successfully. {commitResult.taskCount} tasks created.
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-full border border-pastel-mint-text/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-pastel-mint/20 transition-colors">
              Open Dashboard
            </Link>
            <Link href={calendarMonthHref} className="rounded-full border border-pastel-mint-text/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-pastel-mint/20 transition-colors">
              Open Calendar
            </Link>
            <Link href="/schedule" className="rounded-full border border-pastel-mint-text/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-pastel-mint/20 transition-colors">
              Open Scheduler
            </Link>
          </div>
        </div>
      )}
      {commitResult?.status === "ERROR" && (
        <div className="bg-pastel-rose/15 border border-pastel-rose-text/15 rounded-2xl p-3 text-sm text-pastel-rose-text">
          {commitResult.message ?? "Failed to commit plan. Please try again."}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          className="min-h-[44px] md:min-h-0"
          onClick={() => onCommit(keepMode, summary.trim() || undefined)}
          disabled={isCommitting || sessions.length === 0 || commitBlocked}
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
        </Button>
      </div>
    </div>
  )
}
