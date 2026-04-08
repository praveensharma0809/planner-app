"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getSessionCoverage,
  type PlannerConstraintValues as ConstraintValues,
  type PlannerSubjectOption,
} from "@/lib/planner/draft"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/engine"

interface PreviewTopicOption {
  id: string
  subjectId: string
  subjectName: string
  topicName: string
}

interface PlanPreviewProps {
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult
  constraints?: ConstraintValues | null
  subjects: PlannerSubjectOption[]
  topicOptions: PreviewTopicOption[]
  onEdit: (sessions: ScheduledSession[]) => void
  onReoptimize: (reservedSessions: ScheduledSession[]) => Promise<void>
  onConfirm: () => void
  onGoToPhase?: (phase: number) => void
  isReoptimizing: boolean
}

interface ReviewIssue {
  level: "critical" | "warning" | "info"
  message: string
  fix?: string
  targetPhase?: number
}

interface DroppedTopic {
  unitId: string
  name: string
  droppedSessions: number
  placedSessions: number
  totalSessions: number
}

interface SessionInDay {
  sessionIndex: number
  session: ScheduledSession
}

interface SubjectBucket {
  subjectId: string
  subjectLabel: string
  items: SessionInDay[]
  totalMinutes: number
}

interface DayBucket {
  date: string
  sessions: ScheduledSession[]
  subjectBuckets: SubjectBucket[]
  totalMinutes: number
}

interface ManualDraft {
  date: string
  subjectId: string
  topicId: string
  durationMinutes: number
  note: string
}

function minToHuman(min: number): string {
  if (!min || min <= 0) return "0m"
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function sortPreviewSessions(sessions: ScheduledSession[]) {
  return [...sessions].sort((a, b) => {
    const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCompare !== 0) return dateCompare
    if (Boolean(b.is_manual) !== Boolean(a.is_manual)) {
      return Number(Boolean(b.is_manual)) - Number(Boolean(a.is_manual))
    }
    if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
      return Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
    }
    const subjectCompare = a.subject_id.localeCompare(b.subject_id)
    if (subjectCompare !== 0) return subjectCompare
    const topicCompare = a.topic_id.localeCompare(b.topic_id)
    if (topicCompare !== 0) return topicCompare
    return (a.session_number ?? 0) - (b.session_number ?? 0)
  })
}

function getFitStatus(feasibility: FeasibilityResult, droppedSessions: number, flexDays: number) {
  if (feasibility.feasible) {
    return {
      badge: "Relaxed",
      detail: `${minToHuman(Math.max(0, feasibility.totalSlotsAvailable - feasibility.totalSessionsNeeded))} spare`,
      className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    }
  }

  if (feasibility.flexFeasible) {
    return {
      badge: "Snug",
      detail: `${flexDays} flex day${flexDays === 1 ? "" : "s"}`,
      className: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    }
  }

  return {
    badge: "Overloaded",
    detail: droppedSessions > 0
      ? `${droppedSessions} session${droppedSessions === 1 ? "" : "s"} missing`
      : `${Math.ceil(feasibility.globalGap / 60)}h short`,
    className: "bg-red-500/10 border-red-500/30 text-red-300",
  }
}

function buildManualTitle(topic: PreviewTopicOption | null, note: string) {
  const trimmed = note.trim()

  if (!topic) {
    return trimmed || "Custom Session"
  }

  if (!trimmed) {
    return `${topic.topicName} (Manual)`
  }

  return `${topic.topicName} - ${trimmed}`
}

