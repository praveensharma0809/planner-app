"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import type { Task } from "@/lib/types/db"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import { Badge, Modal } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"

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
  { dot: "bg-blue-400",    badge: "primary"  },
  { dot: "bg-violet-400",  badge: "accent"   },
  { dot: "bg-emerald-400", badge: "success"  },
  { dot: "bg-orange-400",  badge: "warning"  },
  { dot: "bg-pink-400",    badge: "danger"   },
  { dot: "bg-cyan-400",    badge: "primary"  },
  { dot: "bg-amber-400",   badge: "warning"  },
  { dot: "bg-rose-400",    badge: "danger"   },
] as const

type SubjectBadgeVariant = "primary" | "accent" | "success" | "warning" | "danger"

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
}: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completedLocal, setCompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletedLocal, setUncompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const subjectColorMap = new Map<string, (typeof SUBJECT_COLORS)[number]>()
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
      setUncompletedLocal((prev) => {
        const n = new Set(prev)
        n.delete(taskId)
        return n
      })
    } catch {
      /* silent */
    } finally {
      setCompletingId(null)
    }
  }

  const handleUncomplete = async (taskId: string) => {
    setUncompletingId(taskId)
    try {
      await uncompleteTask(taskId)
      setUncompletedLocal((prev) => new Set(prev).add(taskId))
      setCompletedLocal((prev) => {
        const n = new Set(prev)
        n.delete(taskId)
        return n
      })
    } catch {
      /* silent */
    } finally {
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
    <div className="page-root space-y-3">
      {/* Page Header with month nav */}
      <PageHeader
        eyebrow="Timeline"
        title="Schedule Calendar"
        actions={
          <div
            className="flex items-center gap-1 rounded-xl px-3 py-1.5"
            style={{ background: "var(--sh-card)", border: "1px solid var(--sh-border)" }}
          >
            <Link
              href={`/dashboard/calendar?month=${prevMonth}`}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--sh-text-muted)" }}
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <span
              className="text-sm font-semibold min-w-[148px] text-center px-1"
              style={{ color: "var(--sh-text-primary)" }}
            >
              {monthLabel}
            </span>
            <Link
              href={`/dashboard/calendar?month=${nextMonth}`}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--sh-text-muted)" }}
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        }
      />

      {/* Calendar grid */}
      <div
        className="mb-4 overflow-hidden rounded-2xl"
        style={{ border: "1px solid var(--sh-border)", background: "var(--sh-card)" }}
      >
        {/* Day-of-week header */}
        <div
          className="grid grid-cols-7"
          style={{ borderBottom: "1px solid var(--sh-border)", background: "rgba(255,255,255,0.025)" }}
        >
          {WEEK_DAYS.map((d, i) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-bold tracking-widest uppercase"
              style={{ color: i === 6 ? "rgba(239,68,68,0.70)" : "var(--sh-text-muted)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[72px] sm:min-h-[92px]"
              style={{ borderRight: "1px solid var(--sh-border)", borderBottom: "1px solid var(--sh-border)" }}
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum   = i + 1
            const dateStr  = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            const dayTasks = tasksByDate.get(dateStr) ?? []
            const isToday  = dateStr === today
            const isPast   = dateStr < today
            const col      = (firstDayOfWeek + i) % 7
            const isSunday = col === 6

            const studyMin = dayTasks
              .filter((t) => t.is_plan_generated)
              .reduce((s, t) => s + t.duration_minutes, 0)
            const studyHrs      = studyMin / 60
            const previewTasks  = dayTasks.slice(0, 3)
            const overflowCount = Math.max(0, dayTasks.length - 3)

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dateStr)}
                aria-label={`${monthLabel.split(" ")[0]} ${dayNum}${
                  dayTasks.length > 0
                    ? `, ${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""}`
                    : ""
                }`}
                className="min-h-[72px] cursor-pointer p-1.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500/60 sm:min-h-[92px]"
                style={{
                  borderRight: "1px solid var(--sh-border)",
                  borderBottom: "1px solid var(--sh-border)",
                  background: isToday ? "rgba(124,108,255,0.08)" : undefined,
                }}
              >
                {/* Date number + study badge */}
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none"
                    style={{
                      background: isToday ? "var(--sh-primary)" : "transparent",
                      color: isToday
                        ? "#fff"
                        : isSunday
                        ? "rgba(239,68,68,0.75)"
                        : isPast
                        ? "var(--sh-text-muted)"
                        : "var(--sh-text-secondary)",
                    }}
                  >
                    {dayNum}
                  </span>
                  {studyHrs > 0 && (
                    <Badge variant="success" size="sm" className="hidden sm:inline-flex">
                      {studyHrs % 1 === 0 ? studyHrs.toFixed(0) : studyHrs.toFixed(1)}h
                    </Badge>
                  )}
                </div>

                {/* Task pills or Sunday icon */}
                {dayTasks.length === 0 && isSunday ? (
                  <div className="mt-1.5 text-center text-sm opacity-15">☀</div>
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
                            className={`w-[5px] h-[5px] rounded-full shrink-0 ${color.dot} ${
                              isDone ? "opacity-25" : ""
                            }`}
                          />
                          <span
                            className="text-[10px] leading-tight truncate"
                            style={{
                              color: isDone ? "var(--sh-text-muted)" : "var(--sh-text-secondary)",
                              textDecoration: isDone ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </span>
                        </div>
                      )
                    })}
                    {overflowCount > 0 && (
                      <p className="text-[10px] pl-2.5" style={{ color: "var(--sh-text-muted)" }}>
                        +{overflowCount} more
                      </p>
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
            const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
            return (
              <Badge key={s.id} variant={c.badge as SubjectBadgeVariant}>
                {s.name}
              </Badge>
            )
          })}
        </div>
      )}

      {/* Day detail modal */}
      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatDayName(selectedDay) : ""}
        size="md"
      >
        {selectedDay && (
          <>
            <p className="text-sm -mt-2 mb-4" style={{ color: "var(--sh-text-muted)" }}>
              {formatFullDate(selectedDay)}
            </p>

            {selectedTasks.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-5xl mb-3 opacity-20">☀</div>
                <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
                  No tasks scheduled for this day.
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--sh-text-muted)" }}>
                  Enjoy the free time!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {selectedTasks.map((task) => {
                  const isDone =
                    (task.completed || completedLocal.has(task.id)) &&
                    !uncompletedLocal.has(task.id)
                  const isCompleting   = completingId === task.id
                  const isUncompleting = uncompletingId === task.id
                  const isMissed       = !isDone && selectedDay < today
                  const color          = getColor(task.subject_id)
                  const subjectName    = getSubjectName(task.subject_id)

                  return (
                    <div
                      key={task.id}
                      className="rounded-xl p-3.5 transition-all"
                      style={{
                        background: isDone ? "rgba(255,255,255,0.02)" : "var(--sh-card)",
                        border: "1px solid var(--sh-border)",
                        opacity: isDone ? 0.6 : 1,
                      }}
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
                            className="w-5 h-5 shrink-0 mt-0.5 rounded border-2 transition-colors disabled:opacity-40"
                            style={{ borderColor: "var(--sh-border)" }}
                            aria-label="Mark complete"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Subject + session type badges */}
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge
                              variant={color.badge as SubjectBadgeVariant}
                              size="sm"
                            >
                              {subjectName}
                            </Badge>
                            <span
                              className="text-[10px] uppercase tracking-wide font-medium"
                              style={{ color: "var(--sh-text-muted)" }}
                            >
                              {SESSION_LABEL[task.session_type] ?? task.session_type}
                            </span>
                            {isMissed && (
                              <Badge variant="danger" size="sm">Missed</Badge>
                            )}
                          </div>

                          {/* Task title */}
                          <p
                            className="text-sm font-medium leading-snug"
                            style={{
                              color: isDone ? "var(--sh-text-muted)" : "var(--sh-text-primary)",
                              textDecoration: isDone ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </p>

                          {/* Duration */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span
                              className="text-[11px] flex items-center gap-1"
                              style={{ color: "var(--sh-text-muted)" }}
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {task.duration_minutes} min
                            </span>
                          </div>

                          {/* Reschedule picker */}
                          <div className="mt-2 flex items-center gap-2">
                            <svg
                              className="w-3 h-3 shrink-0"
                              style={{ color: "var(--sh-text-muted)" }}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <input
                              type="date"
                              min={today}
                              defaultValue={task.scheduled_date}
                              onChange={(e) => handleReschedule(task.id, e.target.value)}
                              disabled={movingId === task.id}
                              className="ui-input !py-1 !px-2 !text-[11px] disabled:opacity-40 cursor-pointer"
                              aria-label="Reschedule task"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
