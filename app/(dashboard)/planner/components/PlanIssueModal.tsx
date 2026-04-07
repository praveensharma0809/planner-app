"use client"

import { createPortal } from "react-dom"

import type {
  PlanIssue,
  PlanIssueAction,
  PlanIssueConstraintField,
  PlannerConstraintValues,
} from "@/lib/planner/draft"

interface PlanIssueModalProps {
  open: boolean
  issues: PlanIssue[]
  constraints: PlannerConstraintValues | null
  isRechecking: boolean
  onClose: () => void
  onApplyAction: (issueId: string, action: PlanIssueAction) => void
  onInlineConstraintChange: (
    field: PlanIssueConstraintField,
    value: string | number
  ) => void
  onRecheck: () => void
}

function getIssueTone(severity: PlanIssue["severity"]) {
  if (severity === "critical") {
    return {
      badge: "bg-red-500/15 border-red-500/30 text-red-300",
      card: "border-red-500/20 bg-red-500/[0.04]",
      number: "text-red-300",
    }
  }
  return {
    badge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    card: "border-amber-500/20 bg-amber-500/[0.04]",
    number: "text-amber-300",
  }
}

export default function PlanIssueModal({
  open,
  issues,
  constraints,
  isRechecking,
  onClose,
  onApplyAction,
  onInlineConstraintChange,
  onRecheck,
}: PlanIssueModalProps) {
  if (!open || typeof document === "undefined") return null

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length
  const warningCount = issues.length - criticalCount
  const resolvedPct = issues.length > 0
    ? Math.round(((issues.length - criticalCount) / issues.length) * 100)
    : 100

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/55" aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 w-[70vw] max-w-5xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/[0.10] bg-[#0f1116] shadow-2xl shadow-black/50">
        <div className="px-6 py-4 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Plan Guard</p>
              <h3 className="text-lg font-semibold text-white/90">Resolve Plan Issues</h3>
              <p className="text-xs text-white/45 mt-0.5">
                Fix critical issues to unlock commit. Warnings are optional improvements.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-2.5 py-1 rounded-md border border-white/[0.10] text-white/55 hover:text-white/80 hover:border-white/25"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-md border bg-red-500/10 border-red-500/25 text-red-300 font-semibold">
              {criticalCount} critical
            </span>
            <span className="px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/25 text-amber-300 font-semibold">
              {warningCount} warning
            </span>
            <span className="px-2 py-0.5 rounded-md border bg-emerald-500/10 border-emerald-500/25 text-emerald-300 font-semibold">
              {resolvedPct}% commit readiness
            </span>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-3">
          {issues.length === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm text-emerald-300">
              No issue detected. You can continue safely.
            </div>
          )}

          {issues.map((issue, idx) => {
            const tone = getIssueTone(issue.severity)
            return (
              <div
                key={issue.issueId}
                className={`rounded-xl border p-4 space-y-3 ${tone.card}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-sm font-bold ${tone.number}`}>{idx + 1}.</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-white/90">{issue.title}</h4>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tone.badge}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-white/65 mt-1">{issue.userMessage}</p>
                    <p className="text-[11px] text-white/45 mt-1">Fix: {issue.resolverHint}</p>
                  </div>
                </div>

                {Object.keys(issue.rootCauseValues).length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(issue.rootCauseValues).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/35">{key}</p>
                        <p className="text-xs text-white/75 mt-0.5 break-words">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {constraints && issue.inlineEdits.length > 0 && (
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-wider text-white/35 mb-2">Quick edits</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {issue.inlineEdits.map((inlineField) => {
                        const rawValue = constraints[inlineField.field]
                        const value = typeof rawValue === "number" || typeof rawValue === "string"
                          ? rawValue
                          : ""
                        return (
                          <label key={`${issue.issueId}-${inlineField.field}`} className="space-y-1">
                            <span className="text-[10px] text-white/45 uppercase tracking-wider">
                              {inlineField.label}
                            </span>
                            <input
                              type={inlineField.type}
                              min={inlineField.min}
                              max={inlineField.max}
                              step={inlineField.step}
                              value={value}
                              onChange={(event) => {
                                if (inlineField.type === "date") {
                                  onInlineConstraintChange(inlineField.field, event.target.value)
                                  return
                                }
                                const parsed = parseInt(event.target.value, 10)
                                onInlineConstraintChange(
                                  inlineField.field,
                                  Number.isNaN(parsed) ? 0 : parsed
                                )
                              }}
                              className="w-full rounded-lg border border-white/[0.10] bg-white/[0.02] px-2.5 py-1.5 text-xs text-white/80 outline-none hover:border-white/25 focus:border-sky-400/50"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {issue.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {issue.options.map((option) => (
                      <button
                        key={`${issue.issueId}-${option.id}`}
                        type="button"
                        onClick={() => onApplyAction(issue.issueId, option)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-white/[0.12] text-white/70 bg-white/[0.02] hover:border-sky-400/35 hover:text-sky-200"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3">
          <div className="text-xs text-white/45">
            {criticalCount > 0
              ? "Commit remains blocked until critical issues are resolved."
              : "No critical blockers. You can continue to commit."}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md border border-white/[0.10] text-white/55 hover:text-white/80 hover:border-white/25"
            >
              Back to planner
            </button>
            <button
              type="button"
              onClick={onRecheck}
              disabled={isRechecking}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-sky-500/35 bg-sky-500/12 text-sky-200 hover:bg-sky-500/18 disabled:border-white/[0.08] disabled:bg-white/[0.03] disabled:text-white/35"
            >
              {isRechecking ? "Re-checking..." : "Re-check plan"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
