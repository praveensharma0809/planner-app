"use client"

import { useMemo, useState } from "react"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
} from "@/lib/planner/draft"
import type {
  PlannerConstraintValues as ConstraintValues,
  PlannerParamValues as ParamValues,
  PlannerSubjectOption,
  PlannerTopicForParams as TopicForParams,
} from "@/lib/planner/draft"
import {
  PlannerFeasibilityBar,
  RiskDot,
  useDraftFeasibility,
} from "./planner-feasibility"

// UI-only multi-modal effort input state
type EffortMode = "time" | "days" | "lectures"
interface EffortDraft {
  mode: EffortMode
  raw_hours: number        // "time" mode
  raw_days: number         // "days" mode
  lecture_count: number    // "lectures" mode
  avg_lecture_min: number  // "lectures" mode
}

interface ParamsEditorProps {
  topics: TopicForParams[]
  initialParams: Map<string, ParamValues>
  constraints: ConstraintValues | null
  subjects?: PlannerSubjectOption[]
  onSave: (params: ParamValues[], subjectDeadlines?: Map<string, string>) => void
  isSaving: boolean
}

export type { ParamValues, TopicForParams }

// ── Constants ──────────────────────────────────────────────────────────────────
const SESSION_PRESETS = [30, 45, 60, 90, 120]

function clampSessionLength(minutes: number): number {
  return Math.min(
    MAX_SESSION_LENGTH_MINUTES,
    Math.max(MIN_SESSION_LENGTH_MINUTES, minutes || MIN_SESSION_LENGTH_MINUTES)
  )
}

function draftToHours(draft: EffortDraft): number {
  switch (draft.mode) {
    case "time":     return draft.raw_hours
    case "days":     return draft.raw_days * 2   // assume ≈2h/day
    case "lectures": return (draft.lecture_count * draft.avg_lecture_min) / 60
  }
}

function hoursToDisplay(h: number): string {
  if (!h || h <= 0) return "—"
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (mins === 0) return `${whole}h`
  if (whole === 0) return `${mins}m`
  return `${whole}h ${mins}m`
}

function minutesToDisplay(m: number): string {
  if (!m || m <= 0) return "—"
  const h = Math.floor(m / 60)
  const min = m % 60
  if (min === 0) return `${h}h`
  if (h === 0) return `${min}m`
  return `${h}h ${min}m`
}

// Shared input class strings
const dateInputCls =
  "w-full bg-transparent border-b-2 border-white/[0.08] hover:border-purple-400/30 focus:border-purple-400/60 focus:bg-white/[0.03] px-1.5 py-1 text-xs outline-none transition-all duration-200 text-white/70 [color-scheme:dark]"
const tinyNumInputCls =
  "bg-transparent border-b-2 border-white/[0.08] hover:border-pink-400/30 focus:border-pink-400/60 px-1 py-0.5 text-sm outline-none transition-all duration-200 placeholder:text-white/20 text-center [appearance:textfield]"

