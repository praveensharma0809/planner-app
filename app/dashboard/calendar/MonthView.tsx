"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import type { Task } from "@/lib/types/db"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"

interface Subject {
  id: string
  name: string
}

interface Props {
  tasks: Task[]
  subjects: Subject[]
  year: number
  month: number
  today: string
  prevMonth: string
  nextMonth: string
  isCurrentMonth: boolean
}

const SUBJECT_COLORS = [
  { dot: "bg-blue-400", badge: "bg-blue-500/20 border border-blue-500/40 text-blue-300" },
  { dot: "bg-violet-400", badge: "bg-violet-500/20 border border-violet-500/40 text-violet-300" },
  { dot: "bg-emerald-400", badge: "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" },
  { dot: "bg-orange-400", badge: "bg-orange-500/20 border border-orange-500/40 text-orange-300" },
  { dot: "bg-pink-400", badge: "bg-pink-500/20 border border-pink-500/40 text-pink-300" },
  { dot: "bg-cyan-400", badge: "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300" },
  { dot: "bg-amber-400", badge: "bg-amber-500/20 border border-amber-500/40 text-amber-300" },
  { dot: "bg-rose-400", badge: "bg-rose-500/20 border border-rose-500/40 text-rose-300" },
]

const SESSION_LABEL: Record<string, string> = {
  core: "Core",
  revision: "Revision",
  practice: "Practice",
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatFullDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatDayName(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })
}

