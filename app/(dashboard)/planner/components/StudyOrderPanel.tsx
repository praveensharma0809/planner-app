"use client"

import { useEffect, useRef, useState } from "react"
import { reorderSubjects, reorderTopics } from "@/app/actions/planner/setup"
import type {
  PlannerConstraintValues as ConstraintValues,
  PlannerSubjectOption,
} from "@/lib/planner/draft"
import type { TopicOrderingMode } from "@/lib/planner/engine"

interface StudyOrderPanelProps {
  subjects: PlannerSubjectOption[]
  config: ConstraintValues
  onChange: (next: ConstraintValues) => void
}

const MODE_OPTIONS: Array<{
  value: TopicOrderingMode
  label: string
  brief: string
}> = [
  { value: "sequential", label: "Sequential", brief: "Finish one topic before the next" },
  {
    value: "flexible_sequential",
    label: "Flexible",
    brief: "Unlock the next topic once current progress is high",
  },
  { value: "parallel", label: "Parallel", brief: "Multiple topics can run together" },
]

function buildTopicOrders(subjects: PlannerSubjectOption[]) {
  const map = new Map<string, Array<{ id: string; name: string }>>()
  for (const subject of subjects) {
    if (subject.topics) {
      map.set(subject.id, [...subject.topics])
    }
  }
  return map
}

// Drag-handle icon
function DragHandle() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      className="text-white/20 group-hover:text-white/40 transition-colors shrink-0"
    >
      <rect x="2" y="2" width="2" height="2" rx="0.5" />
      <rect x="8" y="2" width="2" height="2" rx="0.5" />
      <rect x="2" y="5" width="2" height="2" rx="0.5" />
      <rect x="8" y="5" width="2" height="2" rx="0.5" />
      <rect x="2" y="8" width="2" height="2" rx="0.5" />
      <rect x="8" y="8" width="2" height="2" rx="0.5" />
    </svg>
  )
}

