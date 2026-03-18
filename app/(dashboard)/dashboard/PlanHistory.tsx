"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getPlanHistory } from "@/app/actions/planner/plan"
import type { PlanSnapshot } from "@/lib/types/db"

interface PlanHistoryProps {
  title?: string
  className?: string
  showPlannerLinks?: boolean
  emptyMessage?: string
  emptyHint?: string
  maxVisible?: number
}

export function PlanHistory({
  title = "Plan History",
  className = "",
  showPlannerLinks = true,
  emptyMessage = "No plans committed yet.",
  emptyHint = "Create your first plan to start building history.",
  maxVisible = 5,
}: PlanHistoryProps) {
  const [history, setHistory] = useState<PlanSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlanHistory().then((res) => {
      if (res.status === "SUCCESS") {
        setHistory(res.snapshots)
      }
      setLoading(false)
    })
  }, [])

  const visibleHistory = history.slice(0, maxVisible)

  if (loading) {
    return (
      <section className={`section-card ${className}`.trim()}>
        <div className="section-card-header">
          <div className="section-card-title">{title}</div>
        </div>
        <div className="section-card-body space-y-2.5 animate-pulse">
          <div className="h-11 rounded-xl skeleton" />
          <div className="h-11 rounded-xl skeleton" />
          <div className="h-11 rounded-xl skeleton" />
        </div>
      </section>
    )
  }

  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card-header">
        <div className="section-card-title">
          <svg className="w-4 h-4 text-indigo-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {title}
        </div>
        {showPlannerLinks && (
          <Link href="/planner" className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            New Plan →
          </Link>
        )}
      </div>

      <div className="section-card-body">
        {history.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "rgba(124,108,255,0.08)" }}>
              <svg className="w-6 h-6 text-indigo-300" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold mt-4" style={{ color: "var(--sh-text-primary)" }}>{emptyMessage}</p>
            {showPlannerLinks ? (
              <Link href="/planner" className="inline-block mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                Create your first plan →
              </Link>
            ) : (
              <p className="text-[11px] mt-2" style={{ color: "var(--sh-text-muted)" }}>{emptyHint}</p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {visibleHistory.map((snapshot) => {
                const timeStr = new Date(snapshot.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })

                return (
                  <div
                    key={snapshot.id}
                    className="group flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: "var(--sh-border)",
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0 group-hover:shadow-md group-hover:shadow-indigo-500/40 transition-shadow" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                          {snapshot.task_count} tasks
                        </span>
                        {snapshot.summary && (
                          <span className="text-[11px] truncate" style={{ color: "var(--sh-text-muted)" }}>{snapshot.summary}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium shrink-0" style={{ color: "var(--sh-text-muted)" }}>{timeStr}</span>
                  </div>
                )
              })}
            </div>

            {history.length > maxVisible && (
              <div className="mt-3 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                {showPlannerLinks
                  ? `Showing latest ${maxVisible} of ${history.length} plans.`
                  : `Showing latest ${maxVisible} plan snapshots.`}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
