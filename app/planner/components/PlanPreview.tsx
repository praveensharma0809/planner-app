"use client"

import { useEffect, useMemo, useState } from "react"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/types"
import type { ConstraintValues } from "./ConstraintsForm"

interface PlanPreviewProps {
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult
  constraints?: ConstraintValues | null
  onEdit: (sessions: ScheduledSession[]) => void
  onConfirm: () => void
  onGoToPhase?: (phase: number) => void
}

interface ReviewIssue {
  level: "critical" | "warning" | "info"
  message: string
  fix?: string
  targetPhase?: number
}

interface SessionInDay {
  dayIndex: number
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

function minToHuman(min: number): string {
  if (!min || min <= 0) return "0m"
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function PlanPreview({
  sessions,
  feasibility,
  constraints,
  onEdit,
  onConfirm,
  onGoToPhase,
}: PlanPreviewProps) {
  const [localSessions, setLocalSessions] = useState(sessions)

  useEffect(() => {
    setLocalSessions(sessions)
  }, [sessions])

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
      const indexed: SessionInDay[] = items.map((session, dayIndex) => ({
        dayIndex,
        session,
      }))

      const bySubject = new Map<string, SessionInDay[]>()
      for (const item of indexed) {
        const sid = item.session.subject_id
        const list = bySubject.get(sid) ?? []
        list.push(item)
        bySubject.set(sid, list)
      }

      const subjectBuckets: SubjectBucket[] = Array.from(bySubject.entries())
        .map(([subjectId, subjectItems]) => {
          const firstTitle = subjectItems[0]?.session.title ?? subjectId
          const hyphenIdx = firstTitle.indexOf(" - ")
          const enDashIdx = firstTitle.indexOf(" \u2013 ")
          const sepIdx = hyphenIdx >= 0 ? hyphenIdx : enDashIdx
          const subjectLabel = sepIdx > 0 ? firstTitle.slice(0, sepIdx) : subjectId
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
        sessions: items,
        subjectBuckets,
        totalMinutes: items.reduce((s, i) => s + i.duration_minutes, 0),
      })
    }
    return buckets
  }, [localSessions])

  const totalSessions = localSessions.length
  const totalDays = grouped.length
  const totalMinutes = localSessions.reduce((s, t) => s + t.duration_minutes, 0)
  const avgPerDay = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
  const lastDay = grouped.length > 0 ? grouped[grouped.length - 1].date : "—"

  // ── Deep plan review ──────────────────────────────────────────────────────
  const planReview = useMemo(() => {
    const issues: ReviewIssue[] = []
    const subjectCount = new Set(localSessions.map((s) => s.subject_id)).size
    const topicCount = new Set(localSessions.map((s) => s.topic_id)).size
    const busiestDay = grouped.reduce<DayBucket | null>(
      (max, d) => (!max || d.totalMinutes > max.totalMinutes ? d : max),
      null
    )
    const lightestDay = grouped.reduce<DayBucket | null>(
      (min, d) => (!min || d.totalMinutes < min.totalMinutes ? d : min),
      null
    )
    const loadSpread =
      busiestDay && lightestDay ? busiestDay.totalMinutes - lightestDay.totalMinutes : 0

    // ── Sessions placed vs expected ────────────────────────────────────────
    const expectedSessions = feasibility.totalSessionsNeeded
    // totalSessionsNeeded from feasibility is actually totalMinutesNeeded
    // Compute expected session count from feasibility units
    const expectedSessionCount = feasibility.units.reduce(
      (sum, u) => sum + u.totalSessions, 0
    )
    const placedRatio = expectedSessionCount > 0
      ? totalSessions / expectedSessionCount
      : 1
    const droppedSessions = Math.max(0, expectedSessionCount - totalSessions)

    if (droppedSessions > 0) {
      issues.push({
        level: "critical",
        message: `${droppedSessions} session(s) could not be scheduled (${totalSessions}/${expectedSessionCount} placed).`,
        fix: "Increase daily capacity or extend exam date to fit all sessions.",
        targetPhase: 3,
      })
    }

    // ── Feasibility unit analysis ──────────────────────────────────────────
    const impossible = feasibility.units.filter((u) => u.status === "impossible")
    const risky = feasibility.units.filter((u) => u.status === "at_risk")
    const tight = feasibility.units.filter((u) => u.status === "tight")

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

    // ── Global feasibility gap ─────────────────────────────────────────────
    if (feasibility.globalGap > 0) {
      const gapHours = Math.ceil(feasibility.globalGap / 60)
      issues.push({
        level: "critical",
        message: `Total work exceeds available capacity by ${gapHours}h.`,
        fix: "Increase daily study hours or reduce topic effort.",
        targetPhase: 3,
      })
    }

    // ── Load distribution analysis ─────────────────────────────────────────
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

    // ── Configuration-based insights ──────────────────────────────────────
    if (constraints) {
      if (constraints.buffer_percentage === 0) {
        issues.push({
          level: "warning",
          message: "Buffer is 0% — no slack for missed sessions or off days.",
          fix: "Set 5–10% buffer in constraints to absorb delays.",
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
      if (
        constraints.weekday_capacity_minutes > 0 &&
        constraints.weekend_capacity_minutes > 0 &&
        constraints.weekend_capacity_minutes < constraints.weekday_capacity_minutes
      ) {
        issues.push({
          level: "info",
          message: "Weekend capacity is lower than weekday — weekends may bottleneck.",
        })
      }
    }

    // ── Generation notes ──────────────────────────────────────────────────
    const generationNotes: string[] = []
    if (constraints) {
      const planOrderLabel: Record<ConstraintValues["plan_order"], string> = {
        balanced: "Balanced urgency",
        priority: "Priority first",
        deadline: "Deadline first",
        subject: "Subject order",
      }
      generationNotes.push(`Mode: ${planOrderLabel[constraints.plan_order]}`)
      generationNotes.push(
        constraints.max_active_subjects > 0
          ? `Focus: top ${constraints.max_active_subjects} subject(s)/day`
          : "Focus: all subjects active"
      )
      generationNotes.push(
        `Capacity: ${minToHuman(constraints.weekday_capacity_minutes)} weekday / ${minToHuman(constraints.weekend_capacity_minutes)} weekend`
      )
      if (constraints.buffer_percentage > 0 || constraints.final_revision_days > 0) {
        generationNotes.push(
          `Safety: ${constraints.buffer_percentage}% buffer, ${constraints.final_revision_days}d revision`
        )
      }
    } else {
      generationNotes.push("Sequential topics within each subject")
      generationNotes.push("Interleaved subject rotation")
      generationNotes.push("Urgency-based balancing")
    }

    // ── Build deduplicated fix list with target phases ────────────────────
    const fixMap = new Map<string, number>()
    for (const i of issues) {
      if (i.fix && !fixMap.has(i.fix)) {
        fixMap.set(i.fix, i.targetPhase ?? 3)
      }
    }
    const fixes = Array.from(fixMap.entries()).map(([text, phase]) => ({
      text,
      targetPhase: phase,
    }))

    return {
      totalMinutes,
      subjectCount,
      topicCount,
      busiestDay,
      lightestDay,
      loadSpread,
      droppedSessions,
      placedRatio,
      generationNotes,
      issues,
      fixes,
    }
  }, [avgPerDay, constraints, feasibility, grouped, localSessions, totalMinutes, totalSessions])

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

  const stripSubjectPrefix = (title: string, subjectLabel: string) => {
    const hyphenPrefix = `${subjectLabel} - `
    if (title.startsWith(hyphenPrefix)) return title.slice(hyphenPrefix.length)

    const enDashPrefix = `${subjectLabel} \u2013 `
    if (title.startsWith(enDashPrefix)) return title.slice(enDashPrefix.length)

    return title
  }

  const criticalCount = planReview.issues.filter((i) => i.level === "critical").length
  const warningCount = planReview.issues.filter((i) => i.level === "warning").length

  return (
    <div className="space-y-5">
      {/* ── Header + compact stats ──────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
              Phase 4
            </p>
            <h2 className="text-xl font-semibold">Plan Preview</h2>
          </div>
          {/* Compact stats pill row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {totalSessions} sessions
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              {totalDays} days
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              ~{avgPerDay}m/day
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60">
              ends {lastDay}
            </span>
            {planReview.droppedSessions > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-medium">
                {planReview.droppedSessions} dropped
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-white/50">
          Review and edit your plan. Changes here are local until you confirm.
        </p>
      </div>

      {/* ── Critical: feasibility warnings ─────────────────────────────── */}
      {feasibility.units.some(
        (u) => u.status === "at_risk" || u.status === "impossible"
      ) && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
          <div className="text-xs font-semibold text-red-300">
            {feasibility.units.some((u) => u.status === "impossible")
              ? "Some topics cannot fit in their time window"
              : "Some topics are tight on time"}
          </div>
          <div className="mt-1.5 space-y-1">
            {feasibility.units
              .filter(
                (u) => u.status === "at_risk" || u.status === "impossible"
              )
              .map((u) => (
                <div key={u.unitId} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.status === "impossible" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className={u.status === "impossible" ? "text-red-200/80" : "text-amber-200/70"}>
                    {u.name}: {u.totalSessions} sessions needed, {u.availableMinutes} min available
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Quick Plan Review ──────────────────────────────────────────── */}
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

        <div className="grid gap-3 md:grid-cols-3">
          {/* How Built */}
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

          {/* Warnings */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              Warnings
            </p>
            <div className="space-y-1.5">
              {planReview.issues.length === 0 && (
                <p className="text-xs text-emerald-300/80">All clear — looks good to commit.</p>
              )}
              {planReview.issues.slice(0, 5).map((issue, idx) => (
                <div
                  key={`${issue.message}-${idx}`}
                  className="flex items-start gap-1.5"
                >
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

          {/* Suggested Fixes (actionable) */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
              Suggested Fixes
            </p>
            <div className="space-y-2">
              {planReview.fixes.length === 0 && (
                <p className="text-xs text-white/55">No fixes needed.</p>
              )}
              {planReview.fixes.slice(0, 4).map((fix) => (
                <div
                  key={fix.text}
                  className="flex items-start gap-2"
                >
                  <span className="text-xs text-sky-200/80 leading-relaxed flex-1">
                    {fix.text}
                  </span>
                  {onGoToPhase && (
                    <button
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
        </div>
      </div>

      {/* ── Day-by-day schedule ─────────────────────────────────────────── */}
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
                    {subject.items.map(({ dayIndex, session }) => (
                      <div
                        key={`${dayIndex}-${session.topic_id}-${session.session_number ?? 0}`}
                        className={`flex items-center justify-between rounded-xl px-2 py-1.5 border ${sessionTypeColor(session.session_type)}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs truncate">
                            {stripSubjectPrefix(session.title, subject.subjectLabel)}
                          </span>
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
                            onClick={() => removeSession(bucket.date, dayIndex)}
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
