"use client"

import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Task } from "@/lib/types/db"
import { WEEKDAY_LABELS } from "@/lib/constants"
import { getTasksForDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import { DayColumn } from "./DayColumn"
import { TaskBlock } from "./TaskBlock"

interface WeeklyTimetableProps {
  tasks: Task[]
  weekDays: string[]
  dailyAvailableMinutes: number
  today?: string
}

type TasksByDate = Record<string, Task[]>

function buildTasksByDate(weekDays: string[], tasks: Task[]): TasksByDate {
  const map: TasksByDate = {}
  weekDays.forEach((date) => {
    map[date] = getTasksForDate(tasks, date)
  })
  return map
}

function findContainer(items: TasksByDate, id: string): string | null {
  if (id in items) return id
  for (const date of Object.keys(items)) {
    if (items[date].some(task => task.id === id)) return date
  }
  return null
}

function findTask(items: TasksByDate, id: string): Task | null {
  for (const date of Object.keys(items)) {
    const task = items[date].find(entry => entry.id === id)
    if (task) return task
  }
  return null
}

function cloneItems(items: TasksByDate): TasksByDate {
  return Object.fromEntries(Object.entries(items).map(([key, value]) => [key, [...value]]))
}

export function WeeklyTimetable({ tasks, weekDays, dailyAvailableMinutes, today }: WeeklyTimetableProps) {
  const [itemsByDate, setItemsByDate] = useState<TasksByDate>(() => buildTasksByDate(weekDays, tasks))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [todayPulse, setTodayPulse] = useState(false)

  useEffect(() => {
    setItemsByDate(buildTasksByDate(weekDays, tasks))
  }, [tasks, weekDays])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const totalsByDate = useMemo(() => {
    const totals: Record<string, number> = {}
    weekDays.forEach(date => {
      totals[date] = itemsByDate[date]?.reduce((sum, task) => sum + task.duration_minutes, 0) ?? 0
    })
    return totals
  }, [itemsByDate, weekDays])

  const activeTask = activeId ? findTask(itemsByDate, activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const activeContainer = findContainer(itemsByDate, activeId)
    const overContainer = findContainer(itemsByDate, overId)

    if (!activeContainer || !overContainer) return
    const droppedIntoToday = Boolean(today)
      && normalizeLocalDate(overContainer) === normalizeLocalDate(today)

    if (activeContainer === overContainer) {
      const items = itemsByDate[activeContainer]
      const oldIndex = items.findIndex(task => task.id === activeId)
      const newIndex = items.findIndex(task => task.id === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      if (oldIndex !== newIndex) {
        setItemsByDate(prev => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }))
      }
      if (droppedIntoToday) {
        setTodayPulse(true)
        setTimeout(() => setTodayPulse(false), 150)
      }
      return
    }

    const activeItems = itemsByDate[activeContainer]
    const overItems = itemsByDate[overContainer]
    const activeIndex = activeItems.findIndex(task => task.id === activeId)
    if (activeIndex === -1) return

    const movedTask = activeItems[activeIndex]
    const newIndex = overItems.findIndex(task => task.id === overId)
    const insertIndex = newIndex >= 0 ? newIndex : overItems.length

    const nextActiveItems = activeItems.filter(task => task.id !== activeId)
    const nextOverItems = [...overItems]
    const updatedTask = { ...movedTask, scheduled_date: overContainer }
    nextOverItems.splice(insertIndex, 0, updatedTask)

    const snapshot = cloneItems(itemsByDate)
    setItemsByDate(prev => ({
      ...prev,
      [activeContainer]: nextActiveItems,
      [overContainer]: nextOverItems,
    }))

    if (normalizeLocalDate(movedTask.scheduled_date) !== normalizeLocalDate(overContainer)) {
      try {
        await rescheduleTask(movedTask.id, overContainer)
      } catch (error) {
        console.error("Reschedule failed:", error)
        setItemsByDate(snapshot)
      }
    }

    if (droppedIntoToday) {
      setTodayPulse(true)
      setTimeout(() => setTodayPulse(false), 150)
    }
  }

  return (
    <section
      className="space-y-4"
      style={{
        "--tt-text": "var(--foreground)",
        "--tt-muted": "color-mix(in srgb, var(--foreground) 55%, transparent)",
        "--tt-border": "color-mix(in srgb, var(--foreground) 8%, transparent)",
        "--tt-border-strong": "color-mix(in srgb, var(--foreground) 12%, transparent)",
        "--tt-track": "color-mix(in srgb, var(--foreground) 10%, transparent)",
        "--tt-fill": "color-mix(in srgb, var(--foreground) 45%, transparent)",
        "--tt-card": "var(--card)",
        "--tt-card-hover": "var(--card-hover)",
        "--tt-overload": "color-mix(in srgb, #ef4444 35%, var(--foreground) 65%)",
        "--tt-overfill": "color-mix(in srgb, #ef4444 55%, var(--foreground) 45%)",
        "--tt-today": "color-mix(in srgb, var(--accent) 28%, transparent)",
        "--tt-separator": "color-mix(in srgb, var(--foreground) 8%, transparent)",
      } as CSSProperties}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium" style={{ color: "var(--tt-text)" }}>Weekly Timetable</h2>
        <span className="text-xs" style={{ color: "var(--tt-muted)" }}>Drag to reschedule</span>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-7 gap-6">
          {weekDays.map((date, index) => (
            <div key={date} className="relative">
              {index > 0 && (
                <div
                  className="absolute -left-3 top-3 bottom-3 w-px"
                  style={{ backgroundColor: "var(--tt-separator)" }}
                  aria-hidden="true"
                />
              )}
              <DayColumn
                date={date}
                label={WEEKDAY_LABELS[index] ?? ""}
                totalMinutes={totalsByDate[date] ?? 0}
                dailyAvailableMinutes={dailyAvailableMinutes}
                isOverloaded={(totalsByDate[date] ?? 0) > dailyAvailableMinutes}
                isToday={normalizeLocalDate(date) === normalizeLocalDate(today ?? null)}
                isDragging={Boolean(activeId)}
                pulse={todayPulse && normalizeLocalDate(date) === normalizeLocalDate(today ?? null)}
              >
                <SortableContext
                  items={itemsByDate[date]?.map(task => task.id) ?? []}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {(itemsByDate[date] ?? []).map(task => (
                      <TaskBlock key={task.id} task={task} />
                    ))}
                  </div>
                </SortableContext>
              </DayColumn>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeTask ? (
            <div
              className="rounded-md px-3 py-2"
              style={{
                backgroundColor: "var(--tt-card)",
                boxShadow: "0 10px 24px color-mix(in srgb, var(--foreground) 18%, transparent)",
                transform: "scale(1.04)",
                transition: "transform 180ms ease-out",
              }}
            >
              <div className="text-xs font-medium truncate" style={{ color: "var(--tt-text)" }}>
                {activeTask.title}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px]" style={{ color: "var(--tt-muted)" }}>
                  {activeTask.duration_minutes} min
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}