export default function StudyOrderPanel({
  subjects,
  config,
  onChange,
}: StudyOrderPanelProps) {
  const [subjectOrder, setSubjectOrder] = useState<PlannerSubjectOption[]>(subjects)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    subjects[0]?.id ?? null
  )

  // Per-subject local topic order: subjectId → topic list
  const [topicOrders, setTopicOrders] = useState<Map<string, Array<{ id: string; name: string }>>>(
    () => buildTopicOrders(subjects)
  )

  // Drag state
  const dragSubjectIdx = useRef<number | null>(null)
  const dragTopicIdx = useRef<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubjectOrder(subjects)
    setTopicOrders(buildTopicOrders(subjects))
    setSelectedSubjectId((current) => {
      if (current && subjects.some((subject) => subject.id === current)) {
        return current
      }
      return subjects[0]?.id ?? null
    })
  }, [subjects])

  if (subjects.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-white/35">
        Add subjects in Phase 1 to configure study order.
      </div>
    )
  }

  const selectedSubject = subjectOrder.find((s) => s.id === selectedSubjectId) ?? subjectOrder[0]
  const selectedTopics = topicOrders.get(selectedSubject?.id ?? "") ?? []
  const selectedMode = config.subject_ordering[selectedSubject?.id ?? ""] ?? "sequential"

  // ── Subject drag handlers ─────────────────────────────────────────────────
  const onSubjectDragStart = (idx: number) => {
    dragSubjectIdx.current = idx
  }
  const onSubjectDragEnd = () => {
    dragSubjectIdx.current = null
  }
  const onSubjectDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    const from = dragSubjectIdx.current
    if (from == null || from === idx) return
    const next = [...subjectOrder]
    const [item] = next.splice(from, 1)
    next.splice(idx, 0, item)
    dragSubjectIdx.current = idx
    setSubjectOrder(next)
  }
  const onSubjectDrop = async () => {
    dragSubjectIdx.current = null
    const updates = subjectOrder.map((s, i) => ({ id: s.id, sort_order: i }))
    try {
      await reorderSubjects(updates)
    } catch {
      // Keep local order even if persistence fails; user can retry by dragging again.
    }
  }

  // ── Topic drag handlers ───────────────────────────────────────────────────
  const onTopicDragStart = (idx: number) => {
    dragTopicIdx.current = idx
  }
  const onTopicDragEnd = () => {
    dragTopicIdx.current = null
  }
  const onTopicDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    const from = dragTopicIdx.current
    if (from == null || from === idx || !selectedSubject) return
    const cur = topicOrders.get(selectedSubject.id) ?? []
    const next = [...cur]
    const [item] = next.splice(from, 1)
    next.splice(idx, 0, item)
    dragTopicIdx.current = idx
    setTopicOrders((prev) => new Map(prev).set(selectedSubject.id, next))
  }
  const onTopicDrop = async () => {
    dragTopicIdx.current = null
    if (!selectedSubject) return
    const topics = topicOrders.get(selectedSubject.id) ?? []
    const updates = topics.map((t, i) => ({ id: t.id, sort_order: i }))
    try {
      await reorderTopics(updates)
    } catch {
      // Keep local order even if persistence fails; user can retry by dragging again.
    }
  }

  const setMode = (mode: TopicOrderingMode) => {
    if (!selectedSubject) return
    onChange({
      ...config,
      subject_ordering: { ...config.subject_ordering, [selectedSubject.id]: mode },
    })
  }

  const setParallelBreadth = (topicsPerDay: number) => {
    onChange({
      ...config,
      max_topics_per_subject_per_day: topicsPerDay,
    })
  }

  const sideBySideEnabled = config.max_topics_per_subject_per_day > 1

  return (
    <div className="px-4 py-3 space-y-3">
      <p className="text-[11px] text-white/30 leading-relaxed">
        1) Drag subjects. 2) Drag topics inside a subject. 3) Choose how topic unlock works.
      </p>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
            Side-by-side Topics (per subject/day)
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setParallelBreadth(count)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all ${
                  config.max_topics_per_subject_per_day === count
                    ? "text-emerald-200 bg-emerald-500/15 border-emerald-500/40"
                    : "text-white/30 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/55"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-white/25">
          Use 2 or more to study multiple topics in parallel for the same subject. Works best with
          Flexible or Parallel mode.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* ── Left: Subject order ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-white/[0.05] bg-white/[0.02]">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
              Subject Order
            </span>
            <span className="ml-2 text-[9px] text-white/20">drag to reorder</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {subjectOrder.map((subject, idx) => (
              <div
                key={subject.id}
                draggable
                onDragStart={() => onSubjectDragStart(idx)}
                onDragEnd={onSubjectDragEnd}
                onDragOver={(e) => onSubjectDragOver(e, idx)}
                onDrop={onSubjectDrop}
                onClick={() => setSelectedSubjectId(subject.id)}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-150 ${
                  selectedSubjectId === subject.id
                    ? "bg-sky-500/10 border-l-2 border-sky-500/60"
                    : "hover:bg-white/[0.03] border-l-2 border-transparent"
                }`}
              >
                <span className="cursor-grab active:cursor-grabbing">
                  <DragHandle />
                </span>
                <span
                  className={`text-xs font-medium flex-1 truncate ${
                    selectedSubjectId === subject.id ? "text-sky-200" : "text-white/70"
                  }`}
                >
                  {subject.name}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                    (config.subject_ordering[subject.id] ?? "sequential") === "parallel"
                      ? "text-emerald-300 bg-emerald-500/15"
                      : (config.subject_ordering[subject.id] ?? "sequential") === "flexible_sequential"
                      ? "text-fuchsia-300 bg-fuchsia-500/15"
                      : "text-white/25 bg-white/[0.04]"
                  }`}
                >
                  {(config.subject_ordering[subject.id] ?? "seq").replace(
                    /flexible_sequential/,
                    "flex"
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Topics for selected subject ──────────────────────────── */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                {selectedSubject?.name ?? "Topics"}
              </span>
              <span className="ml-2 text-[9px] text-white/20">drag to reorder</span>
            </div>
            {/* Mode pills inline */}
            <div className="flex items-center gap-1">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  title={opt.brief}
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-all duration-150 ${
                    selectedMode === opt.value
                      ? opt.value === "parallel"
                        ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/40"
                        : opt.value === "flexible_sequential"
                        ? "text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/40"
                        : "text-sky-300 bg-sky-500/15 border-sky-500/40"
                      : "text-white/20 bg-transparent border-white/[0.06] hover:border-white/15 hover:text-white/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode description */}
          <div className="px-3 py-1 bg-white/[0.01] border-b border-white/[0.03]">
            <span className="text-[10px] text-white/30">
              {MODE_OPTIONS.find((o) => o.value === selectedMode)?.brief ?? ""}
              {selectedMode === "flexible_sequential" && (
                <span className="ml-1 text-fuchsia-300/50">
                  — internal unlock adapts between 60% and 80%
                </span>
              )}
              {selectedMode !== "sequential" && (
                <span className="ml-1 text-emerald-300/50">
                  {sideBySideEnabled
                    ? `· up to ${config.max_topics_per_subject_per_day} topics/day`
                    : "· set side-by-side to 2+ for parallel coverage"}
                </span>
              )}
            </span>
          </div>

          {/* Topic list */}
          <div
            className={`flex-1 divide-y divide-white/[0.04] ${
              selectedMode === "parallel" ? "p-2" : ""
            }`}
          >
            {selectedTopics.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-white/25">
                No topics found for this subject.
              </div>
            )}

            {selectedMode === "parallel" ? (
              // Parallel: chip grid – drag still works for visual order
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic, idx) => (
                  <div
                    key={topic.id}
                    draggable
                    onDragStart={() => onTopicDragStart(idx)}
                    onDragEnd={onTopicDragEnd}
                    onDragOver={(e) => onTopicDragOver(e, idx)}
                    onDrop={onTopicDrop}
                    className="group flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/08 hover:border-emerald-500/40 cursor-grab active:cursor-grabbing transition-all"
                  >
                    <DragHandle />
                    <span className="text-[11px] text-emerald-200/80 font-medium">{topic.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              // Sequential / Flexible: vertical list
              selectedTopics.map((topic, idx) => (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => onTopicDragStart(idx)}
                  onDragEnd={onTopicDragEnd}
                  onDragOver={(e) => onTopicDragOver(e, idx)}
                  onDrop={onTopicDrop}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] cursor-grab active:cursor-grabbing transition-all"
                >
                  <span className="text-[10px] text-white/15 font-mono w-4 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="cursor-grab active:cursor-grabbing">
                    <DragHandle />
                  </span>
                  <span className="text-xs text-white/65 flex-1 truncate">{topic.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
