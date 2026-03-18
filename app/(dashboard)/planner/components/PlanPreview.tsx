"use client"

import { useEffect, useMemo, useState } from "react"
import type { PlannerSubjectOption } from "@/lib/planner/draft"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/engine"
import type { ConstraintValues } from "./ConstraintsForm"

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
    const topicCompare = a.topic_id.localeCompare(b.topic_id)
    if (topicCompare !== 0) return topicCompare
    return (a.session_number ?? 0) - (b.session_number ?? 0)
  })
}

function getFitStatus(feasibility: FeasibilityResult, droppedSessions: number, flexDays: number) {
  if (feasibility.feasible) {
    return {
      badge: "✅ Relaxed",
      detail: `${minToHuman(Math.max(0, feasibility.totalSlotsAvailable - feasibility.totalSessionsNeeded))} spare`,
      className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    }
  }

  if (feasibility.flexFeasible) {
    return {
      badge: "⚡ Snug",
      detail: `${flexDays} flex day${flexDays === 1 ? "" : "s"}`,
      className: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    }
  }

  return {
    badge: "🔴 Overloaded",
    detail: droppedSessions > 0
      ? `${droppedSessions} session${droppedSessions === 1 ? "" : "s"} missing`
      : `${Math.ceil(feasibility.globalGap / 60)}h short`,
    className: "bg-red-500/10 border-red-500/30 text-red-300",
  }
}

