"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Task } from "@/lib/types/db"
import { getTasksForDate } from "@/lib/tasks/getTasksForDate"
import { setTaskCompletion } from "@/app/actions/plan/setTaskCompletion"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"
import { useToast } from "@/app/components/Toast"
import { Badge, Modal } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { AddTaskButton } from "@/app/components/tasks/AddTaskButton"
import { STANDALONE_SUBJECT_LABEL } from "@/lib/constants"

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
  className?: string
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
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatDayName(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  })
}

export function MonthView({
  tasks,
  subjects,
  year,
  month,
  today,
  prevMonth,
  nextMonth,
  className,
}: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const [taskRows, setTaskRows] = useState(tasks)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setTaskRows(tasks)
  }, [tasks])

  const subjectColorMap = new Map<string, (typeof SUBJECT_COLORS)[number]>()
  subjects.forEach((s, i) => {
    subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length])
  })

  const getColor = (subjectId: string | null) =>
    subjectId ? subjectColorMap.get(subjectId) ?? SUBJECT_COLORS[3] : SUBJECT_COLORS[3]

  const getSubjectName = (task: Task) => {
    if (task.task_type === "standalone") {
      return STANDALONE_SUBJECT_LABEL
    }

    if (!task.subject_id) {
      return "Unknown"
    }

    return subjects.find((s) => s.id === task.subject_id)?.name ?? "Unknown"
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const calendarWeekRows = Math.max(5, Math.ceil((firstDayOfWeek + daysInMonth) / 7))
  const totalCalendarCells = calendarWeekRows * 7

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
      const result = await setTaskCompletion(taskId, true)
      if (result.status !== "SUCCESS") {
        if (result.status === "UNAUTHORIZED") {
          addToast("Please sign in again.", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(result.message || "Could not mark task complete.", "error")
        }
        return
      }

      router.refresh()
    } catch {
      addToast("Could not mark task complete. Please try again.", "error")
    } finally {
      setCompletingId(null)
    }
  }

  const handleUncomplete = async (taskId: string) => {
    setUncompletingId(taskId)
    try {
      const result = await setTaskCompletion(taskId, false)
      if (result.status !== "SUCCESS") {
        if (result.status === "UNAUTHORIZED") {
          addToast("Please sign in again.", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(result.message || "Could not undo completion.", "error")
        }
        return
      }

      router.refresh()
    } catch {
      addToast("Could not undo completion. Please try again.", "error")
    } finally {
      setUncompletingId(null)
    }
  }

  const handleReschedule = async (taskId: string, newDate: string) => {
    if (!newDate || newDate < today) {
      addToast("Cannot move tasks to a past date.", "error")
      return
    }
    setMovingId(taskId)
    try {
      const result = await rescheduleTask(taskId, newDate)
      if (result.status === "SUCCESS") {
        router.refresh()
        addToast("Task rescheduled.", "success")
      } else if (result.status === "UNAUTHORIZED") {
        addToast("Please sign in again to reschedule tasks.", "error")
      } else if (result.status === "INVALID_DATE") {
        addToast("Selected date is invalid.", "error")
      } else if (result.status === "NOT_FOUND") {
        addToast("Task not found.", "error")
      } else {
        addToast(result.message || "Could not reschedule task.", "error")
      }
    } catch {
      addToast("Could not reschedule task. Please try again.", "error")
    } finally {
      setMovingId(null)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (deletingId === taskId) return

    setDeletingId(taskId)
    try {
      const result = await deleteScheduleTask(taskId)
      if (result.status === "SUCCESS" || result.status === "NOT_FOUND") {
        setTaskRows((previous) => previous.filter((task) => task.id !== taskId))
        addToast(result.status === "SUCCESS" ? "Task deleted." : "Task no longer exists.", "success")
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Please sign in again.", "error")
        return
      }

      addToast(result.message || "Could not delete task.", "error")
    } catch {
      addToast("Could not delete task. Please try again.", "error")
    } finally {
      setDeletingId(null)
    }
  }

  const selectedTasks = selectedDay ? getTasksForDate(taskRows, selectedDay) : []
  const rootClassName = `flex w-full min-h-0 flex-1 self-stretch flex-col overflow-hidden px-4 pb-3 pt-2 sm:px-6 ${className ?? ""}`.trim()

  return (
    <div className={rootClassName}>
      {/* Page Header with month nav */}
      <div className="mb-1">
        <PageHeader
          title="Calendar"
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
      </div>

      {/* Calendar grid */}
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
        style={{ border: "1px solid var(--sh-border)", background: "var(--sh-card)" }}
      >
        {/* Day-of-week header */}
        <div
          className="grid shrink-0 grid-cols-7"
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
        <div
          className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${calendarWeekRows}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCalendarCells }).map((_, cellIndex) => {
            const dayNum = cellIndex - firstDayOfWeek + 1
            const inCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
            const dateStr = inCurrentMonth
              ? `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
              : null
            const dayTasks = dateStr ? getTasksForDate(taskRows, dateStr) : []
            const isToday = dateStr === today
            const isPast = dateStr ? dateStr < today : false
            const isSunday = cellIndex % 7 === 6

            const studyMin = dayTasks
              .filter((t) => t.task_source === "plan")
              .reduce((sum, t) => sum + t.duration_minutes, 0)
            const studyHrs = studyMin / 60
            const previewTasks = dayTasks.slice(0, 3)
            const overflowCount = Math.max(0, dayTasks.length - previewTasks.length)

            if (!inCurrentMonth || !dateStr) {
              return (
                <div
                  key={`empty-${cellIndex}`}
                  className="flex h-full min-h-0 flex-col border-b border-r p-1.5"
                  style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                  aria-hidden="true"
                >
                  <div className="mb-1 flex shrink-0 items-center justify-between gap-1">
                    <span className="h-5 w-5 rounded-full" />
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden" />
                </div>
              )
            }

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(dateStr)}
                aria-label={`${monthLabel.split(" ")[0]} ${dayNum}${
                  dayTasks.length > 0
                    ? `, ${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""}`
                    : ""
                }`}
                className="flex h-full min-h-0 cursor-pointer flex-col border-b border-r p-1.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500/60"
                style={{
                  borderColor: "var(--sh-border)",
                  background: isToday ? "rgba(124,108,255,0.08)" : "transparent",
                }}
              >
                <div className="mb-1 flex shrink-0 items-center justify-between gap-1">
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

                <div className="min-h-0 flex-1 overflow-hidden">
                  {dayTasks.length === 0 ? (
                    <div className="flex h-full items-start pt-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full opacity-35"
                        style={{ background: "var(--sh-text-muted)" }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col gap-[3px] overflow-hidden">
                      {previewTasks.map((task) => {
                        const isDone = task.completed
                        const color = getColor(task.subject_id)
                        return (
                          <div key={task.id} className="flex items-center gap-1">
                            <span
                              className={`h-[5px] w-[5px] shrink-0 rounded-full ${color.dot} ${
                                isDone ? "opacity-25" : ""
                              }`}
                            />
                            <span
                              className="truncate text-[10px] leading-tight"
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
                        <p className="shrink-0 pl-2.5 text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                          +{overflowCount} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Subject colour legend */}
      {subjects.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-2 pt-1">
          {subjects.map((s, i) => {
            const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
            return (
              <Badge key={s.id} variant={c.badge as SubjectBadgeVariant} size="sm">
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
            <div className="-mt-2 mb-4 flex items-center justify-between gap-2">
              <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
                {formatFullDate(selectedDay)}
              </p>
              <AddTaskButton
                subjects={subjects}
                initialDate={selectedDay}
                buttonLabel="Add Task"
                buttonClassName="ui-btn ui-btn-primary ui-btn-sm"
                onCreated={() => setSelectedDay(selectedDay)}
              />
            </div>

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
                  const isDone = task.completed
                  const isCompleting   = completingId === task.id
                  const isUncompleting = uncompletingId === task.id
                  const isMissed       = !isDone && selectedDay < today
                  const color          = getColor(task.subject_id)
                  const subjectName    = getSubjectName(task)

                  return (
                    <div
                      key={task.id}
                      className="rounded-xl p-2 transition-all"
                      style={{
                        background: isDone ? "rgba(255,255,255,0.02)" : "var(--sh-card)",
                        border: "1px solid var(--sh-border)",
                        opacity: isDone ? 0.6 : 1,
                      }}
                    >
                      <div className="flex items-start gap-1.5">
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

                        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
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

                            <p
                              className="mt-1 break-words text-sm font-semibold leading-snug"
                              title={task.title}
                              style={{
                                color: isDone ? "var(--sh-text-muted)" : "var(--sh-text-primary)",
                                textDecoration: isDone ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                            <div className="flex items-center gap-1.5">
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

                              <button
                                type="button"
                                onClick={() => void handleDeleteTask(task.id)}
                                disabled={deletingId === task.id || movingId === task.id}
                                className="task-icon-delete-button"
                                aria-label="Delete task"
                                title="Delete"
                              >
                                {deletingId === task.id ? (
                                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
                                ) : (
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                                  </svg>
                                )}
                                <span className="sr-only">Delete</span>
                              </button>
                            </div>

                            <input
                              type="date"
                              min={today}
                              defaultValue={task.scheduled_date}
                              onChange={(e) => handleReschedule(task.id, e.target.value)}
                              disabled={movingId === task.id}
                              className="ui-input !h-7 !py-0.5 !px-2 !text-[11px] disabled:opacity-40 cursor-pointer"
                              style={{ width: "15ch", minWidth: "15ch" }}
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
