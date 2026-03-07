"use client"

import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/types"

interface PlanConfirmProps {
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult
  onCommit: () => void
  isCommitting: boolean
  commitResult: { status: string; taskCount?: number } | null
}

export default function PlanConfirm({
  sessions,
  feasibility,
  onCommit,
  isCommitting,
  commitResult,
}: PlanConfirmProps) {
  const totalMinutes = sessions.reduce(
    (s, t) => s + t.duration_minutes,
    0
  )
  const uniqueDays = new Set(sessions.map((s) => s.scheduled_date)).size
  const coreSessions = sessions.filter((s) => s.session_type === "core").length
  const revisionSessions = sessions.filter(
    (s) => s.session_type === "revision"
  ).length
  const practiceSessions = sessions.filter(
    (s) => s.session_type === "practice"
  ).length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
          Phase 5
        </p>
        <h2 className="text-xl font-semibold">Confirm & Commit</h2>
        <p className="text-sm text-white/50">
          Review the summary and commit your plan. This will replace all future
          generated tasks.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Total sessions
            </div>
            <div className="text-lg font-bold">{sessions.length}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Study days
            </div>
            <div className="text-lg font-bold">{uniqueDays}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Total hours
            </div>
            <div className="text-lg font-bold">
              {Math.round(totalMinutes / 60)}
            </div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Core
            </div>
            <div className="font-semibold">{coreSessions}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Revision
            </div>
            <div className="font-semibold">{revisionSessions}</div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              Practice
            </div>
            <div className="font-semibold">{practiceSessions}</div>
          </div>
        </div>

        {!feasibility.feasible && (
          <div className="warning-card text-xs">
            <span className="font-semibold text-amber-300">Warning:</span>{" "}
            The plan may not cover all topics fully. Review Phase 4 to adjust.
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2 text-xs text-white/50">
        <div className="font-medium text-white/70">What will happen:</div>
        <ul className="list-disc list-inside space-y-1">
          <li>All future auto-generated tasks will be replaced</li>
          <li>Past tasks remain untouched</li>
          <li>Manually created tasks are preserved</li>
          <li>A snapshot of this plan will be saved for history</li>
        </ul>
      </div>

      {commitResult && commitResult.status === "SUCCESS" && (
        <div className="bg-emerald-500/[0.06] border border-emerald-500/15 text-sm rounded-xl p-3 text-emerald-300">
          Plan committed — {commitResult.taskCount} tasks created.
        </div>
      )}

      {commitResult && commitResult.status === "ERROR" && (
        <div className="bg-red-500/[0.06] border border-red-500/15 text-sm rounded-xl p-3 text-red-300">
          Failed to commit plan. Please try again.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onCommit}
          disabled={isCommitting || commitResult?.status === "SUCCESS"}
          className="bg-emerald-500/80 hover:bg-emerald-400 rounded-xl text-sm font-semibold px-6 py-3 transition-all disabled:opacity-50"
        >
          {isCommitting
            ? "Committing..."
            : commitResult?.status === "SUCCESS"
              ? "Committed ✓"
              : "Commit Plan"}
        </button>
      </div>
    </div>
  )
}
