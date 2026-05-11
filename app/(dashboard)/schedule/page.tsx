"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import {
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  closestCenter,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { useToast } from "@/app/components/Toast"
import {
  importPlannerSchedule,
} from "@/app/actions/schedule/importPlannerSchedule"
import {
  getScheduleWeekData,
  type ScheduleSubjectOption,
  type ScheduleWeekTask,
} from "@/app/actions/schedule/getWeekSchedule"
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"
import { setTaskCompletion } from "@/app/actions/plan/setTaskCompletion"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import {
  useScheduleTopbar,
} from "@/app/components/layout/ScheduleTopbarContext"
import { saveTaskViaUnifiedFlow } from "@/app/components/tasks/taskWriteGateway"
import { STANDALONE_SUBJECT_ID, STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import {
  getTodayLocalDate,
  normalizeLocalDate,
} from "@/lib/tasks/getTasksForDate"
import {
  type CalendarEvent,
  type DayOrderMap,
  DAY_LABELS,
  addMonthsISO,
  formatDayDateLabel,
  mapTasksToEvents,
} from "./schedule-page.helpers"
import { DragPreviewCard } from "./schedule-page.cards"
import { AddEventModal } from "./schedule-page.modal"
import { useWeekNavigation } from "./useWeekNavigation"
import { useScheduleFilters } from "./useScheduleFilters"
import { useDayOrder } from "./useDayOrder"
import DayColumn from "./DayColumn"

type EventDraft = {
  title: string
  subjectId: string
  day: number
  durationMinutes: number
}

export default function SchedulePage() {
  const { addToast } = useToast()
  const { setState: setTopbarState, resetState: resetTopbarState } = useScheduleTopbar()

  const [tasks, setTasks] = useState<ScheduleWeekTask[]>([])
  const [subjects, setSubjects] = useState<ScheduleSubjectOption[]>([])
  const [isLoadingWeek, setIsLoadingWeek] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [quickAddDay, setQuickAddDay] = useState(0)
  const [activeDragEventId, setActiveDragEventId] = useState<string | null>(null)
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set())
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [isImportingPlanner, setIsImportingPlanner] = useState(false)
  const eventElementMapRef = useRef<Map<string, HTMLDivElement>>(new Map())

  const {
    setWeekAnchorISO,
    weekMeta,
    weekDates,
    isCurrentWeek,
    mobileDay,
    handleGoPrevWeek,
    handleGoNextWeek,
    handleGoCurrentWeek,
  } = useWeekNavigation()

  const loadWeekData = useCallback(async (weekStartISO: string) => {
    setIsLoadingWeek(true)
    try {
      const result = await getScheduleWeekData(weekStartISO)

      if (result.status === "UNAUTHORIZED") {
        setTasks([])
        setSubjects([])
        addToast("Sign in required to load schedule.", "error")
        return
      }

      if (result.status === "INVALID_WEEK") {
        addToast("Invalid week selected.", "error")
        return
      }

      if (result.status === "ERROR") {
        addToast(`Could not load schedule: ${result.message}`, "error")
        return
      }

      setTasks(result.tasks)
      setSubjects(result.subjects)
      setWeekAnchorISO(result.weekStartISO)
    } catch {
      addToast("Could not load schedule right now.", "error")
    } finally {
      setIsLoadingWeek(false)
    }
  }, [addToast, setWeekAnchorISO])

  useEffect(() => {
    void loadWeekData(weekMeta.weekStartISO)
  }, [loadWeekData, weekMeta.weekStartISO])

  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )

  const events = useMemo(
    () => mapTasksToEvents(tasks, weekDates, subjectNameById),
    [tasks, weekDates, subjectNameById]
  )

  const { dayOrderMap, setDayOrderMap } = useDayOrder({ events, weekStartISO: weekMeta.weekStartISO })

  const {
    statusFilter,
    setStatusFilter,
    activeChipId,
    setActiveChipId,
    filterChips,
    filteredEvents,
  } = useScheduleFilters({ subjects, events })

  const editingEvent = useMemo(
    () => events.find((event) => event.id === editEventId) ?? null,
    [events, editEventId]
  )

  const activeDragEvent = useMemo(
    () => events.find((event) => event.id === activeDragEventId) ?? null,
    [events, activeDragEventId]
  )

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])

  useEffect(() => {
    const liveEventIds = new Set(events.map((event) => event.id))
    eventElementMapRef.current.forEach((_, eventId) => {
      if (!liveEventIds.has(eventId)) {
        eventElementMapRef.current.delete(eventId)
      }
    })
  }, [events])

  useEffect(() => {
    const eventElementMap = eventElementMapRef.current
    return () => {
      eventElementMap.clear()
    }
  }, [])

  const subjectOptionsForModal = useMemo(
    () => [...subjects, { id: STANDALONE_SUBJECT_ID, name: STANDALONE_SUBJECT_LABEL }],
    [subjects]
  )

  const setTaskBusy = useCallback((taskId: string, isBusy: boolean) => {
    setBusyTaskIds((previous) => {
      const next = new Set(previous)
      if (isBusy) {
        next.add(taskId)
      } else {
        next.delete(taskId)
      }
      return next
    })
  }, [])

  const openCreateModal = useCallback((day = 0) => {
    setQuickAddDay(day)
    setEditEventId(null)
    setIsModalOpen(true)
  }, [])

  const openEditModal = useCallback((eventId: string) => {
    setEditEventId(eventId)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setEditEventId(null)
  }, [])

  const handleToggleComplete = useCallback(async (taskId: string, nextCompleted: boolean) => {
    if (busyTaskIds.has(taskId)) return

    const existing = tasks.find((task) => task.id === taskId)
    if (!existing) return
    const previousCompleted = existing.completed

    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId ? { ...task, completed: nextCompleted } : task,
      ),
    )
    setTaskBusy(taskId, true)

    try {
      const result = await setTaskCompletion(taskId, nextCompleted)
      if (result.status !== "SUCCESS") {
        setTasks((previous) =>
          previous.map((task) =>
            task.id === taskId ? { ...task, completed: previousCompleted } : task,
          ),
        )
        if (result.status === "UNAUTHORIZED") {
          addToast("Please sign in again.", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(result.message || "Could not update task status.", "error")
        }
      }
    } catch {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId ? { ...task, completed: previousCompleted } : task,
        ),
      )
      addToast("Could not update task status.", "error")
    } finally {
      setTaskBusy(taskId, false)
    }
  }, [addToast, busyTaskIds, setTaskBusy, tasks])

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (busyTaskIds.has(eventId)) return

    const previousTasks = tasks
    setTasks((previous) => previous.filter((task) => task.id !== eventId))
    setTaskBusy(eventId, true)
    try {
      const result = await deleteScheduleTask(eventId)

      if (result.status === "SUCCESS") {
        addToast("Event deleted.", "success")
        return
      }

      if (result.status === "NOT_FOUND") {
        addToast("This event no longer exists.", "info")
        return
      }

      setTasks(previousTasks)

      if (result.status === "UNAUTHORIZED") {
        addToast("Sign in required to delete events.", "error")
        return
      }

      addToast(`Could not delete event: ${result.message}`, "error")
    } catch {
      setTasks(previousTasks)
      addToast("Could not delete event right now.", "error")
    } finally {
      setTaskBusy(eventId, false)
    }
  }, [addToast, busyTaskIds, setTaskBusy, tasks])

  const handleSubmitEvent = useCallback(async (draft: EventDraft, eventId?: string) => {
    if (isSavingEvent) return false

    setIsSavingEvent(true)

    const scheduledDate = weekDates[draft.day] ?? weekMeta.weekStartISO
    const durationMinutes = Math.max(15, draft.durationMinutes)

    try {
      const result = await saveTaskViaUnifiedFlow({
        taskId: eventId,
        title: draft.title,
        subjectId: draft.subjectId,
        scheduledDate,
        durationMinutes,
      })

      if (result.status === "UNAUTHORIZED") {
        addToast("Sign in required to save events.", "error")
        return false
      }

      if (result.status === "INVALID_INPUT") {
        addToast(result.message, "error")
        return false
      }

      if (result.status === "NOT_FOUND") {
        addToast("Task not found. Reloading schedule.", "info")
        await loadWeekData(weekMeta.weekStartISO)
        return false
      }

      if (result.status === "ERROR") {
        addToast(`Could not save event: ${result.message}`, "error")
        return false
      }

      await loadWeekData(weekMeta.weekStartISO)
      setActiveChipId("all")
      addToast(eventId ? "Event updated." : "Event created.", "success")
      return true
    } catch {
      addToast("Could not save event right now.", "error")
      return false
    } finally {
      setIsSavingEvent(false)
    }
  }, [addToast, isSavingEvent, loadWeekData, weekDates, weekMeta.weekStartISO, setActiveChipId])

  const handleImportFromPlanner = useCallback(async () => {
    if (isImportingPlanner) return

    setIsImportingPlanner(true)
    try {
      const result = await importPlannerSchedule(weekMeta.weekStartISO)

      if (result.status === "UNAUTHORIZED") {
        addToast("Sign in required to import planner schedule.", "error")
        return
      }

      if (result.status === "ERROR") {
        addToast(`Could not import planner schedule: ${result.message}`, "error")
        return
      }

      await loadWeekData(result.weekStartISO)
      setWeekAnchorISO(result.weekStartISO)
      setActiveChipId("all")
      setStatusFilter("all")

      if (result.tasks.length === 0) {
        addToast("No planner-generated tasks found for this week.", "info")
        return
      }

      addToast(
        `Synced ${result.tasks.length} planner task${result.tasks.length > 1 ? "s" : ""}.`,
        "success"
      )
    } catch {
      addToast("Import failed. Please try again.", "error")
    } finally {
      setIsImportingPlanner(false)
    }
  }, [addToast, isImportingPlanner, loadWeekData, weekMeta.weekStartISO, setWeekAnchorISO, setActiveChipId, setStatusFilter])

  const handleGoPrevMonth = useCallback(() => {
    setWeekAnchorISO(addMonthsISO(weekMeta.weekStartISO, -1))
  }, [weekMeta.weekStartISO, setWeekAnchorISO])

  const handleGoNextMonth = useCallback(() => {
    setWeekAnchorISO(addMonthsISO(weekMeta.weekStartISO, 1))
  }, [weekMeta.weekStartISO, setWeekAnchorISO])

  useEffect(() => {
    setTopbarState({
      enabled: true,
      weekRangeTitle: weekMeta.title,
      isCurrentWeek,
      chips: filterChips.map((chip) => ({ id: chip.id, label: chip.label })),
      activeChipId,
      statusFilter,
      isImportingPlanner,
      onChipClick: setActiveChipId,
      onStatusFilterChange: setStatusFilter,
      onAddEvent: () => openCreateModal(mobileDay),
      onImportPlanner: handleImportFromPlanner,
      onPrevWeek: handleGoPrevWeek,
      onNextWeek: handleGoNextWeek,
      onPrevMonth: handleGoPrevMonth,
      onNextMonth: handleGoNextMonth,
      onCurrentWeek: handleGoCurrentWeek,
    })
  }, [
    activeChipId,
    filterChips,
    handleGoCurrentWeek,
    handleGoNextMonth,
    handleGoNextWeek,
    handleGoPrevMonth,
    handleGoPrevWeek,
    handleImportFromPlanner,
    isImportingPlanner,
    isCurrentWeek,
    mobileDay,
    openCreateModal,
    setActiveChipId,
    setStatusFilter,
    setTopbarState,
    statusFilter,
    weekMeta.title,
  ])

  useEffect(() => () => resetTopbarState(), [resetTopbarState])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragEventId(String(event.active.id))
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragEventId(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragEventId(null)
    if (!event.over) return

    const eventId = String(event.active.id)
    const dropTarget = String(event.over.id)

    const activeEvent = eventById.get(eventId)
    if (!activeEvent) return

    const dayMatch = /^day-(\d+)$/.exec(dropTarget)
    const targetEvent = dayMatch ? null : eventById.get(dropTarget)
    const targetDay = dayMatch ? Number(dayMatch[1]) : targetEvent?.day

    if (typeof targetDay !== "number") return

    const targetDate = weekDates[targetDay]
    if (!targetDate) return

    const isCrossDayMove =
      activeEvent.day !== targetDay
      && normalizeLocalDate(activeEvent.dateISO) !== normalizeLocalDate(targetDate)
    if (isCrossDayMove) {
      const todayISO = getTodayLocalDate()
      if ((normalizeLocalDate(targetDate) ?? targetDate) < (normalizeLocalDate(todayISO) ?? todayISO)) {
        addToast("You cannot move tasks to a past date.", "error")
        return
      }
    }

    setDayOrderMap((previous) => {
      const sourceDay = activeEvent.day
      const sourceList = [...(previous[sourceDay] ?? [])]
      const targetList = sourceDay === targetDay ? sourceList : [...(previous[targetDay] ?? [])]

      const fromIndex = sourceList.indexOf(eventId)
      if (fromIndex === -1) return previous


      if (sourceDay === targetDay) {
        const toIndex = targetEvent
          ? targetList.indexOf(targetEvent.id)
          : Math.max(0, targetList.length - 1)
        if (toIndex < 0 || toIndex === fromIndex) return previous

        return {
          ...previous,
          [sourceDay]: arrayMove(sourceList, fromIndex, toIndex),
        }
      }

      sourceList.splice(fromIndex, 1)
      const pointerY = event.activatorEvent && "clientY" in event.activatorEvent
        ? Number(event.activatorEvent.clientY)
        : null

      let insertionIndex = targetEvent ? targetList.indexOf(targetEvent.id) : targetList.length
      if (!targetEvent && pointerY !== null && targetList.length > 0) {
        for (let index = 0; index < targetList.length; index++) {
          const targetId = targetList[index]
          const element = eventElementMapRef.current.get(targetId)
          if (!element) continue
          const rect = element.getBoundingClientRect()
          const midpoint = rect.top + rect.height / 2
          if (pointerY < midpoint) {
            insertionIndex = index
            break
          }
        }
      }

      const safeInsertionIndex = insertionIndex < 0 ? targetList.length : insertionIndex
      targetList.splice(safeInsertionIndex, 0, eventId)

      return {
        ...previous,
        [sourceDay]: sourceList,
        [targetDay]: targetList,
      }
    })

    if (!isCrossDayMove) {
      return
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === eventId
          ? { ...task, scheduled_date: targetDate }
          : task
      )
    )

    setTaskBusy(eventId, true)
    void (async () => {
      try {
        const result = await rescheduleTask(eventId, targetDate)
        if (result.status === "SUCCESS") return

        setTasks((previous) =>
          previous.map((task) =>
            task.id === eventId
              ? { ...task, scheduled_date: activeEvent.dateISO }
              : task
          )
        )
        void loadWeekData(weekMeta.weekStartISO)

        if (result.status === "UNAUTHORIZED") {
          addToast("Sign in required to move tasks.", "error")
        } else if (result.status === "INVALID_DATE") {
          addToast("Target date is invalid.", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(`Could not move task: ${result.message}`, "error")
        }
      } catch {
        setTasks((previous) =>
          previous.map((task) =>
            task.id === eventId
              ? { ...task, scheduled_date: activeEvent.dateISO }
              : task
          )
        )
        void loadWeekData(weekMeta.weekStartISO)
        addToast("Could not move task right now.", "error")
      } finally {
        setTaskBusy(eventId, false)
      }
    })()
  }, [addToast, eventById, loadWeekData, setDayOrderMap, setTaskBusy, weekDates, weekMeta.weekStartISO])

  return (
    <div className="page-root animate-fade-in flex h-full min-h-0 flex-col overflow-hidden">
      {isLoadingWeek ? (
        <section
          className="flex min-h-0 flex-1 items-center justify-center surface-card"
        >
          <p className="text-sm text-text-muted">
            Loading week schedule...
          </p>
        </section>
      ) : (
        <WeeklyCalendarGrid
          weekDates={weekDates}
          events={filteredEvents}
          dayOrderMap={dayOrderMap}
          eventElementMapRef={eventElementMapRef}
          activeDragEvent={activeDragEvent}
          busyTaskIds={busyTaskIds}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onQuickAdd={openCreateModal}
          onEditEvent={openEditModal}
          onDeleteEvent={handleDeleteEvent}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {isModalOpen && (
        <AddEventModal
          key={editEventId ?? `new-${quickAddDay}-${weekMeta.weekStartISO}`}
          presetDay={quickAddDay}
          initialEvent={editingEvent}
          weekDates={weekDates}
          subjectOptions={subjectOptionsForModal}
          isSaving={isSavingEvent}
          onClose={closeModal}
          onSubmit={handleSubmitEvent}
        />
      )}
    </div>
  )
}

type WeeklyCalendarGridProps = {
  weekDates: string[]
  events: CalendarEvent[]
  dayOrderMap: DayOrderMap
  eventElementMapRef: MutableRefObject<Map<string, HTMLDivElement>>
  activeDragEvent: CalendarEvent | null
  busyTaskIds: Set<string>
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
  onQuickAdd: (day: number) => void
  onEditEvent: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
  onToggleComplete: (eventId: string, nextCompleted: boolean) => void
}

function WeeklyCalendarGrid({
  weekDates,
  events,
  dayOrderMap,
  eventElementMapRef,
  activeDragEvent,
  busyTaskIds,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onQuickAdd,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: WeeklyCalendarGridProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const collisionDetectionStrategy = useMemo<CollisionDetection>(() => {
    return (args) => {
      const pointerCollisions = pointerWithin(args)
      if (pointerCollisions.length > 0) {
        const itemCollisions = pointerCollisions.filter(
          (entry) => !String(entry.id).startsWith("day-")
        )
        if (itemCollisions.length > 0) {
          return itemCollisions
        }
        return pointerCollisions
      }

      const rectCollisions = rectIntersection(args)
      if (rectCollisions.length > 0) {
        return rectCollisions
      }

      return closestCenter(args)
    }
  }, [])

  const eventsByDay = useMemo(() => {
    const grouped: Record<number, CalendarEvent[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    }

    for (const event of events) {
      grouped[event.day].push(event)
    }

    for (const day of Object.keys(grouped)) {
      const order = dayOrderMap[Number(day)] ?? []
      grouped[Number(day)].sort((a, b) => {
        const leftIndex = order.indexOf(a.id)
        const rightIndex = order.indexOf(b.id)
        if (leftIndex >= 0 && rightIndex >= 0 && leftIndex !== rightIndex) {
          return leftIndex - rightIndex
        }
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
        return a.title.localeCompare(b.title)
      })
    }

    return grouped
  }, [dayOrderMap, events])

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden surface-card"
    >
      <DndContext
        id={dndId}
        collisionDetection={collisionDetectionStrategy}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        {/* Desktop header — lg (5 cols) */}
        <div className="hidden border-b border-border-hairline lg:grid xl:hidden lg:grid-cols-5">
          {DAY_LABELS.slice(0, 5).map((label, index) => {
            const dateStr = weekDates[index]
            const isToday = dateStr === getTodayLocalDate()
            return (
            <div
              key={label}
              className={`flex flex-col items-center gap-0.5 py-2 text-center text-xs ${index < 4 ? "border-r border-border-hairline" : ""}`}
              style={
                isToday
                  ? { background: "var(--accent-selected-bg)" }
                  : undefined
              }
            >
              <span className={`font-semibold ${isToday ? "text-[--accent-selected-fg]" : "text-text-secondary"}`}>{label}</span>
              <span className={`text-[11px] ${isToday ? "text-[--accent-selected-fg]" : "text-text-muted"}`}>
                {formatDayDateLabel(dateStr)}
              </span>
            </div>
            )
          })}
        </div>
        {/* Desktop header — xl+ (7 cols) */}
        <div className="hidden border-b border-border-hairline xl:grid xl:grid-cols-7">
          {DAY_LABELS.map((label, index) => {
            const dateStr = weekDates[index]
            const isToday = dateStr === getTodayLocalDate()
            return (
            <div
              key={label}
              className={`flex flex-col items-center gap-0.5 py-2 text-center text-xs ${index < DAY_LABELS.length - 1 ? "border-r border-border-hairline" : ""}`}
              style={
                isToday
                  ? { background: "var(--accent-selected-bg)" }
                  : undefined
              }
            >
              <span className={`font-semibold ${isToday ? "text-[--accent-selected-fg]" : "text-text-secondary"}`}>{label}</span>
              <span className={`text-[11px] ${isToday ? "text-[--accent-selected-fg]" : "text-text-muted"}`}>
                {formatDayDateLabel(dateStr)}
              </span>
            </div>
            )
          })}
        </div>

        {/* Below lg: single-column day cards */}
        <div className="flex min-h-0 flex-1 flex-col gap-[var(--gap-card)] overflow-y-auto lg:hidden p-3 md:p-4">
          {DAY_LABELS.map((label, day) => {
            const dateStr = weekDates[day]
            const isToday = dateStr === getTodayLocalDate()
            return (
            <div
              key={day}
              className={`surface-card rounded-xl flex flex-col min-h-0 flex-1 ${isToday ? "border-[--accent-selected-bar]" : ""}`}
              style={isToday ? { borderLeftWidth: "3px" } : undefined}
            >
              <div className={`flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border-hairline`}
                style={isToday ? { background: "var(--accent-selected-bg)" } : undefined}
              >
                <span className={`font-semibold text-sm ${isToday ? "text-[--accent-selected-fg]" : "text-text-secondary"}`}>{label}</span>
                <span className={`text-[11px] ${isToday ? "text-[--accent-selected-fg]" : "text-text-muted"}`}>
                  {formatDayDateLabel(dateStr)}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <DayColumn
                  day={day}
                  events={eventsByDay[day]}
                  eventElementMapRef={eventElementMapRef}
                  isLast
                  busyTaskIds={busyTaskIds}
                  onQuickAdd={onQuickAdd}
                  onEditEvent={onEditEvent}
                  onDeleteEvent={onDeleteEvent}
                  onToggleComplete={onToggleComplete}
                />
              </div>
            </div>
            )
          })}
        </div>

        {/* Desktop: 5-day grid (lg) */}
        <div className="hidden min-h-0 flex-1 lg:grid xl:hidden lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((day) => (
            <DayColumn
              key={day}
              day={day}
              events={eventsByDay[day]}
              eventElementMapRef={eventElementMapRef}
              isLast={day === 4}
              busyTaskIds={busyTaskIds}
              onQuickAdd={onQuickAdd}
              onEditEvent={onEditEvent}
              onDeleteEvent={onDeleteEvent}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>

        {/* Desktop: full 7-day grid (xl+) */}
        <div className="hidden min-h-0 flex-1 xl:grid xl:grid-cols-7">
          {DAY_LABELS.map((_, day) => (
            <DayColumn
              key={day}
              day={day}
              events={eventsByDay[day]}
              eventElementMapRef={eventElementMapRef}
              isLast={day === DAY_LABELS.length - 1}
              busyTaskIds={busyTaskIds}
              onQuickAdd={onQuickAdd}
              onEditEvent={onEditEvent}
              onDeleteEvent={onDeleteEvent}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragEvent ? <DragPreviewCard event={activeDragEvent} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}
