"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import type { Task } from "@/lib/types/db"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"

interface Props {
  tasks: Task[]
  year: number
  month: number
  today: string
  prevMonth: string
  nextMonth: string
  isCurrentMonth: boolean
}

function formatDayLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

export function MonthView({ tasks, year, month, today, prevMonth, nextMonth, isCurrentMonth }: Props) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completedLocal, setCompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletedLocal, setUncompletedLocal] = useState<Set<string>>(new Set())
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (!target.dataset.dayIndex) return

    const idx = Number(target.dataset.dayIndex)
    let next = idx
    if (e.key === "ArrowRight") next = Math.min(idx + 1, daysInMonth - 1)
    else if (e.key === "ArrowLeft") next = Math.max(idx - 1, 0)
    else if (e.key === "ArrowDown") next = Math.min(idx + 7, daysInMonth - 1)
    else if (e.key === "ArrowUp") next = Math.max(idx - 7, 0)
    else return

    e.preventDefault()
    const nextBtn = gridRef.current?.querySelector(`[data-day-index="${next}"]`) as HTMLElement | null
    nextBtn?.focus()
  }, [daysInMonth])

  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    const list = tasksByDate.get(task.scheduled_date) ?? []
    list.push(task)
    tasksByDate.set(task.scheduled_date, list)
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId)
    try {
      await completeTask(taskId)
      setCompletedLocal(prev => new Set(prev).add(taskId))
      setUncompletedLocal(prev => { const n = new Set(prev); n.delete(taskId); return n })
    } catch {
      // Silently fail
    } finally {
      setCompletingId(null)
    }
  }

  const handleUncomplete = async (taskId: string) => {
    setUncompletingId(taskId)
    try {
      await uncompleteTask(taskId)
      setUncompletedLocal(prev => new Set(prev).add(taskId))
      setCompletedLocal(prev => { const n = new Set(prev); n.delete(taskId); return n })
    } catch {
      // Silently fail
    } finally {
      setUncompletingId(null)
    }
  }

  const expandedTasks = expandedDay ? (tasksByDate.get(expandedDay) ?? []) : []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Calendar</p>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">{monthLabel}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isCurrentMonth && (
              <Link
                href="/dashboard/calendar?view=month"
                className="px-3 py-1.5 text-xs bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 rounded-xl hover:bg-indigo-500/25 transition-all font-medium"
              >
                This month
              </Link>
            )}
            <Link
              href={`/dashboard/calendar?view=month&month=${prevMonth}`}
              className="px-3 py-1.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all"
            >
              &#x2190; Prev
            </Link>
            <Link
              href={`/dashboard/calendar?view=month&month=${nextMonth}`}
              className="px-3 py-1.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all"
            >
              Next &#x2192;
            </Link>
            <Link
              href="/dashboard/calendar"
              className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all text-white/50"
            >
              Week view
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-xs text-white/40 flex-wrap">
          <span>{tasks.length} tasks</span>
          <span className="text-emerald-400/70">{tasks.filter(t => t.completed).length} completed</span>
          <span>{tasks.reduce((s, t) => s + t.duration_minutes, 0)} min total</span>
          {tasks.length > 0 && (
            <span className="text-white/60 font-semibold">
              {Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)}% complete
            </span>
          )}
        </div>
      </header>

      <div ref={gridRef} onKeyDown={handleGridKeyDown} className="grid grid-cols-7 gap-1" role="grid" aria-label="Monthly calendar">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-center text-[11px] text-white/30 font-medium py-2">{d}</div>
        ))}

        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[48px] sm:min-h-[80px]" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
          const dayTasks = tasksByDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const isPast = dateStr < today
          const count = dayTasks.length
          const doneCount = dayTasks.filter(t => t.completed || completedLocal.has(t.id)).length
          const pendingCount = count - doneCount
          const hasMissed = isPast && pendingCount > 0
          const isExpanded = expandedDay === dateStr
          const totalMin = dayTasks.reduce((s, t) => s + t.duration_minutes, 0)

          return (
            <button
              key={dayNum}
              data-day-index={i}
              tabIndex={i === 0 ? 0 : -1}
              onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
              aria-label={`${monthLabel.split(" ")[0]} ${dayNum}${count > 0 ? ` - ${count} task${count !== 1 ? "s" : ""}` : ""}`}
              className={`min-h-[48px] sm:min-h-[80px] rounded-xl p-1 sm:p-2 text-left transition-all border ${
                isExpanded
                  ? "bg-indigo-500/[0.12] border-indigo-500/30 ring-1 ring-indigo-500/25"
                  : isToday
                  ? "bg-indigo-500/[0.08] border-indigo-500/25"
                  : hasMissed
                  ? "bg-red-950/20 border-red-700/20"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
              }`}
            >
              <div className={`text-xs font-semibold mb-1 ${
                isToday ? "text-indigo-300" : hasMissed ? "text-red-400" : "text-white/50"
              }`}>
                {dayNum}
              </div>
              {count > 0 && (
                <div className="space-y-0.5">
                  <div className={`text-xs font-medium ${hasMissed ? "text-red-400/80" : "text-white/70"}`}>
                    {count} task{count !== 1 ? "s" : ""}
                  </div>
                  <div className="text-[10px] text-white/30">{totalMin}m</div>
                  {doneCount > 0 && (
                    <div className="text-[10px] text-emerald-500/60">{doneCount} done</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {expandedDay && (
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{formatDayLabel(expandedDay)}</h3>
            <button
              onClick={() => setExpandedDay(null)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
              aria-label="Close day detail panel"
            >
              Close
            </button>
          </div>

          {expandedTasks.length === 0 ? (
            <p className="text-sm text-white/40 mt-4">No tasks on this day. Enjoy the free time! &#x1F389;</p>
          ) : (
            <div className="space-y-2 mt-4">
              {expandedTasks.map(task => {
                const isDone = (task.completed || completedLocal.has(task.id)) && !uncompletedLocal.has(task.id)
                const isCompleting = completingId === task.id
                const isUncompleting = uncompletingId === task.id
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${isDone ? "bg-white/[0.03] opacity-50" : "bg-white/[0.04]"}`}
                  >
                    {isDone ? (
                      <div className="w-5 h-5 shrink-0 rounded border-2 border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleComplete(task.id)}
                        disabled={isCompleting}
                        className="w-5 h-5 shrink-0 rounded border-2 border-white/30 hover:border-emerald-400 transition-colors disabled:opacity-40"
                        aria-label="Mark complete"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDone ? "text-white/40 line-through" : "text-white/90"}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-white/40">
                        {task.duration_minutes} min &#xB7; P{task.priority}
                      </div>
                    </div>
                    {isDone && (
                      <button
                        onClick={() => handleUncomplete(task.id)}
                        disabled={isUncompleting}
                        className="text-xs text-white/30 hover:text-amber-400 transition-colors disabled:opacity-40 shrink-0"
                        aria-label="Undo complete"
                        title="Undo complete"
                      >
                        &#x21A9;
                      </button>
                    )}
                    {!isDone && expandedDay < today && (
                      <span className="text-[10px] text-red-400 font-medium shrink-0">Missed</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <Link
            href={`/dashboard/calendar?week=${expandedDay}`}
            className="inline-block text-xs text-white/40 hover:text-white/70 transition-colors mt-4"
          >
            Open in week view &#x2192;
          </Link>
        </div>
      )}
    </div>
  )
}