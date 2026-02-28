"use client"

import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/app/components/Toast"
import { analyzePlanAction, type AnalyzePlanResponse } from "@/app/actions/plan/analyzePlan"
import { commitPlan, type CommitPlanResponse } from "@/app/actions/plan/commitPlan"
import { resolveOverload, type AdjustmentInput } from "@/app/actions/plan/resolveOverload"
import { getUpcomingDeadlines } from "@/app/actions/dashboard/getUpcomingDeadlines"
import { getPlanHistory } from "@/app/actions/plan/getPlanHistory"
import type { PlanEvent } from "@/lib/types/db"

export default function PlannerPage() {
  const { addToast } = useToast()
  const [analysis, setAnalysis] = useState<AnalyzePlanResponse | null>(null)
  const [commitResult, setCommitResult] = useState<CommitPlanResponse | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [canCommit, setCanCommit] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({})
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [adjustDailyMinutes, setAdjustDailyMinutes] = useState("")
  const [deadlineSubjectId, setDeadlineSubjectId] = useState("")
  const [deadlineDate, setDeadlineDate] = useState("")
  const [workloadSubjectId, setWorkloadSubjectId] = useState("")
  const [workloadTotalItems, setWorkloadTotalItems] = useState("")
  const [planHistory, setPlanHistory] = useState<PlanEvent[]>([])

  useEffect(() => {
    getPlanHistory().then(res => {
      if (res.status === "SUCCESS") setPlanHistory(res.events)
    })
  }, [commitResult])

  const statusLabel = useMemo(() => {
    if (!analysis) return "Idle"
    if (analysis.status === "READY") return "Ready"
    if (analysis.status === "OVERLOAD") return "Overload"
    if (analysis.status === "NO_PROFILE") return "Profile missing"
    if (analysis.status === "NO_SUBJECTS") return "No subjects"
    if (analysis.status === "UNAUTHORIZED") return "Sign in required"
    return ""
  }, [analysis])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setCanCommit(false)
    setCommitResult(null)
    try {
      const res = await analyzePlanAction()
      setCanCommit(res.status === "READY")
      setAnalysis(res)
    } catch {
      addToast("Failed to analyze plan - please try again.", "error")
    } finally {
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    let active = true
    const fetchSubjects = async () => {
      const res = await getUpcomingDeadlines()
      if (!active || res.status !== "SUCCESS") return
      const map: Record<string, string> = {}
      res.subjects.forEach(subj => {
        map[subj.id] = subj.name
      })
      setSubjectNames(map)
    }
    fetchSubjects()
    return () => { active = false }
  }, [])

  const buildAdjustment = (): AdjustmentInput | undefined => {
    if (adjustDailyMinutes) {
      const delta = Number(adjustDailyMinutes)
      if (!Number.isNaN(delta) && delta !== 0) {
        return { kind: "increaseDailyMinutes", deltaMinutes: delta }
      }
    }
    if (deadlineSubjectId && deadlineDate) {
      return { kind: "extendDeadline", subjectId: deadlineSubjectId, newDeadline: deadlineDate }
    }
    if (workloadSubjectId && workloadTotalItems) {
      const total = Number(workloadTotalItems)
      if (!Number.isNaN(total) && total >= 0) {
        return { kind: "reduceItems", subjectId: workloadSubjectId, newTotalItems: total }
      }
    }
    return undefined
  }

  const handleResolveAndReanalyze = async () => {
    setIsResolving(true)
    setCommitResult(null)
    setCanCommit(false)
    try {
      const adjustment = buildAdjustment()
      const res = await resolveOverload(adjustment)
      setAnalysis(res)
      setCanCommit(res.status === "READY")
    } catch {
      addToast("Failed to resolve overload - please try again.", "error")
    } finally {
      setIsResolving(false)
    }
  }

  const handleCommit = async () => {
    if (!analysis || analysis.status !== "READY" || !canCommit || isCommitting) return
    setIsCommitting(true)
    try {
      const res = await commitPlan({ tasks: analysis.tasks })
      setCommitResult(res)
      if (res.status === "SUCCESS") {
        setCanCommit(false)
        addToast(`Plan committed - ${analysis.tasks.length} tasks created!`, "success")
      } else {
        addToast("Failed to commit plan", "error")
      }
    } catch {
      addToast("Network error - could not commit plan.", "error")
    } finally {
      setIsCommitting(false)
    }
  }

  const isReady = analysis?.status === "READY"
  const isOverloaded = analysis?.status === "OVERLOAD"

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>(Object.entries(subjectNames))
    if (analysis && analysis.status === "OVERLOAD") {
      analysis.subjects.forEach(subject => {
        map.set(subject.subjectId, subject.name)
      })
    }
    return map
  }, [analysis, subjectNames])

  const groupedTasks = useMemo(() => {
    if (!analysis || analysis.status !== "READY") return []
    const buckets: { date: string; tasks: { title: string; subjectName: string; duration: number }[]; totalMinutes: number }[] = []
    const byDate = new Map<string, { tasks: { title: string; subjectName: string; duration: number }[]; totalMinutes: number }>()

    analysis.tasks.forEach(task => {
      const subjectName = subjectNameById.get(task.subject_id) ?? task.title ?? task.subject_id
      const bucket = byDate.get(task.scheduled_date) ?? { tasks: [], totalMinutes: 0 }
      bucket.tasks.push({ title: task.title, subjectName, duration: task.duration_minutes })
      bucket.totalMinutes += task.duration_minutes
      byDate.set(task.scheduled_date, bucket)
    })

    Array.from(byDate.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .forEach(([date, value]) => {
        buckets.push({ date, tasks: value.tasks, totalMinutes: value.totalMinutes })
      })

    return buckets
  }, [analysis, subjectNameById])

  return (
    <main className="min-h-screen text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Plan creation runs through analyze &#x2192; confirm</p>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Planner</h1>
        </header>

        {/* Step 1 */}
        <section className="glass-card space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Step 1</p>
              <h2 className="text-xl font-semibold">Analyze your plan</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.06] text-sm text-white/60">
              Status: {statusLabel}
            </span>
          </div>

          <p className="text-white/50 text-sm">
            We compute feasibility without writing to the database. You can adjust after seeing the analysis if overload is detected.
          </p>

          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={() => {
                if (analysis && (analysis.status === "READY" || analysis.status === "OVERLOAD")) {
                  setShowRegenConfirm(true)
                } else {
                  handleAnalyze()
                }
              }}
              disabled={isAnalyzing}
              className="btn-primary"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Plan"}
            </button>

            {showRegenConfirm && (
              <div className="flex items-center gap-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-4 py-2 animate-slide-in">
                <span className="text-xs text-amber-300">Re-analyze will replace the current blueprint. Continue?</span>
                <button
                  onClick={() => { setShowRegenConfirm(false); handleAnalyze() }}
                  className="px-3 py-1 bg-amber-500/80 hover:bg-amber-400 text-black text-xs font-semibold rounded-xl transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowRegenConfirm(false)}
                  className="btn-ghost text-xs px-3 py-1"
                >
                  Cancel
                </button>
              </div>
            )}

            {isReady && (
              <button
                onClick={handleCommit}
                disabled={!canCommit || isCommitting}
                className="bg-emerald-500/80 hover:bg-emerald-400 rounded-xl text-sm font-semibold px-5 py-3 transition-all disabled:opacity-50"
              >
                {isCommitting ? "Committing..." : "Confirm &#x26; Commit"}
              </button>
            )}
          </div>

          {analysis && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Result</div>
                <div className="text-sm text-white/60">{analysis.status}</div>
              </div>

              {analysis.status === "READY" && (
                <div className="space-y-4 text-sm text-white/80">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <div className="text-lg font-bold">{analysis.taskCount}</div>
                      <div className="text-[11px] text-white/40">Tasks</div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <div className="text-lg font-bold">{groupedTasks.length}</div>
                      <div className="text-[11px] text-white/40">Days</div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <div className="text-lg font-bold">
                        {groupedTasks.length > 0
                          ? Math.round(analysis.tasks.reduce((s, t) => s + t.duration_minutes, 0) / groupedTasks.length)
                          : 0}
                      </div>
                      <div className="text-[11px] text-white/40">Avg min/day</div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <div className="text-lg font-bold">
                        {groupedTasks.length > 0 ? groupedTasks[groupedTasks.length - 1].date : "&#x2014;"}
                      </div>
                      <div className="text-[11px] text-white/40">Last day</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Daily gap</span>
                      <span className="font-semibold">{Math.ceil(analysis.overload.capacityGapMinPerDay)} min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Suggested capacity</span>
                      <span className="font-semibold">{Math.ceil(analysis.overload.suggestedCapacity)} min/day</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Preview schedule</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {groupedTasks.map(bucket => (
                        <div key={bucket.date} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between text-white/80">
                            <div className="font-semibold">{bucket.date}</div>
                            <div className="text-xs text-white/50">
                              {bucket.tasks.length} tasks &#xB7; {bucket.totalMinutes} min
                            </div>
                          </div>
                          <div className="space-y-2">
                            {bucket.tasks.map((task, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white/[0.04] rounded-xl px-2 py-1">
                                <div className="text-xs text-white/80">{task.subjectName}</div>
                                <div className="text-xs text-white/50">{task.duration} min</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCommit}
                    disabled={!canCommit || isCommitting}
                    className="bg-emerald-500/80 hover:bg-emerald-400 rounded-xl text-sm font-semibold px-5 py-3 transition-all disabled:opacity-50"
                  >
                    {isCommitting ? "Committing..." : "Confirm &#x26; Commit"}
                  </button>
                </div>
              )}

              {analysis.status === "OVERLOAD" && (
                <div className="space-y-5 text-sm text-white/80">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>Capacity usage</span>
                      <span className="font-semibold text-red-400">
                        {analysis.currentCapacity > 0 ? Math.round((analysis.burnRate / analysis.currentCapacity) * 100) : 100}% of available
                      </span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-2 progress-red rounded-full transition-all"
                        style={{ width: `${Math.min(100, analysis.burnRate > 0 ? (analysis.currentCapacity / analysis.burnRate) * 100 : 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/30">
                      <span>Available: {analysis.currentCapacity} min/day</span>
                      <span>Required: {Math.ceil(analysis.burnRate)} min/day</span>
                    </div>
                  </div>

                  <div className="warning-card">
                    <div className="text-xs font-semibold text-amber-300">Quick fix suggestion</div>
                    <p className="text-xs text-amber-200/70 mt-1">
                      Increase your daily study time by <span className="font-semibold">{Math.ceil(analysis.capacityGapMinPerDay)} minutes</span> to
                      cover all subjects, or extend deadlines / reduce items on the subjects flagged below.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-white/30">Suggested capacity</div>
                      <div className="text-lg font-bold">{Math.ceil(analysis.suggestedCapacity)} <span className="text-xs text-white/30 font-normal">min/day</span></div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-white/30">Capacity gap</div>
                      <div className="text-lg font-bold text-red-400">+{Math.ceil(analysis.capacityGapMinPerDay)} <span className="text-xs text-white/30 font-normal">min/day</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Subjects needing attention</div>
                    <div className="space-y-2">
                      {analysis.subjects
                        .filter(subject => subject.status === "impossible" || subject.status === "at_risk")
                        .map(subject => {
                          const statusColor = subject.status === "impossible"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          return (
                            <div key={subject.subjectId} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold text-white/90">{subject.name}</div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-xl border ${statusColor}`}>
                                  {subject.status === "impossible" ? "IMPOSSIBLE" : "AT RISK"}
                                </span>
                              </div>
                              <div className="text-xs text-white/40">
                                Needs {Math.ceil(subject.capacityGapMinutesPerDay)} extra min/day &#x2014; try extending its deadline or reducing items.
                              </div>
                            </div>
                          )
                        })}
                      {analysis.subjects
                        .filter(subject => subject.status !== "impossible" && subject.status !== "at_risk")
                        .map(subject => (
                          <div key={subject.subjectId} className="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-2">
                            <div className="font-medium text-white/60 text-xs">{subject.name}</div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              OK
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Adjust and re-analyze</div>
                    <p className="text-xs text-white/30">Fill in one adjustment below and hit re-analyze. Only the first non-empty adjustment is applied.</p>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Increase daily minutes</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                          placeholder="e.g. +30"
                          value={adjustDailyMinutes}
                          onChange={e => setAdjustDailyMinutes(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Extend deadline</label>
                        <select
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none"
                          value={deadlineSubjectId}
                          onChange={e => setDeadlineSubjectId(e.target.value)}
                        >
                          <option value="">Select subject</option>
                          {analysis.subjects.map(subject => (
                            <option key={subject.subjectId} value={subject.subjectId}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                          value={deadlineDate}
                          onChange={e => setDeadlineDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Reduce workload (items)</label>
                        <select
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none"
                          value={workloadSubjectId}
                          onChange={e => setWorkloadSubjectId(e.target.value)}
                        >
                          <option value="">Select subject</option>
                          {analysis.subjects.map(subject => (
                            <option key={subject.subjectId} value={subject.subjectId}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                          placeholder="New total items"
                          value={workloadTotalItems}
                          onChange={e => setWorkloadTotalItems(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleResolveAndReanalyze}
                      disabled={isResolving}
                      className="bg-amber-500/80 hover:bg-amber-400 rounded-xl text-sm font-semibold px-5 py-3 transition-all disabled:opacity-50"
                    >
                      {isResolving ? "Re-analyzing..." : "Re-analyze plan"}
                    </button>
                  </div>
                </div>
              )}

              {analysis.status === "NO_PROFILE" && (
                <div className="text-sm text-white/50">Add your study profile to proceed.</div>
              )}

              {analysis.status === "NO_SUBJECTS" && (
                <div className="text-sm text-white/50">Create at least one subject before planning.</div>
              )}

              {analysis.status === "UNAUTHORIZED" && (
                <div className="text-sm text-white/50">Please sign in to analyze your plan.</div>
              )}
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className="glass-card space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Step 2</p>
              <h2 className="text-xl font-semibold">Confirm &#x26; write tasks</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.06] text-sm text-white/60">
              {isReady && canCommit ? "Ready to commit" : "Run analyze to enable commit"}
            </span>
          </div>

          <p className="text-white/50 text-sm">
            Confirmation writes the analyzed tasks to your account. We only enable this when the analysis returns READY.
          </p>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            {isReady ? (
              <div className="space-y-2 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <span>Planned tasks</span>
                  <span className="font-semibold">{analysis.taskCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Effective daily capacity</span>
                  <span className="font-semibold">
                    {analysis.effectiveCapacity ? Math.ceil(analysis.effectiveCapacity) : Math.ceil(analysis.overload.currentCapacity)} min/day
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/40">Analyze first. We will show the commit summary here.</div>
            )}
          </div>

          {commitResult && commitResult.status === "SUCCESS" && (
            <div className="bg-emerald-500/[0.06] border border-emerald-500/15 text-sm rounded-xl p-3 text-emerald-300">
              Committed {commitResult.taskCount} tasks to your schedule.
            </div>
          )}

          {commitResult && commitResult.status === "UNAUTHORIZED" && (
            <div className="bg-red-500/[0.06] border border-red-500/15 text-sm rounded-xl p-3 text-red-300">
              Please sign in again before committing.
            </div>
          )}

          {commitResult && commitResult.status === "ERROR" && (
            <div className="bg-red-500/[0.06] border border-red-500/15 text-sm rounded-xl p-3 text-red-300">
              {commitResult.message}
            </div>
          )}
        </section>

        {/* Plan History */}
        {planHistory.length > 0 && (
          <section className="glass-card space-y-3">
            <h2 className="text-lg font-bold">Plan History</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {planHistory.map(event => {
                const icon = event.event_type === "committed" ? "&#x1F4CB;" : event.event_type === "analyzed" ? "&#x1F50D;" : "&#x2699;"
                const label = event.event_type === "committed" ? "Committed" : event.event_type === "analyzed" ? "Analyzed" : "Resolved"
                const timeStr = new Date(event.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                return (
                  <div key={event.id} className="flex items-center gap-3 text-sm bg-white/[0.04] rounded-xl px-3 py-2">
                    <span className="text-base shrink-0" dangerouslySetInnerHTML={{ __html: icon }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-white/80">{label}</span>
                      {event.summary && <span className="text-white/40 ml-2">{event.summary}</span>}
                    </div>
                    <span className="text-xs text-white/25 shrink-0">{timeStr}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}