export function MonthView({
  tasks,
  subjects,
  year,
  month,
  today,
  prevMonth,
  nextMonth,
  isCurrentMonth,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completedLocal, setCompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletedLocal, setUncompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  // Build subject -> color map (deterministic by sort order)
  const subjectColorMap = new Map<string, (typeof SUBJECT_COLORS)[0]>()
  subjects.forEach((s, i) => {
    subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length])
  })

  const getColor = (subjectId: string) =>
    subjectColorMap.get(subjectId) ?? SUBJECT_COLORS[3]

  const getSubjectName = (subjectId: string) =>
    subjects.find((s) => s.id === subjectId)?.name ?? "Custom"

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7

  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = tasksByDate.get(task.scheduled_date) ?? []
    list.push(task)
    tasksByDate.set(task.scheduled_date, list)
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setSelectedDay(null)
  }, [])

  useEffect(() => {
    if (selectedDay) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedDay, handleKeyDown])

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId)
    try {
      await completeTask(taskId)
      setCompletedLocal((prev) => new Set(prev).add(taskId))
      setUncompletedLocal((prev) => { const n = new Set(prev); n.delete(taskId); return n })
    } catch { /* silent */ } finally {
      setCompletingId(null)
    }
  }

  const handleUncomplete = async (taskId: string) => {
    setUncompletingId(taskId)
    try {
      await uncompleteTask(taskId)
      setUncompletedLocal((prev) => new Set(prev).add(taskId))
      setCompletedLocal((prev) => { const n = new Set(prev); n.delete(taskId); return n })
    } catch { /* silent */ } finally {
      setUncompletingId(null)
    }
  }

  const handleReschedule = async (taskId: string, newDate: string) => {
    if (!newDate || newDate < today) return
    setMovingId(taskId)
    try {
      const result = await rescheduleTask(taskId, newDate)
      if (result.status === "SUCCESS") window.location.reload()
    } finally {
      setMovingId(null)
    }
  }

  const selectedTasks = selectedDay ? (tasksByDate.get(selectedDay) ?? []) : []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Timeline</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Schedule Calendar</h1>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2">
          <Link
            href={`/dashboard/calendar?month=${prevMonth}`}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/50 hover:text-white"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-white min-w-[148px] text-center px-1">
            {monthLabel}
          </span>
          <Link
            href={`/dashboard/calendar?month=${nextMonth}`}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/50 hover:text-white"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-slate-700/50 overflow-hidden">
        {/* Day-of-week header row */}
        <div className="grid grid-cols-7 bg-slate-900/70 border-b border-slate-700/50">
          {WEEK_DAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-bold py-3 tracking-widest uppercase ${
                i === 6 ? "text-red-400/80" : "text-white/40"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 bg-slate-900/20">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[90px] sm:min-h-[120px] border-r border-b border-slate-700/25"
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            const dayTasks = tasksByDate.get(dateStr) ?? []
            const isToday = dateStr === today
            const isPast = dateStr < today
            const col = (firstDayOfWeek + i) % 7
            const isSunday = col === 6

            const studyMin = dayTasks
              .filter((t) => t.is_plan_generated)
              .reduce((s, t) => s + t.duration_minutes, 0)
            const studyHrs = studyMin / 60

            const previewTasks = dayTasks.slice(0, 4)
            const overflowCount = Math.max(0, dayTasks.length - 4)

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dateStr)}
                aria-label={`${monthLabel.split(" ")[0]} ${dayNum}${dayTasks.length > 0 ? `, ${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""}` : ""}`}
                className={[
                  "min-h-[90px] sm:min-h-[120px] p-2 text-left transition-colors duration-150",
                  "border-r border-b border-slate-700/25",
                  "cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500/60",
                  isSunday
                    ? "bg-slate-900/50 hover:bg-slate-800/50"
                    : isToday
                    ? "bg-indigo-950/50 hover:bg-indigo-950/70"
                    : "hover:bg-slate-800/40",
                ].join(" ")}
              >
                {/* Date + study badge */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={[
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full leading-none",
                      isToday
                        ? "bg-indigo-500 text-white"
                        : isSunday
                        ? "text-red-400/80"
                        : isPast
                        ? "text-white/30"
                        : "text-white/55",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>
                  {studyHrs > 0 && (
                    <span className="hidden sm:inline-block text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5 leading-none">
                      {studyHrs % 1 === 0 ? studyHrs.toFixed(0) : studyHrs.toFixed(1)}h
                    </span>
                  )}
                </div>

                {/* Task previews or Sunday rest icon */}
                {dayTasks.length === 0 && isSunday ? (
                  <div className="text-base opacity-20 text-center mt-3">?</div>
                ) : (
                  <div className="space-y-[3px]">
                    {previewTasks.map((task) => {
                      const isDone =
                        (task.completed || completedLocal.has(task.id)) &&
                        !uncompletedLocal.has(task.id)
                      const color = getColor(task.subject_id)
                      return (
                        <div key={task.id} className="flex items-center gap-1">
                          <span
                            className={`w-[5px] h-[5px] rounded-full shrink-0 ${color.dot} ${isDone ? "opacity-30" : ""}`}
                          />
                          <span
                            className={`text-[10px] leading-tight truncate ${
                              isDone ? "text-white/25 line-through" : "text-white/65"
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                      )
                    })}
                    {overflowCount > 0 && (
                      <p className="text-[10px] text-white/30 pl-2.5">+{overflowCount} more</p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Subject colour legend */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s, i) => {
            const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
            return (
              <span key={s.id} className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${color.badge}`}>
                {s.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedDay(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Tasks for ${formatFullDate(selectedDay)}`}
        >
          <div
            className="w-full max-w-lg bg-[#0d1117] border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-700/50 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">{formatDayName(selectedDay)}</h2>
                <p className="text-sm text-white/45 mt-0.5">{formatFullDate(selectedDay)}</p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors text-white/50 hover:text-white shrink-0 mt-0.5"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal task list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {selectedTasks.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">?</div>
                  <p className="text-white/40 text-sm">No tasks scheduled for this day.</p>
                  <p className="text-white/25 text-xs mt-1">Enjoy the free time!</p>
                </div>
              ) : (
                selectedTasks.map((task) => {
                  const isDone =
                    (task.completed || completedLocal.has(task.id)) &&
                    !uncompletedLocal.has(task.id)
                  const isCompleting = completingId === task.id
                  const isUncompleting = uncompletingId === task.id
                  const isMissed = !isDone && selectedDay < today
                  const color = getColor(task.subject_id)
                  const subjectName = getSubjectName(task.subject_id)

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl p-3.5 border transition-all ${
                        isDone
                          ? "bg-white/[0.02] border-white/[0.05] opacity-55"
                          : "bg-slate-800/50 border-slate-700/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Completion toggle */}
                        {isDone ? (
                          <button
                            onClick={() => handleUncomplete(task.id)}
                            disabled={isUncompleting}
                            className="w-5 h-5 shrink-0 mt-0.5 rounded border-2 border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center disabled:opacity-40"
                            title="Undo complete"
                            aria-label="Undo complete"
                          >
                            <svg
                              className="w-3 h-3 text-emerald-400"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleComplete(task.id)}
                            disabled={isCompleting}
                            className="w-5 h-5 shrink-0 mt-0.5 rounded border-2 border-white/30 hover:border-emerald-400 transition-colors disabled:opacity-40"
                            aria-label="Mark complete"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Subject badge + session type */}
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color.badge}`}>
                              {subjectName}
                            </span>
                            <span className="text-[10px] text-white/30 uppercase tracking-wide font-medium">
                              {SESSION_LABEL[task.session_type] ?? task.session_type}
                            </span>
                          </div>

                          {/* Task title */}
                          <p
                            className={`text-sm font-medium leading-snug ${
                              isDone ? "line-through text-white/35" : "text-white/90"
                            }`}
                          >
                            {task.title}
                          </p>

                          {/* Duration + missed */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-white/40 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                              </svg>
                              {task.duration_minutes} min
                            </span>
                            {isMissed && (
                              <span className="text-[10px] font-semibold text-red-400">Missed</span>
                            )}
                          </div>

                          {/* Reschedule picker */}
                          <div className="mt-2 flex items-center gap-2">
                            <svg className="w-3 h-3 text-white/25 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <input
                              type="date"
                              min={today}
                              defaultValue={task.scheduled_date}
                              onChange={(e) => handleReschedule(task.id, e.target.value)}
                              disabled={movingId === task.id}
                              className="text-[11px] bg-slate-700/40 border border-slate-600/50 rounded-lg px-2 py-0.5 text-white/55 disabled:opacity-40 cursor-pointer hover:border-slate-500/70 transition-colors"
                              aria-label="Reschedule task"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
