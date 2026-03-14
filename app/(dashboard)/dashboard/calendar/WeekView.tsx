"use client"

import { useState, useRef, useTransition, type DragEvent } from "react"
import { Task } from "@/lib/types/db"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"

interface WeekViewProps {
  days: string[]
  weekMap: Record<string, Task[]>
  today: string
}

function formatDay(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
}

function formatDayDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function WeekView({ days, weekMap: initialWeekMap, today }: WeekViewProps) {
  const [weekMap, setWeekMap] = useState(initialWeekMap)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [dragSourceDay, setDragSourceDay] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  function handleDragStart(e: DragEvent, taskId: string, sourceDate: string) {
    setDragTaskId(taskId)
    setDragSourceDay(sourceDate)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", taskId)
  }

  function handleDragOver(e: DragEvent, date: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverDay !== date) setDragOverDay(date)
  }

  function handleDragLeave() {
    setDragOverDay(null)
  }

  function handleDrop(e: DragEvent, targetDate: string) {
    e.preventDefault()
    setDragOverDay(null)

    const taskId = e.dataTransfer.getData("text/plain")
    if (!taskId || !dragSourceDay || dragSourceDay === targetDate) {
      setDragTaskId(null)
      setDragSourceDay(null)
      return
    }
    if (targetDate < today) {
      setDragTaskId(null)
      setDragSourceDay(null)
      return
    }

    const sourceDay = dragSourceDay
    setWeekMap(prev => {
      const nextMap = { ...prev }
      const sourceTasks = [...(nextMap[sourceDay] ?? [])]
      const taskIndex = sourceTasks.findIndex(t => t.id === taskId)
      if (taskIndex === -1) return prev

      const [task] = sourceTasks.splice(taskIndex, 1)
      const movedTask = { ...task, scheduled_date: targetDate }
      nextMap[sourceDay] = sourceTasks
      nextMap[targetDate] = [...(nextMap[targetDate] ?? []), movedTask]
      return nextMap
    })

    setDragTaskId(null)
    setDragSourceDay(null)

    startTransition(async () => {
      try {
        const res = await rescheduleTask(taskId, targetDate)
        if (res.status !== "SUCCESS") {
          setWeekMap(prev => {
            const nextMap = { ...prev }
            const targetTasks = [...(nextMap[targetDate] ?? [])]
            const idx = targetTasks.findIndex(t => t.id === taskId)
            if (idx === -1) return prev

            const [task] = targetTasks.splice(idx, 1)
            const revertedTask = { ...task, scheduled_date: sourceDay }
            nextMap[targetDate] = targetTasks
            nextMap[sourceDay] = [...(nextMap[sourceDay] ?? []), revertedTask]
            return nextMap
          })
        }
      } catch {
        setWeekMap(prev => {
          const nextMap = { ...prev }
          const targetTasks = [...(nextMap[targetDate] ?? [])]
          const idx = targetTasks.findIndex(t => t.id === taskId)
          if (idx === -1) return prev

          const [task] = targetTasks.splice(idx, 1)
          const revertedTask = { ...task, scheduled_date: sourceDay }
          nextMap[targetDate] = targetTasks
          nextMap[sourceDay] = [...(nextMap[sourceDay] ?? []), revertedTask]
          return nextMap
        })
      }
    })
  }

  function handleDragEnd() {
    setDragTaskId(null)
    setDragSourceDay(null)
    setDragOverDay(null)
  }

  function handleComplete(taskId: string) {
    setCompletingId(taskId)
    setWeekMap(prev => {
      const nextMap: Record<string, Task[]> = {}
      for (const [date, tasks] of Object.entries(prev)) {
        nextMap[date] = tasks.map(t =>
          t.id === taskId ? { ...t, completed: true } : t
        )
      }
      return nextMap
    })
    startTransition(async () => {
      try {
        await completeTask(taskId)
      } catch {
        setWeekMap(prev => {
          const nextMap: Record<string, Task[]> = {}
          for (const [date, tasks] of Object.entries(prev)) {
            nextMap[date] = tasks.map(t =>
              t.id === taskId ? { ...t, completed: false } : t
            )
          }
          return nextMap
        })
      } finally {
        setCompletingId(null)
      }
    })
  }

  function handleUncomplete(taskId: string) {
    setUncompletingId(taskId)
    setWeekMap(prev => {
      const nextMap: Record<string, Task[]> = {}
      for (const [date, tasks] of Object.entries(prev)) {
        nextMap[date] = tasks.map(t =>
          t.id === taskId ? { ...t, completed: false } : t
        )
      }
      return nextMap
    })
    startTransition(async () => {
      try {
        await uncompleteTask(taskId)
      } catch {
        setWeekMap(prev => {
          const nextMap: Record<string, Task[]> = {}
          for (const [date, tasks] of Object.entries(prev)) {
            nextMap[date] = tasks.map(t =>
              t.id === taskId ? { ...t, completed: true } : t
            )
          }
          return nextMap
        })
      } finally {
        setUncompletingId(null)
      }
    })
  }

  function handleInlineReschedule(taskId: string, sourceDate: string, newDate: string) {
    if (!newDate || newDate < today) return

    setWeekMap(prev => {
      const nextMap = { ...prev }
      const sourceTasks = [...(nextMap[sourceDate] ?? [])]
      const idx = sourceTasks.findIndex(t => t.id === taskId)
      if (idx === -1) return prev

      const [task] = sourceTasks.splice(idx, 1)
      const movedTask = { ...task, scheduled_date: newDate }
      nextMap[sourceDate] = sourceTasks
      nextMap[newDate] = [...(nextMap[newDate] ?? []), movedTask]
      return nextMap
    })
    setRescheduleOpen(null)

    startTransition(async () => {
      try {
        const res = await rescheduleTask(taskId, newDate)
        if (res.status !== "SUCCESS") {
          setWeekMap(prev => {
            const nextMap = { ...prev }
            const targetTasks = [...(nextMap[newDate] ?? [])]
            const idx = targetTasks.findIndex(t => t.id === taskId)
            if (idx === -1) return prev

            const [task] = targetTasks.splice(idx, 1)
            const revertedTask = { ...task, scheduled_date: sourceDate }
            nextMap[newDate] = targetTasks
            nextMap[sourceDate] = [...(nextMap[sourceDate] ?? []), revertedTask]
            return nextMap
          })
        }
      } catch {
        setWeekMap(prev => {
          const nextMap = { ...prev }
          const targetTasks = [...(nextMap[newDate] ?? [])]
          const idx = targetTasks.findIndex(t => t.id === taskId)
          if (idx === -1) return prev

          const [task] = targetTasks.splice(idx, 1)
          const revertedTask = { ...task, scheduled_date: sourceDate }
          nextMap[newDate] = targetTasks
          nextMap[sourceDate] = [...(nextMap[sourceDate] ?? []), revertedTask]
          return nextMap
        })
      }
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {days.map(date => {
        const dayTasks = weekMap[date] ?? []
        const isToday = date === today
        const isPast = date < today
        const pending = dayTasks.filter(t => !t.completed)
        const done = dayTasks.filter(t => t.completed)
        const totalMin = pending.reduce((s, t) => s + t.duration_minutes, 0)
        const hasMissed = isPast && pending.length > 0
        const isDropTarget = dragOverDay === date && date >= today && dragSourceDay !== date

        return (
          <div
            key={date}
            onDragOver={(e) => handleDragOver(e, date)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, date)}
            className={`rounded-xl p-3 space-y-3 min-h-[200px] flex flex-col border transition-all ${
              isDropTarget
                ? "bg-indigo-500/15 border-indigo-400/40 ring-2 ring-indigo-400/25"
                : isToday
                ? "bg-indigo-500/[0.08] border-indigo-500/25"
                : hasMissed
                ? "bg-red-950/20 border-red-700/20"
                : "bg-white/[0.03] border-white/[0.06]"
            }`}
          >
            <div className={`flex items-center justify-between text-sm ${
              isToday ? "text-indigo-300" : hasMissed ? "text-red-400" : "text-white/70"
            }`}>
              <span className="font-semibold">{formatDay(date)}</span>
              <span className="text-xs">{formatDayDate(date)}</span>
            </div>

            {totalMin > 0 && (
              <div className="text-[11px] text-white/40">{totalMin} min pending</div>
            )}

            {isDropTarget && (
              <div className="text-[10px] text-indigo-300/60 text-center py-1">
                Drop here to reschedule
              </div>
            )}

            {dayTasks.length === 0 && !isDropTarget && (
              <div className="text-xs text-white/20 flex-1">&#x2014;</div>
            )}

            <div className="space-y-2 flex-1">
              {pending.map(task => (
                <div
                  key={task.id}
                  draggable={!isPast}
                  onDragStart={(e) => handleDragStart(e, task.id, date)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl p-2 space-y-2 ${
                    dragTaskId === task.id ? "opacity-40" : ""
                  } ${isPast ? "bg-red-950/30" : "bg-white/[0.04] cursor-grab active:cursor-grabbing"}`}
                >
                  <div className="text-xs font-semibold text-white/90 truncate">{task.title}</div>
                  <div className="text-[11px] text-white/50">{task.duration_minutes} min &#xB7; P{task.priority}</div>

                  {isPast && (
                    <div className="text-[10px] text-red-400/80 font-medium">Missed</div>
                  )}

                  {!isPast && (
                    <div className="text-[10px] text-white/30 flex items-center gap-1">
                      <span>&#x2B07;</span> Drag to move
                    </div>
                  )}

                  <button
                    onClick={() => handleComplete(task.id)}
                    disabled={isPending || completingId === task.id}
                    className="w-full bg-emerald-500/80 hover:bg-emerald-400 text-white text-xs font-semibold rounded-xl px-2 py-1 transition-all disabled:opacity-40 disabled:cursor-wait"
                  >
                    {completingId === task.id ? "Saving..." : "&#x2713; Done"}
                  </button>

                  {rescheduleOpen === task.id ? (
                    <div className="flex gap-1">
                      <input
                        ref={dateInputRef}
                        type="date"
                        min={today}
                        className="flex-1 min-w-0 text-[11px] bg-white/[0.04] border border-white/[0.06] rounded-xl px-1.5 py-1 text-white/70"
                        aria-label="New date"
                      />
                      <button
                        onClick={() => {
                          const val = dateInputRef.current?.value
                          if (val) handleInlineReschedule(task.id, date, val)
                        }}
                        disabled={isPending}
                        className="text-[11px] font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white/70 rounded-xl px-2 py-1 transition-all shrink-0 disabled:opacity-40"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => setRescheduleOpen(null)}
                        className="text-[11px] text-white/30 hover:text-white/60 px-1"
                        aria-label="Cancel reschedule"
                      >
                        &#x2715;
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRescheduleOpen(task.id)}
                      className="w-full text-[11px] font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white/70 rounded-xl px-2 py-1 transition-all"
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              ))}
            </div>

            {done.length > 0 && (
              <div className="space-y-1 border-t border-white/[0.06] pt-2">
                <div className="text-[10px] text-white/30 uppercase tracking-wide">Done</div>
                {done.map(task => (
                  <div key={task.id} className="flex items-center justify-between gap-1 px-1">
                    <span className="text-[11px] text-white/40 line-through truncate">
                      {task.title}
                    </span>
                    <button
                      onClick={() => handleUncomplete(task.id)}
                      disabled={isPending || uncompletingId === task.id}
                      className="text-[10px] text-white/30 hover:text-amber-400 transition-colors shrink-0 disabled:opacity-40"
                      aria-label={`Undo completion of ${task.title}`}
                    >
                      {uncompletingId === task.id ? "..." : "&#x21A9;"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}