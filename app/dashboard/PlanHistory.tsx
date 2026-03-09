"use client"

import { useEffect, useState } from "react"
import { getPlanHistory } from "@/app/actions/planner/getPlanHistory"
import type { PlanSnapshot } from "@/lib/types/db"
import Link from "next/link"

export function PlanHistory() {
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

  if (loading) {
    return (
      <section className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-32 mb-3"></div>
        <div className="space-y-2">
          <div className="h-10 bg-white/5 rounded"></div>
          <div className="h-10 bg-white/5 rounded"></div>
        </div>
      </section>
    )
  }

  if (history.length === 0) {
    return (
      <section className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white/90">Plan History</h2>
        </div>
        <div className="text-center py-6">
          <svg className="w-12 h-12 mx-auto text-white/10 mb-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-white/30 mb-3">No plans committed yet</p>
          <Link 
            href="/planner" 
            className="inline-block text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            Create your first plan →
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white/90">Plan History</h2>
        <Link 
          href="/planner" 
          className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors font-medium uppercase tracking-wider"
        >
          New Plan
        </Link>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {history.slice(0, 5).map((snap) => {
          const timeStr = new Date(snap.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          return (
            <div
              key={snap.id}
              className="group flex items-center gap-3 text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.08] rounded-lg px-3 py-2.5 transition-all duration-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0 group-hover:shadow-md group-hover:shadow-indigo-500/50 transition-shadow"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white/80 group-hover:text-white transition-colors">
                    {snap.task_count} tasks
                  </span>
                  {snap.summary && (
                    <span className="text-white/30 truncate text-[11px]">{snap.summary}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-white/20 shrink-0 font-medium">{timeStr}</span>
            </div>
          )
        })}
      </div>
      {history.length > 5 && (
        <Link 
          href="/planner"
          className="block mt-3 text-center text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          View all {history.length} plans
        </Link>
      )}
    </section>
  )
}