// ── Effort cell sub-component ─────────────────────────────────────────────────
function EffortCell({
  draft,
  onDraftChange,
}: {
  draft: EffortDraft
  onDraftChange: (d: EffortDraft) => void
}) {
  const modes: EffortMode[] = ["time", "days", "lectures"]
  const modeLabels: Record<EffortMode, string> = { time: "T", days: "D", lectures: "L" }
  const activeCls = "text-indigo-300 bg-indigo-500/15 border-indigo-500/40"
  const inactiveCls = "text-white/20 bg-transparent border-white/[0.06] hover:border-white/15 hover:text-white/40"
  const numCls =
    "bg-transparent border-b-2 border-white/[0.08] hover:border-indigo-400/30 focus:border-indigo-400/60 px-1 py-0.5 text-sm outline-none transition-all duration-200 placeholder:text-white/20 text-center [appearance:textfield]"

  const computedHours = draftToHours(draft)

  return (
    <div className="flex items-center gap-1.5 px-1 min-w-0">
      {/* Mode toggle: segmented [T|D|L] */}
      <div className="flex shrink-0">
        {modes.map((m, idx) => (
          <button
            key={m}
            type="button"
            onClick={() => onDraftChange({ ...draft, mode: m })}
            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-all duration-150
              ${draft.mode === m ? activeCls : inactiveCls}
              ${idx === 0 ? "rounded-l border-r-0" : ""}
              ${idx === 1 ? "border-r-0" : ""}
              ${idx === 2 ? "rounded-r" : ""}`}
            title={m === "time" ? "Total hours" : m === "days" ? "Study days (≈2h each)" : "Lectures: count × duration"}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Time mode */}
      {draft.mode === "time" && (
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" step="0.5"
            value={draft.raw_hours > 0 ? draft.raw_hours : ""}
            onChange={(e) => onDraftChange({ ...draft, raw_hours: parseFloat(e.target.value) || 0 })}
            placeholder="—"
            className={`w-12 ${numCls}`}
          />
          <span className="text-[10px] text-white/30 shrink-0">h</span>
        </div>
      )}

      {/* Days mode */}
      {draft.mode === "days" && (
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" step="1"
            value={draft.raw_days > 0 ? draft.raw_days : ""}
            onChange={(e) => onDraftChange({ ...draft, raw_days: parseInt(e.target.value) || 0 })}
            placeholder="—"
            className={`w-10 ${numCls}`}
          />
          <span className="text-[10px] text-white/30 shrink-0">d</span>
          {draft.raw_days > 0 && (
            <span className="text-[10px] text-white/20 shrink-0">
              ≈{hoursToDisplay(computedHours)}
            </span>
          )}
        </div>
      )}

      {/* Lectures mode */}
      {draft.mode === "lectures" && (
        <div className="flex items-center gap-0.5">
          <input
            type="number" min="0" step="1"
            value={draft.lecture_count > 0 ? draft.lecture_count : ""}
            onChange={(e) => onDraftChange({ ...draft, lecture_count: parseInt(e.target.value) || 0 })}
            placeholder="#"
            className={`w-9 ${numCls}`}
          />
          <span className="text-[10px] text-white/20">×</span>
          <input
            type="number" min={MIN_SESSION_LENGTH_MINUTES} max={MAX_SESSION_LENGTH_MINUTES} step="5"
            value={draft.avg_lecture_min > 0 ? draft.avg_lecture_min : ""}
            onChange={(e) => onDraftChange({ ...draft, avg_lecture_min: clampSessionLength(parseInt(e.target.value) || MIN_SESSION_LENGTH_MINUTES) })}
            placeholder="min"
            className={`w-10 ${numCls}`}
          />
          {draft.lecture_count > 0 && draft.avg_lecture_min > 0 && (
            <span className="text-[10px] text-white/20 shrink-0">
              ={hoursToDisplay(computedHours)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" />
    </svg>
  )
}

export default function ParamsEditor({
  topics,
  initialParams,
  constraints,
  subjects,
  onSave,
  isSaving,
}: ParamsEditorProps) {
  const [params, setParams] = useState<Map<string, ParamValues>>(() => {
    const map = new Map(initialParams)
    for (const t of topics) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          topic_id: t.id,
          estimated_hours: 0,
          priority: 3,
          deadline: "",
          earliest_start: "",
          depends_on: [],
          session_length_minutes: 60,
          rest_after_days: 0,
          max_sessions_per_day: 0,
          study_frequency: "daily",
          tier: 0,
        })
      }
    }
    return map
  })

  // UI-only effort draft per topic (multi-modal)
  const [efforts, setEfforts] = useState<Map<string, EffortDraft>>(() => {
    const m = new Map<string, EffortDraft>()
    for (const t of topics) {
      const p = initialParams.get(t.id)
      m.set(t.id, {
        mode: "time",
        raw_hours: p?.estimated_hours ?? 0,
        raw_days: 0,
        lecture_count: 0,
        avg_lecture_min: 45,
      })
    }
    return m
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Subject lookup by name for deadline access
  const subjectByName = useMemo(() => {
    const m = new Map<string, PlannerSubjectOption>()
    for (const s of subjects ?? []) m.set(s.name, s)
    return m
  }, [subjects])

  // Subject-level deadline overrides (keyed by subject id)
  const [subjectDeadlines, setSubjectDeadlines] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const s of subjects ?? []) {
      if (s.deadline) m.set(s.id, s.deadline)
    }
    return m
  })

  // Group topics by subject, preserving insertion order
  const bySubject = useMemo(() => {
    const map = new Map<string, TopicForParams[]>()
    for (const t of topics) {
      if (!map.has(t.subject_name)) map.set(t.subject_name, [])
      map.get(t.subject_name)!.push(t)
    }
    return map
  }, [topics])

  // Live stats
  const configuredCount = useMemo(
    () => topics.filter((t) => (params.get(t.id)?.estimated_hours ?? 0) > 0).length,
    [topics, params]
  )
  const totalHours = useMemo(
    () => Array.from(params.values()).reduce((sum, p) => sum + p.estimated_hours, 0),
    [params]
  )
  const allParams = useMemo(() => Array.from(params.values()), [params])
  const { feasibility: liveFeasibility, loading: liveFeasibilityLoading } = useDraftFeasibility(
    allParams,
    constraints,
    Boolean(constraints)
  )
  const unitStatusMap = useMemo(
    () => new Map((liveFeasibility?.units ?? []).map((unit) => [unit.unitId, unit.status])),
    [liveFeasibility]
  )

  const update = (topicId: string, field: keyof ParamValues, value: unknown) => {
    setParams((prev) => {
      const next = new Map(prev)
      const cur = next.get(topicId)
      if (cur) next.set(topicId, { ...cur, [field]: value })
      return next
    })
  }

  const updateEffort = (topicId: string, draft: EffortDraft) => {
    setEfforts((prev) => { const next = new Map(prev); next.set(topicId, draft); return next })
    const hours = draftToHours(draft)
    update(topicId, "estimated_hours", hours)
    // Auto-set session length to lecture duration when in lectures mode
    if (draft.mode === "lectures" && draft.avg_lecture_min > 0) {
      update(topicId, "session_length_minutes", clampSessionLength(draft.avg_lecture_min))
    }
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDependency = (topicId: string, depId: string) => {
    const cur = params.get(topicId)
    if (!cur) return
    const next = cur.depends_on.includes(depId)
      ? cur.depends_on.filter((d) => d !== depId)
      : [...cur.depends_on, depId]
    update(topicId, "depends_on", next)
  }

  const canProceed = configuredCount > 0
  const handleSave = () => {
    onSave(allParams, subjectDeadlines)
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (topics.length === 0) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <div className="flex items-end justify-between pb-3 border-b border-white/[0.08]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
                <p className="text-[10px] text-purple-400/80 uppercase tracking-widest font-semibold">Phase 2</p>
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                Topic Parameters
              </h2>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/30">
              <path d="M9 3v6l4 2" /><circle cx="9" cy="9" r="7" />
            </svg>
          </div>
          <p className="text-sm text-white/50">No topics found from Phase 1.</p>
          <p className="text-xs text-white/30">Go back and add subjects with at least one topic.</p>
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  const subjectEntries = Array.from(bySubject.entries())

  return (
    <div className="space-y-4">
      {/* Header — mirrors Phase 1 style */}
      <div className="relative">
        <div className="flex items-end justify-between pb-3 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
              <p className="text-[10px] text-purple-400/80 uppercase tracking-widest font-semibold">Phase 2</p>
            </div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Topic Parameters
            </h2>
            <p className="text-xs text-white/40 font-light">Set effort and session length per topic</p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-300 font-medium">
              {configuredCount}/{topics.length} configured
            </span>
            {totalHours > 0 && (
              <span className="px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 rounded-md text-pink-300 font-medium">
                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hrs total
              </span>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
      </div>

      <PlannerFeasibilityBar
        feasibility={liveFeasibility}
        loading={liveFeasibilityLoading}
      />
      {!constraints && configuredCount > 0 && (
        <p className="text-[11px] text-white/30 px-1">
          Load or save phase 3 constraints to see live risk dots for each topic.
        </p>
      )}

      {/* Effort-mode legend + dependency hint */}
      <div className="flex items-center justify-between gap-4 text-[10px] text-white/25 px-1">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white/35">Effort mode:</span>
          <span><span className="text-indigo-400/70 font-bold">T</span> = hours</span>
          <span><span className="text-indigo-400/70 font-bold">D</span> = days (≈2h each)</span>
          <span><span className="text-indigo-400/70 font-bold">L</span> = lectures × duration</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-white/30">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400/50">
            <path d="M4.5 2.5L8 6l-3.5 3.5" />
          </svg>
          <span className="text-[10px] text-white/30">Expand row for session length, frequency, rest days &amp; <span className="text-indigo-400/60 font-semibold">dependencies</span></span>
        </div>
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.01] shadow-lg shadow-black/5 overflow-hidden backdrop-blur-sm">

        {/* Column headers */}
        <div className="grid items-center border-b border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-white/[0.03] to-white/[0.02] px-4 py-2"
            style={{ gridTemplateColumns: "1fr 220px 120px 28px" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Topic</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Effort</span>
            <span className="text-red-400/60 text-[10px]">*</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Deadline</span>
          </div>
          <div />
        </div>

        {/* Subject groups */}
        <div>
          {subjectEntries.map(([subject, subjectTopics], si) => (
            <div key={subject}>
              {/* Subject separator line */}
              {si > 0 && (
                <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              )}

              {/* Subject group label */}
              <div className="px-4 py-2 bg-gradient-to-r from-purple-500/[0.05] to-transparent border-b border-white/[0.04] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-purple-400/60 uppercase tracking-widest font-semibold">
                    {subject}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {subjectTopics.length} {subjectTopics.length === 1 ? "topic" : "topics"}
                  </span>
                </div>
                {(() => {
                  const subjectOption = subjectByName.get(subject)
                  if (!subjectOption) return null
                  const sid = subjectOption.id
                  return (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-purple-400/40 uppercase tracking-wider">Subject deadline</span>
                      <input
                        type="date"
                        value={subjectDeadlines.get(sid) ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                          setSubjectDeadlines((prev) => {
                            const next = new Map(prev)
                            if (val) next.set(sid, val)
                            else next.delete(sid)
                            return next
                          })
                        }}
                        className="bg-transparent border-b border-white/[0.08] hover:border-purple-400/30 focus:border-purple-400/60 px-1 py-0.5 text-[10px] text-white/50 outline-none transition-all duration-200 w-28 [color-scheme:dark]"
                      />
                    </div>
                  )
                })()}
              </div>

              {/* Topic rows */}
              {subjectTopics.map((t) => {
                const p = params.get(t.id)!
                const draft = efforts.get(t.id) ?? { mode: "time" as EffortMode, raw_hours: 0, raw_days: 0, lecture_count: 0, avg_lecture_min: 45 }
                const isExpanded = expanded.has(t.id)
                const configured = p.estimated_hours > 0
                const feasibilityStatus = unitStatusMap.get(t.id)
                const depOptions = topics.filter(
                  (ot) => ot.id !== t.id && !p.depends_on.includes(ot.id)
                )

                return (
                  <div key={t.id} className="group border-b border-white/[0.03] last:border-b-0">

                    {/* ── Main row ── */}
                    <div
                      className="grid items-center px-4 py-2 hover:bg-gradient-to-r hover:from-white/[0.02] hover:to-transparent transition-all duration-200 cursor-default"
                      style={{ gridTemplateColumns: "1fr 220px 120px 28px" }}
                    >
                      {/* Topic name + completion dot */}
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <RiskDot status={feasibilityStatus} configured={configured} />
                        <span className="text-sm text-white/80 truncate font-medium">
                          {t.topic_name}
                        </span>
                        {feasibilityStatus && (
                          <span className="shrink-0 text-[9px] text-white/45 bg-white/[0.04] border border-white/[0.06] rounded px-1 py-0.5 uppercase tracking-wide">
                            {feasibilityStatus === "at_risk" ? "risk" : feasibilityStatus}
                          </span>
                        )}
                        {p.depends_on.length > 0 && (
                          <span className="shrink-0 text-[9px] text-indigo-400/60 bg-indigo-500/10 border border-indigo-500/20 rounded px-1 py-0.5">
                            dep
                          </span>
                        )}
                      </div>

                      {/* Effort cell – multi-modal input */}
                      <EffortCell
                        draft={draft}
                        onDraftChange={(d) => updateEffort(t.id, d)}
                      />

                      {/* Deadline */}
                      <div className="px-1">
                        <input
                          type="date"
                          value={p.deadline}
                          onChange={(e) => update(t.id, "deadline", e.target.value)}
                          className={dateInputCls}
                          style={{ colorScheme: "dark" }}
                        />
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpanded(t.id)}
                        className={`flex items-center justify-center w-6 h-6 rounded transition-all duration-200 shrink-0 ${
                          isExpanded
                            ? "text-purple-400/60 bg-purple-500/10"
                            : "text-white/20 hover:text-white/50 hover:bg-white/[0.05]"
                        }`}
                        title="Session length, earliest start, dependencies"
                      >
                        <Chevron open={isExpanded} />
                      </button>
                    </div>

                    {/* ── Expanded optional fields ── */}
                    {isExpanded && (
                      <div className="px-4 pb-3 bg-gradient-to-b from-white/[0.01] to-transparent">
                        <div className="ml-3.5 pl-4 pt-2.5 pb-1 border-l border-white/[0.06] space-y-3">

                          {/* Row 1: Session length + Earliest start */}
                          <div className="grid grid-cols-2 gap-4">

                            {/* Session length */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium flex items-center gap-1.5">
                                Session Length
                                {draft.mode === "lectures" && draft.avg_lecture_min > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => update(t.id, "session_length_minutes", clampSessionLength(draft.avg_lecture_min))}
                                    className="text-[9px] text-sky-400/70 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5 hover:bg-sky-500/15 transition-colors"
                                  >
                                    = 1 lecture ({draft.avg_lecture_min}m)
                                  </button>
                                )}
                              </label>
                              <div className="flex flex-wrap items-center gap-1">
                                {SESSION_PRESETS.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => update(t.id, "session_length_minutes", opt)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                                      p.session_length_minutes === opt
                                        ? "text-sky-300 bg-sky-500/15 border-sky-500/40"
                                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                                    }`}
                                  >
                                    {opt}m
                                  </button>
                                ))}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={MIN_SESSION_LENGTH_MINUTES}
                                    max={MAX_SESSION_LENGTH_MINUTES}
                                    step="5"
                                    value={!SESSION_PRESETS.includes(p.session_length_minutes) && p.session_length_minutes > 0 ? p.session_length_minutes : ""}
                                    onChange={(e) => update(t.id, "session_length_minutes", clampSessionLength(parseInt(e.target.value) || 60))}
                                    placeholder="other"
                                    className={`w-14 ${tinyNumInputCls}`}
                                  />
                                  <span className="text-[10px] text-white/20">m</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-white/20">
                                {p.estimated_hours > 0 && p.session_length_minutes > 0
                                  ? `≈ ${Math.ceil((p.estimated_hours * 60) / p.session_length_minutes)} sessions of ${minutesToDisplay(p.session_length_minutes)}`
                                  : "Set effort above to see session count"}
                              </p>
                            </div>

                            {/* Earliest start */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Earliest Start</label>
                              <input
                                type="date"
                                value={p.earliest_start}
                                onChange={(e) => update(t.id, "earliest_start", e.target.value)}
                                className={dateInputCls}
                              />
                              <p className="text-[10px] text-white/20">Scheduler won&apos;t place sessions before this date</p>
                            </div>
                          </div>

                          {/* Dependencies */}
                          {topics.length > 1 && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Depends On</label>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {p.depends_on.length === 0 && depOptions.length === 0 && (
                                  <span className="text-[11px] text-white/20">No other topics available</span>
                                )}
                                {p.depends_on.map((depId) => {
                                  const dep = topics.find((ot) => ot.id === depId)
                                  if (!dep) return null
                                  return (
                                    <span
                                      key={depId}
                                      className="flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 rounded-md px-2 py-0.5"
                                    >
                                      <span className="text-indigo-400/60 text-[9px]">✓</span>
                                      {dep.topic_name}
                                      <button
                                        onClick={() => toggleDependency(t.id, depId)}
                                        className="text-indigo-400/50 hover:text-red-400 ml-0.5 leading-none transition-colors"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  )
                                })}
                                {depOptions.length > 0 && (
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) toggleDependency(t.id, e.target.value)
                                    }}
                                    className="text-[11px] bg-white/[0.03] border border-white/[0.10] hover:border-white/20 rounded-md px-2 py-0.5 outline-none text-white/40 cursor-pointer transition-colors [color-scheme:dark]"
                                  >
                                    <option value="">+ Add dependency</option>
                                    {depOptions.map((ot) => (
                                      <option key={ot.id} value={ot.id}>
                                        {ot.subject_name !== t.subject_name
                                          ? `${ot.subject_name}: ${ot.topic_name}`
                                          : ot.topic_name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Row 3: v2 scheduling hints */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {/* Study Frequency */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Study Frequency</label>
                              <div className="flex gap-1">
                                {(["daily", "spaced"] as const).map((freq) => {
                                  const labels: Record<string, string> = { daily: "Daily", spaced: "Spaced" }
                                  return (
                                    <button
                                      key={freq}
                                      type="button"
                                      onClick={() => update(t.id, "study_frequency", freq)}
                                      className={`flex-1 text-[10px] font-semibold py-0.5 rounded border transition-all duration-150 ${
                                        p.study_frequency === freq
                                          ? "text-teal-300 bg-teal-500/15 border-teal-500/40"
                                          : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                                      }`}
                                    >
                                      {labels[freq]}
                                    </button>
                                  )
                                })}
                              </div>
                              <p className="text-[10px] text-white/20">
                                {p.study_frequency === "spaced"
                                  ? "At least one full day gap between sessions"
                                  : "Study every available day"}
                              </p>
                            </div>

                            {/* Rest After Days */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Rest After (days)</label>
                              <div className="flex items-center gap-1.5">
                                {[0, 1, 2, 3].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => update(t.id, "rest_after_days", v)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                                      p.rest_after_days === v
                                        ? "text-orange-300 bg-orange-500/15 border-orange-500/40"
                                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                                    }`}
                                  >
                                    {v === 0 ? "None" : `${v}d`}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-white/20">Gap after completing this topic</p>
                            </div>

                            {/* Max Sessions Per Day */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Max Sessions/Day</label>
                              <div className="flex items-center gap-1.5">
                                {[0, 1, 2, 3].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => update(t.id, "max_sessions_per_day", v)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                                      p.max_sessions_per_day === v
                                        ? "text-cyan-300 bg-cyan-500/15 border-cyan-500/40"
                                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                                    }`}
                                  >
                                    {v === 0 ? "∞" : `${v}`}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-white/20">{p.max_sessions_per_day === 0 ? "No limit per day" : `Max ${p.max_sessions_per_day} session${p.max_sessions_per_day > 1 ? "s" : ""}/day`}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-[11px] text-white/30">
          {canProceed
            ? `${configuredCount} topic${configuredCount !== 1 ? "s" : ""} · ${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hrs total`
            : "Set effort for at least one topic to continue"}
        </div>
        <button
          onClick={handleSave}
          disabled={!canProceed || isSaving}
          className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-white/10 disabled:to-white/10 text-white disabled:text-white/40 text-sm font-semibold px-6 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 disabled:shadow-none disabled:cursor-not-allowed"
        >
          <span className="relative z-10">{isSaving ? "Saving..." : "Save & Continue →"}</span>
          {canProceed && !isSaving && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
          )}
        </button>
      </div>
    </div>
  )
}