export default function PlanPreview({
  sessions,
  feasibility,
  constraints,
  subjects,
  topicOptions,
  onEdit,
  onReoptimize,
  onConfirm,
  onGoToPhase,
  isReoptimizing,
}: PlanPreviewProps) {
  const [localSessions, setLocalSessions] = useState(() => sortPreviewSessions(sessions))
  const [draggedSessionIndex, setDraggedSessionIndex] = useState<number | null>(null)
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null)
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null)

  useEffect(() => {
    setLocalSessions(sortPreviewSessions(sessions))
  }, [sessions])

  const topicOptionsBySubject = useMemo(() => {
    const map = new Map<string, PreviewTopicOption[]>()
    for (const topic of topicOptions) {
      const list = map.get(topic.subjectId) ?? []
      list.push(topic)
      map.set(topic.subjectId, list)
    }
    return map
  }, [topicOptions])

  const grouped = useMemo(() => {
    const subjectOrderIndex = new Map(subjects.map((subject, index) => [subject.id, index]))
    const byDate = new Map<string, SessionInDay[]>()
    localSessions.forEach((session, sessionIndex) => {
      const list = byDate.get(session.scheduled_date) ?? []
      list.push({ session, sessionIndex })
      byDate.set(session.scheduled_date, list)
    })

    const buckets: DayBucket[] = []
    for (const [date, items] of Array.from(byDate.entries()).sort(([a], [b]) =>
      a > b ? 1 : -1
    )) {
      const bySubject = new Map<string, SessionInDay[]>()
      for (const item of items) {
        const sid = item.session.subject_id
        const list = bySubject.get(sid) ?? []
        list.push(item)
        bySubject.set(sid, list)
      }

      const subjectBuckets: SubjectBucket[] = Array.from(bySubject.entries())
        .map(([subjectId, subjectItems]) => {
          const subjectLabel = subjects.find((subject) => subject.id === subjectId)?.name ?? subjectId
          return {
            subjectId,
            subjectLabel,
            items: subjectItems,
            totalMinutes: subjectItems.reduce(
              (sum, item) => sum + item.session.duration_minutes,
              0
            ),
          }
        })
        .sort((a, b) => {
          const aOrder = subjectOrderIndex.get(a.subjectId) ?? Number.MAX_SAFE_INTEGER
          const bOrder = subjectOrderIndex.get(b.subjectId) ?? Number.MAX_SAFE_INTEGER
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.subjectLabel.localeCompare(b.subjectLabel)
        })

      buckets.push({
        date,
        sessions: items.map((item) => item.session),
        subjectBuckets,
        totalMinutes: items.reduce((sum, item) => sum + item.session.duration_minutes, 0),
      })
    }
    return buckets
  }, [localSessions, subjects])

  const totalSessions = localSessions.length
  const totalDays = grouped.length
  const totalMinutes = localSessions.reduce((sum, session) => sum + session.duration_minutes, 0)
  const avgPerDay = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
  const lastDay = grouped.length > 0 ? grouped[grouped.length - 1].date : "-"
  const pinnedCount = localSessions.filter((session) => session.is_pinned && !session.is_manual).length
  const manualCount = localSessions.filter((session) => session.is_manual).length
  const reservedSessions = localSessions.filter((session) => session.is_pinned || session.is_manual)

  const commitSessions = (next: ScheduledSession[]) => {
    const sorted = sortPreviewSessions(next)
    setLocalSessions(sorted)
    onEdit(sorted)
  }

  const updateSession = (
    sessionIndex: number,
    updater: (session: ScheduledSession) => ScheduledSession
  ) => {
    const next = localSessions.map((session, index) =>
      index === sessionIndex ? updater(session) : session
    )
    commitSessions(next)
  }

  const moveSession = (sessionIndex: number, targetDate: string) => {
    if (sessionIndex < 0 || sessionIndex >= localSessions.length) return
    if (localSessions[sessionIndex]?.scheduled_date === targetDate) return

    updateSession(sessionIndex, (session) => ({
      ...session,
      scheduled_date: targetDate,
      is_pinned: true,
    }))
    setSwapSourceIndex(null)
  }

  const swapSessions = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    const next = [...localSessions]
    const source = next[sourceIndex]
    const target = next[targetIndex]
    if (!source || !target) return

    next[sourceIndex] = {
      ...source,
      scheduled_date: target.scheduled_date,
      is_pinned: true,
    }
    next[targetIndex] = {
      ...target,
      scheduled_date: source.scheduled_date,
      is_pinned: true,
    }

    setSwapSourceIndex(null)
    commitSessions(next)
  }

  const removeSession = (sessionIndex: number) => {
    setSwapSourceIndex((current) => (current === sessionIndex ? null : current))
    commitSessions(localSessions.filter((_, index) => index !== sessionIndex))
  }

  const togglePin = (sessionIndex: number) => {
    const session = localSessions[sessionIndex]
    if (!session || session.is_manual) return
    updateSession(sessionIndex, (current) => ({
      ...current,
      is_pinned: !current.is_pinned,
    }))
  }

  const startSwap = (sessionIndex: number) => {
    setSwapSourceIndex((current) => (current === sessionIndex ? null : sessionIndex))
  }

  const openManualDraft = (date: string) => {
    const defaultSubject = subjects[0]?.id ?? ""
    const defaultTopic = defaultSubject
      ? topicOptionsBySubject.get(defaultSubject)?.[0]?.id ?? ""
      : ""
    setManualDraft({
      date,
      subjectId: defaultSubject,
      topicId: defaultTopic,
      durationMinutes: 60,
      note: "",
    })
    setSwapSourceIndex(null)
  }

  const addManualSession = () => {
    if (!manualDraft) return
    if (!manualDraft.subjectId) return

    const topic = manualDraft.topicId
      ? topicOptions.find((option) => option.id === manualDraft.topicId) ?? null
      : null

    const nextSession: ScheduledSession = {
      subject_id: manualDraft.subjectId,
      topic_id: topic?.id ?? "",
      title: buildManualTitle(topic, manualDraft.note),
      scheduled_date: manualDraft.date,
      duration_minutes: Math.max(15, manualDraft.durationMinutes),
      session_type: "core",
      session_number: 0,
      total_sessions: 0,
      is_pinned: true,
      is_manual: true,
    }

    setManualDraft(null)
    commitSessions([...localSessions, nextSession])
  }

  const selectedSubjectTopics = manualDraft
    ? topicOptionsBySubject.get(manualDraft.subjectId) ?? []
    : []

  const planReview = useMemo(() => {
    const issues: ReviewIssue[] = []
    const subjectCount = new Set(localSessions.map((session) => session.subject_id)).size
    const topicCount = new Set(
      localSessions.map((session) => session.topic_id).filter((topicId) => topicId.trim().length > 0)
    ).size
    const flexDays = grouped.filter((day) =>
      day.sessions.some((session) => session.is_flex_day)
    ).length
    const busiestDay = grouped.reduce<DayBucket | null>(
      (max, day) => (!max || day.totalMinutes > max.totalMinutes ? day : max),
      null
    )
    const lightestDay = grouped.reduce<DayBucket | null>(
      (min, day) => (!min || day.totalMinutes < min.totalMinutes ? day : min),
      null
    )
    const loadSpread =
      busiestDay && lightestDay ? busiestDay.totalMinutes - lightestDay.totalMinutes : 0

    const enginePlacedByTopic = new Map<string, number>()
    for (const session of sessions) {
      if (session.is_manual || !session.topic_id || session.topic_id.trim().length === 0) continue
      enginePlacedByTopic.set(
        session.topic_id,
        (enginePlacedByTopic.get(session.topic_id) ?? 0) + 1
      )
    }

    const droppedTopics: DroppedTopic[] = feasibility.units
      .map((unit) => {
        const placedSessions = enginePlacedByTopic.get(unit.unitId) ?? 0
        const dropped = Math.max(0, unit.totalSessions - placedSessions)
        return {
          unitId: unit.unitId,
          name: unit.name,
          droppedSessions: dropped,
          placedSessions,
          totalSessions: unit.totalSessions,
        }
      })
      .filter((topic) => topic.droppedSessions > 0)
      .sort((a, b) => b.droppedSessions - a.droppedSessions || a.name.localeCompare(b.name))

    const coverage = getSessionCoverage(feasibility, sessions)
    const expectedSessionCount = coverage.expectedSessions
    const generatedSessionCount = coverage.generatedSessions
    const droppedSessions = coverage.missingGeneratedSessions
    const placedRatio = expectedSessionCount > 0
      ? (expectedSessionCount - droppedSessions) / expectedSessionCount
      : 1

    if (droppedSessions > 0) {
      issues.push({
        level: "critical",
        message: `${droppedSessions} session(s) are still unplaced in the latest generated plan output (${generatedSessionCount}/${expectedSessionCount} generated placed).`,
      })
    }

    const impossible = feasibility.units.filter((unit) => unit.status === "impossible")
    const risky = feasibility.units.filter((unit) => unit.status === "at_risk")

    if (impossible.length > 0) {
      issues.push({
        level: "critical",
        message: `${impossible.length} topic(s) cannot fit inside their available date window.`,
      })
    }

    if (risky.length > 0) {
      issues.push({
        level: "warning",
        message: `${risky.length} topic(s) are extremely tight and may slip with any disruption.`,
      })
    }

    if (feasibility.globalGap > 0) {
      const gapHours = Math.ceil(feasibility.globalGap / 60)
      issues.push({
        level: "warning",
        message: `Aggregate workload still exceeds base capacity by about ${gapHours} hour(s).`,
      })
    }

    if (loadSpread >= 180) {
      issues.push({
        level: "warning",
        message: `Daily load spread is high (${minToHuman(lightestDay?.totalMinutes ?? 0)} to ${minToHuman(busiestDay?.totalMinutes ?? 0)}).`,
      })
    }

    if (constraints && constraints.study_start_date >= constraints.exam_date) {
      issues.push({
        level: "critical",
        message: "Final deadline must be after start date.",
      })
    }

    const generationNotes: string[] = []
    if (constraints) {
      generationNotes.push(`Window: ${constraints.study_start_date} to ${constraints.exam_date}`)
      generationNotes.push(
        `Capacity: ${constraints.weekday_capacity_minutes}m weekday / ${constraints.weekend_capacity_minutes}m weekend`
      )
      generationNotes.push(
        constraints.max_active_subjects > 0
          ? `Max active subjects/day: ${constraints.max_active_subjects}`
          : "Max active subjects/day: no cap"
      )
      generationNotes.push(`Flex allowance: ${constraints.flexibility_minutes}m/day`)

      const dayOverrideCount = constraints.day_of_week_capacity.filter((value) => value != null).length
      const customDateOverrideCount = Object.keys(constraints.custom_day_capacity ?? {}).length
      if (dayOverrideCount > 0 || customDateOverrideCount > 0) {
        generationNotes.push(
          `Overrides: ${dayOverrideCount} weekday override(s), ${customDateOverrideCount} custom date override(s)`
        )
      }
    }

    const fixMap = new Map<string, number>()

    for (const suggestion of feasibility.suggestions) {
      const text = suggestion.message.trim()
      if (text.length > 0 && !fixMap.has(text)) {
        fixMap.set(text, 1)
      }
    }

    for (const unit of feasibility.units) {
      if (unit.status !== "impossible" && unit.status !== "at_risk") continue
      for (const suggestion of unit.suggestions) {
        const text = suggestion.message.trim()
        if (text.length > 0 && !fixMap.has(text)) {
          fixMap.set(text, 1)
        }
      }
    }

    return {
      totalMinutes,
      subjectCount,
      topicCount,
      fitStatus: getFitStatus(feasibility, droppedSessions, flexDays),
      busiestDay,
      lightestDay,
      loadSpread,
      droppedSessions,
      droppedTopics,
      placedRatio,
      generationNotes,
      issues,
      fixes: Array.from(fixMap.entries()).map(([text, phase]) => ({ text, targetPhase: phase })),
    }
  }, [constraints, feasibility, grouped, localSessions, sessions, totalMinutes])

  const sessionTypeColor = (session: ScheduledSession) => {
    const base = session.session_type === "revision"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : session.session_type === "practice"
        ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
        : "bg-white/[0.04] text-white/80 border-white/[0.06]"

    if (session.is_manual) return `${base} ring-1 ring-fuchsia-400/40`
    if (session.is_pinned) return `${base} ring-1 ring-sky-400/40`
    return base
  }

  const stripSubjectPrefix = (title: string, subjectLabel: string) => {
    const hyphenPrefix = `${subjectLabel} - `
    if (title.startsWith(hyphenPrefix)) return title.slice(hyphenPrefix.length)

    const enDashPrefix = `${subjectLabel} - `
    if (title.startsWith(enDashPrefix)) return title.slice(enDashPrefix.length)

    return title
  }

  const criticalCount = planReview.issues.filter((issue) => issue.level === "critical").length
  const warningCount = planReview.issues.filter((issue) => issue.level === "warning").length

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
        <p className="text-xs uppercase tracking-widest text-white/35 font-medium">
          Preview Summary
        </p>
        <p className="mt-1 text-sm text-white/60 break-words leading-relaxed">
          {`${totalSessions} sessions | ${minToHuman(totalMinutes)} total | ${totalDays} days | ${minToHuman(avgPerDay)} avg/day | Ends ${lastDay}`}
        </p>
        <p className="mt-1 text-[11px] text-white/35">
          Fit indicators are based on the last generated plan.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            <span className="px-2 py-0.5 rounded-md border border-white/[0.08] bg-white/[0.03]">
              {pinnedCount} pinned
            </span>
            <span className="px-2 py-0.5 rounded-md border border-white/[0.08] bg-white/[0.03]">
              {manualCount} manual
            </span>
            {swapSourceIndex != null && (
              <span className="px-2 py-0.5 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200">
                Swap mode active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {swapSourceIndex != null && (
              <button
                type="button"
                onClick={() => setSwapSourceIndex(null)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white/75"
              >
                Cancel Swap
              </button>
            )}
            <button
              type="button"
              onClick={() => onReoptimize(reservedSessions)}
              disabled={isReoptimizing || reservedSessions.length === 0}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15 disabled:border-white/[0.08] disabled:bg-white/[0.03] disabled:text-white/30 disabled:cursor-not-allowed"
            >
              {isReoptimizing ? "Rebuilding..." : "Rebuild Around Locked Sessions"}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/35 leading-relaxed break-words">
          Drag any session to a different day to lock it in place. Locked sessions (pinned + custom) are preserved, and rebuild updates only the remaining generated sessions.
        </p>
      </div>

      {feasibility.units.some(
        (unit) => unit.status === "at_risk" || unit.status === "impossible"
      ) && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
          <div className="text-xs font-semibold text-red-300">
            {feasibility.units.some((unit) => unit.status === "impossible")
              ? "Some topics cannot fit in their time window"
              : "Some topics are tight on time"}
          </div>
          <div className="mt-1.5 space-y-1">
            {feasibility.units
              .filter((unit) => unit.status === "at_risk" || unit.status === "impossible")
              .map((unit) => (
                <div key={unit.unitId} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${unit.status === "impossible" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className={`${unit.status === "impossible" ? "text-red-200/80" : "text-amber-200/70"} break-words`}>
                    {unit.name}: {unit.totalSessions} sessions needed, {unit.availableMinutes} min available
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <p className="text-xs uppercase tracking-widest text-sky-300/70 font-semibold">
              Plan Review
            </p>
            {criticalCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 font-semibold">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                {warningCount} warning{warningCount > 1 ? "s" : ""}
              </span>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                healthy
              </span>
            )}
          </div>
          <div className="text-right text-[11px] text-white/40 shrink-0 flex items-center gap-3">
            <span>{planReview.subjectCount} subj</span>
            <span>{planReview.topicCount} topics</span>
            <span>{minToHuman(planReview.totalMinutes)}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              How Built
            </p>
            <div className="space-y-1">
              {planReview.generationNotes.map((note) => (
                <p key={note} className="text-xs text-white/65 leading-relaxed break-words">
                  {note}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              Warnings
            </p>
            <div className="space-y-1.5">
              {planReview.issues.length === 0 && (
                <p className="text-xs text-emerald-300/80">All clear - looks good to commit.</p>
              )}
              {planReview.issues.slice(0, 5).map((issue, idx) => (
                <div key={`${issue.message}-${idx}`} className="flex items-start gap-1.5">
                  <span
                    className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      issue.level === "critical"
                        ? "bg-red-400"
                        : issue.level === "warning"
                          ? "bg-amber-400"
                          : "bg-white/30"
                    }`}
                  />
                  <span
                    className={`text-xs leading-relaxed break-words ${
                      issue.level === "critical"
                        ? "text-red-300/90"
                        : issue.level === "warning"
                          ? "text-amber-300/90"
                          : "text-white/60"
                    }`}
                  >
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              Suggested Fixes
            </p>
            <div className="space-y-2">
              {planReview.fixes.length === 0 && (
                <p className="text-xs text-white/55">No fixes needed.</p>
              )}
              {planReview.fixes.slice(0, 4).map((fix) => (
                <div key={fix.text} className="flex items-start gap-2">
                  <span className="text-xs text-sky-200/80 leading-relaxed break-words flex-1">
                    {fix.text}
                  </span>
                  {onGoToPhase && (
                    <button
                      type="button"
                      onClick={() => onGoToPhase(fix.targetPhase)}
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 hover:border-sky-500/50 transition-all"
                    >
                      Fix in Phase {fix.targetPhase} {">"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              Unplaced Sessions
            </p>
            <div className="space-y-1.5">
              {planReview.droppedTopics.length === 0 && (
                <p className="text-xs text-white/55">All generated sessions are still represented in the preview.</p>
              )}
              {planReview.droppedTopics.slice(0, 4).map((topic) => (
                <div key={topic.unitId} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-white/70 leading-relaxed break-words">{topic.name}</span>
                  <span className="shrink-0 text-red-300/90">
                    {topic.droppedSessions} missing | {topic.placedSessions}/{topic.totalSessions}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {grouped.map((bucket) => {
          const isFlexDay = bucket.sessions.some((session) => session.is_flex_day)
          const flexExtra = bucket.sessions.reduce((max, session) => Math.max(max, session.flex_extra_minutes ?? 0), 0)
          return (
            <div
              key={bucket.date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedSessionIndex == null) return
                moveSession(draggedSessionIndex, bucket.date)
                setDraggedSessionIndex(null)
              }}
              className={`bg-white/[0.03] border rounded-xl p-3 space-y-2 transition-colors ${
                isFlexDay ? "border-amber-500/20" : "border-white/[0.06]"
              } ${draggedSessionIndex != null ? "hover:border-sky-400/30" : ""}`}
            >
              <div className="flex items-center justify-between text-white/80 gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{bucket.date}</span>
                  {isFlexDay && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                      +{flexExtra}m flex
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs text-white/40">
                    {bucket.sessions.length} sessions | {bucket.totalMinutes} min
                  </div>
                  <button
                    type="button"
                    onClick={() => openManualDraft(bucket.date)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white/75"
                  >
                    + Add Session
                  </button>
                </div>
              </div>

              {manualDraft?.date === bucket.date && (
                <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/35">Subject</span>
                      <select
                        value={manualDraft.subjectId}
                        onChange={(event) => {
                          const nextSubjectId = event.target.value
                          const nextTopicId = topicOptionsBySubject.get(nextSubjectId)?.[0]?.id ?? ""
                          setManualDraft((current) => current ? {
                            ...current,
                            subjectId: nextSubjectId,
                            topicId: nextTopicId,
                          } : current)
                        }}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/75 outline-none"
                      >
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/35">Topic</span>
                      <select
                        value={manualDraft.topicId}
                        onChange={(event) => setManualDraft((current) => current ? {
                          ...current,
                          topicId: event.target.value,
                        } : current)}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/75 outline-none"
                      >
                        <option value="">Custom session (no topic link)</option>
                        {selectedSubjectTopics.map((topic) => (
                          <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/35">Duration</span>
                      <input
                        type="number"
                        min="15"
                        step="15"
                        value={manualDraft.durationMinutes}
                        onChange={(event) => setManualDraft((current) => current ? {
                          ...current,
                          durationMinutes: Math.max(15, parseInt(event.target.value) || 15),
                        } : current)}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/75 outline-none"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/35">
                        {manualDraft.topicId ? "Note" : "Custom Title"}
                      </span>
                      <input
                        type="text"
                        value={manualDraft.note}
                        onChange={(event) => setManualDraft((current) => current ? {
                          ...current,
                          note: event.target.value,
                        } : current)}
                        placeholder={manualDraft.topicId ? "Optional label" : "Optional custom session title"}
                        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/75 outline-none placeholder:text-white/20"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManualDraft(null)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addManualSession}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/15 disabled:border-white/[0.08] disabled:bg-white/[0.03] disabled:text-white/30 disabled:cursor-not-allowed"
                    >
                      Add Session
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {bucket.subjectBuckets.map((subject) => (
                  <div
                    key={subject.subjectId}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.05] bg-white/[0.02]">
                      <div className="text-xs font-semibold text-white/80 truncate min-w-0">
                        {subject.subjectLabel}
                      </div>
                      <div className="text-[11px] text-white/45 shrink-0">
                        {subject.items.length} sessions | {subject.totalMinutes} min
                      </div>
                    </div>
                    <div className="space-y-1 p-2">
                      {subject.items.map(({ sessionIndex, session }) => {
                        const isSwapSource = swapSourceIndex === sessionIndex
                        const canReceiveSwap = swapSourceIndex != null && swapSourceIndex !== sessionIndex
                        return (
                          <div
                            key={`${sessionIndex}-${session.topic_id}-${session.session_number ?? 0}`}
                            draggable
                            onDragStart={() => setDraggedSessionIndex(sessionIndex)}
                            onDragEnd={() => setDraggedSessionIndex(null)}
                            onClick={() => {
                              if (swapSourceIndex != null && swapSourceIndex !== sessionIndex) {
                                swapSessions(swapSourceIndex, sessionIndex)
                              }
                            }}
                            className={`flex items-center justify-between rounded-xl px-2 py-1.5 border cursor-pointer transition-all ${sessionTypeColor(session)} ${
                              isSwapSource ? "ring-1 ring-fuchsia-400/70" : canReceiveSwap ? "hover:ring-1 hover:ring-fuchsia-400/30" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-white/25">::</span>
                              <span className="text-xs truncate min-w-0">
                                {stripSubjectPrefix(session.title, subject.subjectLabel)}
                              </span>
                              {session.session_type !== "core" && (
                                <span className="text-[9px] uppercase font-bold opacity-60">
                                  {session.session_type}
                                </span>
                              )}
                              {session.is_manual && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 font-semibold">
                                  manual
                                </span>
                              )}
                              {session.is_pinned && !session.is_manual && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-200 font-semibold">
                                  pinned
                                </span>
                              )}
                              {session.is_topic_final_session && (
                                <span className="text-[9px]" title="Final session for this topic">done</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {session.topic_completion_after != null && session.topic_completion_after > 0 && (
                                <span className="text-[9px] text-emerald-400/70 font-medium">
                                  {Math.round(session.topic_completion_after * 100)}%
                                </span>
                              )}
                              <span className="text-xs text-white/50">
                                {session.duration_minutes}m
                              </span>
                              {!session.is_manual && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    togglePin(sessionIndex)
                                  }}
                                  className={`text-xs ${session.is_pinned ? "text-sky-300" : "text-white/35 hover:text-white/70"}`}
                                  title={session.is_pinned ? "Unpin session" : "Pin session"}
                                  aria-label={session.is_pinned ? "Unpin session" : "Pin session"}
                                  aria-pressed={session.is_pinned}
                                >
                                  pin
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  startSwap(sessionIndex)
                                }}
                                className={`text-xs ${isSwapSource ? "text-fuchsia-300" : "text-white/35 hover:text-white/70"}`}
                                title="Swap with another session"
                                aria-label="Swap with another session"
                                aria-pressed={isSwapSource}
                              >
                                swap
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeSession(sessionIndex)
                                }}
                                className="text-red-400/40 hover:text-red-400 text-xs"
                                title="Remove from preview"
                                aria-label="Remove session from preview"
                              >
                                x
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={onConfirm} disabled={localSessions.length === 0} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">
          Continue to Confirm
        </button>
      </div>
    </div>
  )
}