function buildManualTitle(topic: PreviewTopicOption, note: string) {
  if (!note.trim()) {
    return `${topic.subjectName} – ${topic.topicName} (Manual)`
  }
  return `${topic.subjectName} – ${topic.topicName} · ${note.trim()}`
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
        .sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel))

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
  const lastDay = grouped.length > 0 ? grouped[grouped.length - 1].date : "—"
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
    const topic = topicOptions.find((option) => option.id === manualDraft.topicId)
    if (!topic) return

    const nextSession: ScheduledSession = {
      subject_id: topic.subjectId,
      topic_id: topic.id,
      title: buildManualTitle(topic, manualDraft.note),
      scheduled_date: manualDraft.date,
      duration_minutes: Math.max(15, manualDraft.durationMinutes),
      session_type: "core",
      priority: 3,
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
    const topicCount = new Set(localSessions.map((session) => session.topic_id)).size
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

    const placedByTopic = new Map<string, number>()
    for (const session of localSessions) {
      placedByTopic.set(
        session.topic_id,
        (placedByTopic.get(session.topic_id) ?? 0) + 1
      )
    }

    const droppedTopics: DroppedTopic[] = feasibility.units
      .map((unit) => {
        const placedSessions = placedByTopic.get(unit.unitId) ?? 0
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

    const expectedSessionCount = feasibility.units.reduce(
      (sum, unit) => sum + unit.totalSessions,
      0
    )
    const droppedSessions = droppedTopics.reduce(
      (sum, topic) => sum + topic.droppedSessions,
      0
    )
    const placedRatio = expectedSessionCount > 0
      ? (expectedSessionCount - droppedSessions) / expectedSessionCount
      : 1

    if (droppedSessions > 0) {
      issues.push({
        level: "critical",
        message: `${droppedSessions} session(s) could not be scheduled (${totalSessions}/${expectedSessionCount} placed).`,
        fix: "Increase daily capacity or extend exam date to fit all sessions.",
        targetPhase: 3,
      })
    }

    const impossible = feasibility.units.filter((unit) => unit.status === "impossible")
    const risky = feasibility.units.filter((unit) => unit.status === "at_risk")
    const tight = feasibility.units.filter((unit) => unit.status === "tight")

    if (impossible.length > 0) {
      issues.push({
        level: "critical",
        message: `${impossible.length} topic(s) can't fit in their time window at all.`,
        fix: "Extend deadlines or reduce estimated hours for these topics.",
        targetPhase: 2,
      })
    }
    if (risky.length > 0) {
      issues.push({
        level: "warning",
        message: `${risky.length} topic(s) at risk — very tight on deadline.`,
        fix: "Increase daily capacity or push deadlines back slightly.",
        targetPhase: 3,
      })
    }
    if (tight.length > 0) {
      issues.push({
        level: "info",
        message: `${tight.length} topic(s) have a tight schedule but should fit.`,
      })
    }

    if (feasibility.globalGap > 0) {
      const gapHours = Math.ceil(feasibility.globalGap / 60)
      issues.push({
        level: "critical",
        message: `Total work exceeds available capacity by ${gapHours}h.`,
        fix: "Increase daily study hours or reduce topic effort.",
        targetPhase: 3,
      })
    }

    if (busiestDay && busiestDay.totalMinutes >= Math.max(360, avgPerDay + 150)) {
      issues.push({
        level: "warning",
        message: `Peak day (${busiestDay.date}) has ${minToHuman(busiestDay.totalMinutes)} of study — potentially exhausting.`,
        fix: "Reduce session lengths or set focus depth to smooth workload.",
        targetPhase: 3,
      })
    }

    if (loadSpread >= 180) {
      issues.push({
        level: "warning",
        message: `Daily load varies by ${minToHuman(loadSpread)} (${minToHuman(lightestDay?.totalMinutes ?? 0)} to ${minToHuman(busiestDay?.totalMinutes ?? 0)}).`,
        fix: "Add buffer % and focus depth to flatten daily spikes.",
        targetPhase: 3,
      })
    }

    if (constraints) {
      if (constraints.flexibility_minutes === 0 && constraints.buffer_percentage === 0) {
        issues.push({
          level: "warning",
          message: "No flexibility allowance or buffer — no slack for missed sessions or off days.",
          fix: "Set flexibility allowance (+30–60m) or buffer in constraints.",
          targetPhase: 3,
        })
      }
      if (constraints.final_revision_days === 0) {
        issues.push({
          level: "info",
          message: "No revision days reserved before exam.",
          fix: "Reserve 2–5 revision days in constraints.",
          targetPhase: 3,
        })
      }
      if (constraints.max_active_subjects === 0 && subjectCount >= 4) {
        issues.push({
          level: "info",
          message: `All ${subjectCount} subjects active daily — heavy context switching.`,
          fix: "Set focus depth to 2–3 subjects/day for deeper work.",
          targetPhase: 3,
        })
      }
    }

    const generationNotes: string[] = []
    if (constraints) {
      if (constraints.plan_order_stack && constraints.plan_order_stack.length > 0) {
        generationNotes.push(`Order: ${constraints.plan_order_stack.slice(0, 3).join(" → ")}`)
      } else {
        const planOrderLabel: Record<string, string> = {
          balanced: "Balanced urgency",
          priority: "Priority first",
          deadline: "Deadline first",
          subject: "Subject order",
        }
        generationNotes.push(`Mode: ${planOrderLabel[constraints.plan_order] ?? constraints.plan_order}`)
      }
      generationNotes.push(
        constraints.max_active_subjects > 0
          ? `Focus: top ${constraints.max_active_subjects} subject(s)/day`
          : "Focus: all subjects active"
      )
      generationNotes.push(
        `Capacity: ${minToHuman(constraints.weekday_capacity_minutes)} weekday / ${minToHuman(constraints.weekend_capacity_minutes)} weekend`
      )
      if (constraints.flexibility_minutes && constraints.flexibility_minutes > 0) {
        generationNotes.push(`Flex: +${constraints.flexibility_minutes}m/day overflow`)
      }
      if (constraints.final_revision_days > 0) {
        generationNotes.push(`${constraints.final_revision_days}d revision reserved`)
      }
    } else {
      generationNotes.push("Sequential topics within each subject")
      generationNotes.push("Interleaved subject rotation")
      generationNotes.push("Urgency-based balancing")
    }

    const fixMap = new Map<string, number>()
    for (const issue of issues) {
      if (issue.fix && !fixMap.has(issue.fix)) {
        fixMap.set(issue.fix, issue.targetPhase ?? 3)
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
  }, [avgPerDay, constraints, feasibility, grouped, localSessions, totalMinutes, totalSessions])

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

    const enDashPrefix = `${subjectLabel} – `
    if (title.startsWith(enDashPrefix)) return title.slice(enDashPrefix.length)

    return title
  }

  const criticalCount = planReview.issues.filter((issue) => issue.level === "critical").length
  const warningCount = planReview.issues.filter((issue) => issue.level === "warning").length

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
              Phase 4
            </p>
            <h2 className="text-xl font-semibold">Plan Preview</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {totalSessions} sessions
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {Math.round(totalMinutes / 60)}h total
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {planReview.subjectCount} subjects
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {planReview.topicCount} topics
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${planReview.fitStatus.className}`}>
              {planReview.fitStatus.badge} · {planReview.fitStatus.detail}
            </span>
            {planReview.droppedSessions > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-medium">
                {planReview.droppedSessions} dropped
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              ends {lastDay}
            </span>
          </div>
        </div>
        <p className="text-sm text-white/50">
          Review and edit your plan. Drag sessions between days, pin the ones you want to keep fixed, or add manual sessions before commit.
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
              {isReoptimizing ? "Re-optimizing..." : "Re-optimize Free Sessions"}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/35 leading-relaxed">
          Drag any session onto another day to move it. Moved and manually added sessions become pinned automatically and the re-optimizer will rebuild the remaining free sessions around them.
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
                  <span className={unit.status === "impossible" ? "text-red-200/80" : "text-amber-200/70"}>
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
                <p key={note} className="text-xs text-white/65 leading-relaxed">
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
                <p className="text-xs text-emerald-300/80">All clear — looks good to commit.</p>
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
                    className={`text-xs leading-relaxed ${
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
                  <span className="text-xs text-sky-200/80 leading-relaxed flex-1">
                    {fix.text}
                  </span>
                  {onGoToPhase && (
                    <button
                      type="button"
                      onClick={() => onGoToPhase(fix.targetPhase)}
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 hover:border-sky-500/50 transition-all"
                    >
                      Fix in Phase {fix.targetPhase} →
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
                  <span className="text-white/70 leading-relaxed">{topic.name}</span>
                  <span className="shrink-0 text-red-300/90">
                    {topic.droppedSessions} missing · {topic.placedSessions}/{topic.totalSessions}
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
                      ⚡ +{flexExtra}m flex
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-xs text-white/40">
                    {bucket.sessions.length} sessions · {bucket.totalMinutes} min
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
                      <span className="text-[10px] uppercase tracking-widest text-white/35">Note</span>
                      <input
                        type="text"
                        value={manualDraft.note}
                        onChange={(event) => setManualDraft((current) => current ? {
                          ...current,
                          note: event.target.value,
                        } : current)}
                        placeholder="Optional label"
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
                      disabled={!manualDraft.topicId}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/15 disabled:border-white/[0.08] disabled:bg-white/[0.03] disabled:text-white/30 disabled:cursor-not-allowed"
                    >
                      Add Manual Session
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
                      <div className="text-xs font-semibold text-white/80 truncate">
                        {subject.subjectLabel}
                      </div>
                      <div className="text-[11px] text-white/45 shrink-0">
                        {subject.items.length} sessions · {subject.totalMinutes} min
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
                              <span className="text-[10px] text-white/25">⋮⋮</span>
                              <span className="text-xs truncate">
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
                                <span className="text-[9px]" title="Final session for this topic">🎯</span>
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
                                >
                                  📌
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
                              >
                                ⇄
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeSession(sessionIndex)
                                }}
                                className="text-red-400/40 hover:text-red-400 text-xs"
                                title="Remove from preview"
                              >
                                ×
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
