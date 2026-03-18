"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useToast } from "@/app/components/Toast"
import {
  importPlannerSchedule,
} from "@/app/actions/schedule/importPlannerSchedule"
import {
  getScheduleWeekData,
  type ScheduleSubjectOption,
  type ScheduleWeekTask,
} from "@/app/actions/schedule/getWeekSchedule"
import { upsertScheduleTask } from "@/app/actions/schedule/upsertScheduleTask"
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"

const ROW_HEIGHT = 44
const START_HOUR = 6
const END_HOUR = 22
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
  const hour = START_HOUR + index
  return `${String(hour).padStart(2, "0")}:00`
})
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const OTHERS_SUBJECT_ID = "others"
const OTHERS_SUBJECT_LABEL = "Others"
const SLOT_OVERRIDES_KEY = "schedule-slot-overrides-v2"
const SUBJECT_ACCENTS = ["#3B82F6", "#A855F7", "#22C55E", "#F97316", "#06B6D4", "#EC4899", "#EAB308"] as const

type StatusFilter = "all" | "pending" | "completed"

type WeekRangeMeta = {
  weekStartISO: string
  weekEndISO: string
  title: string
}

type FilterChip = {
  id: string
  label: string
  subjectId: string | "all"
}

type SlotOverride = {
  day: number
  startSlot: number
}

type SlotOverrides = Record<string, SlotOverride>

type CalendarEvent = {
  id: string
  title: string
  subjectId: string
  subjectName: string
  day: number
  dateISO: string
  startSlot: number
  durationSlots: number
  completed: boolean
  priority: number
  isPlanGenerated: boolean
}

type EventDraft = {
  title: string
  subjectId: string
  day: number
  startSlot: number
  durationSlots: number
}

function toISODateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseISODate(iso: string) {
  return new Date(`${iso}T12:00:00`)
}

function addDaysISO(iso: string, days: number) {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODateLocal(date)
}

function addMonthsISO(iso: string, months: number) {
  const date = parseISODate(iso)
  date.setMonth(date.getMonth() + months)
  return toISODateLocal(date)
}

function formatWeekRangeTitle(startISO: string, endISO: string) {
  const start = parseISODate(startISO)
  const end = parseISODate(endISO)

  const startDay = String(start.getDate()).padStart(2, "0")
  const endDay = String(end.getDate()).padStart(2, "0")
  const startMonth = start.toLocaleString("en-US", { month: "long" })
  const endMonth = end.toLocaleString("en-US", { month: "long" })

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`
}

function formatDayDateLabel(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function getWeekRangeMeta(baseDate: Date): WeekRangeMeta {
  const start = new Date(baseDate)
  start.setHours(12, 0, 0, 0)

  const weekday = start.getDay()
  const diffToMonday = (weekday + 6) % 7
  start.setDate(start.getDate() - diffToMonday)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const weekStartISO = toISODateLocal(start)
  const weekEndISO = toISODateLocal(end)

  return {
    weekStartISO,
    weekEndISO,
    title: formatWeekRangeTitle(weekStartISO, weekEndISO),
  }
}

function dayIndexFromWeekStart(isoDate: string, weekStartISO: string) {
  const oneDayMs = 24 * 60 * 60 * 1000
  const start = parseISODate(weekStartISO).getTime()
  const target = parseISODate(isoDate).getTime()
  return Math.floor((target - start) / oneDayMs)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function resolveSubjectAccent(subject: string) {
  const normalized = subject.trim().toLowerCase()

  if (normalized.includes("math")) return "#3B82F6"
  if (normalized.includes("art")) return "#A855F7"
  if (normalized.includes("phys")) return "#22C55E"
  if (normalized.includes("sport")) return "#F97316"

  return SUBJECT_ACCENTS[hashString(normalized) % SUBJECT_ACCENTS.length]
}

function readSlotOverrides(): SlotOverrides {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(SLOT_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SlotOverrides
    return parsed ?? {}
  } catch {
    return {}
  }
}

function mapTasksToEvents(
  tasks: ScheduleWeekTask[],
  weekStartISO: string,
  subjectNameById: Map<string, string>,
  activeSubjectIds: Set<string>,
  slotOverrides: SlotOverrides
) {
  const cursorByDay = Array.from({ length: 7 }, () => 0)

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCompare !== 0) return dateCompare

    const completedCompare = Number(a.completed) - Number(b.completed)
    if (completedCompare !== 0) return completedCompare

    const priorityCompare = a.priority - b.priority
    if (priorityCompare !== 0) return priorityCompare

    return a.created_at.localeCompare(b.created_at)
  })

  const mapped: CalendarEvent[] = []

  for (const task of sortedTasks) {
    const day = dayIndexFromWeekStart(task.scheduled_date, weekStartISO)
    if (day < 0 || day >= 7) continue

    const normalizedSubjectId =
      task.subject_id && activeSubjectIds.has(task.subject_id)
        ? task.subject_id
        : OTHERS_SUBJECT_ID

    const subjectName =
      normalizedSubjectId === OTHERS_SUBJECT_ID
        ? OTHERS_SUBJECT_LABEL
        : subjectNameById.get(normalizedSubjectId) ?? task.subject_name ?? OTHERS_SUBJECT_LABEL

    const durationSlots = clamp(Math.ceil(task.duration_minutes / 60), 1, TIME_SLOTS.length)
    const maxStartSlot = Math.max(0, TIME_SLOTS.length - durationSlots)
    const override = slotOverrides[task.id]
    const fallbackStart = clamp(cursorByDay[day], 0, maxStartSlot)

    const startSlot =
      override && override.day === day
        ? clamp(override.startSlot, 0, maxStartSlot)
        : fallbackStart

    cursorByDay[day] = Math.max(cursorByDay[day], startSlot + durationSlots)

    mapped.push({
      id: task.id,
      title: task.title,
      subjectId: normalizedSubjectId,
      subjectName,
      day,
      dateISO: task.scheduled_date,
      startSlot,
      durationSlots,
      completed: task.completed,
      priority: task.priority,
      isPlanGenerated: task.is_plan_generated,
    })
  }

  return mapped
}

export default function SchedulePage() {
  const { addToast } = useToast()

  const [tasks, setTasks] = useState<ScheduleWeekTask[]>([])
  const [subjects, setSubjects] = useState<ScheduleSubjectOption[]>([])
  const [weekAnchorISO, setWeekAnchorISO] = useState(() => toISODateLocal(new Date()))
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [activeChipId, setActiveChipId] = useState("all")
  const [isLoadingWeek, setIsLoadingWeek] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [quickAddDay, setQuickAddDay] = useState(0)
  const [activeDragEventId, setActiveDragEventId] = useState<string | null>(null)
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set())
  const [slotOverrides, setSlotOverrides] = useState<SlotOverrides>({})
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [isImportingPlanner, setIsImportingPlanner] = useState(false)

  const weekMeta = useMemo(() => getWeekRangeMeta(parseISODate(weekAnchorISO)), [weekAnchorISO])

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, day) => addDaysISO(weekMeta.weekStartISO, day)),
    [weekMeta.weekStartISO]
  )

  useEffect(() => {
    setSlotOverrides(readSlotOverrides())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SLOT_OVERRIDES_KEY, JSON.stringify(slotOverrides))
  }, [slotOverrides])

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
  }, [addToast])

  useEffect(() => {
    void loadWeekData(weekMeta.weekStartISO)
  }, [loadWeekData, weekMeta.weekStartISO])

  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  )

  const activeSubjectIds = useMemo(
    () => new Set(subjects.map((subject) => subject.id)),
    [subjects]
  )

  const filterChips = useMemo<FilterChip[]>(() => {
    return [
      { id: "all", label: "All", subjectId: "all" },
      ...subjects.map((subject) => ({
        id: `subject-${subject.id}`,
        label: subject.name,
        subjectId: subject.id,
      })),
      { id: `subject-${OTHERS_SUBJECT_ID}`, label: OTHERS_SUBJECT_LABEL, subjectId: OTHERS_SUBJECT_ID },
    ]
  }, [subjects])

  useEffect(() => {
    if (filterChips.some((chip) => chip.id === activeChipId)) return
    setActiveChipId("all")
  }, [activeChipId, filterChips])

  const selectedChip = useMemo(
    () => filterChips.find((chip) => chip.id === activeChipId) ?? filterChips[0],
    [activeChipId, filterChips]
  )

  const events = useMemo(
    () => mapTasksToEvents(tasks, weekMeta.weekStartISO, subjectNameById, activeSubjectIds, slotOverrides),
    [tasks, weekMeta.weekStartISO, subjectNameById, activeSubjectIds, slotOverrides]
  )

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSubject =
        selectedChip.subjectId === "all" || selectedChip.subjectId === event.subjectId
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "completed"
            ? event.completed
            : !event.completed

      return matchesSubject && matchesStatus
    })
  }, [events, selectedChip, statusFilter])

  const editingEvent = useMemo(
    () => events.find((event) => event.id === editEventId) ?? null,
    [events, editEventId]
  )

  const activeDragEvent = useMemo(
    () => events.find((event) => event.id === activeDragEventId) ?? null,
    [events, activeDragEventId]
  )

  const subjectOptionsForModal = useMemo(
    () => [...subjects, { id: OTHERS_SUBJECT_ID, name: OTHERS_SUBJECT_LABEL }],
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

    const targetTask = tasks.find((task) => task.id === taskId)
    if (!targetTask) return

    setTaskBusy(taskId, true)
    setTasks((previous) =>
      previous.map((task) => (task.id === taskId ? { ...task, completed: nextCompleted } : task))
    )

    try {
      if (nextCompleted) {
        await completeTask(taskId)
      } else {
        await uncompleteTask(taskId)
      }
    } catch {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId ? { ...task, completed: targetTask.completed } : task
        )
      )
      addToast("Could not update task status.", "error")
    } finally {
      setTaskBusy(taskId, false)
    }
  }, [addToast, busyTaskIds, setTaskBusy, tasks])

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (busyTaskIds.has(eventId)) return

    setTaskBusy(eventId, true)
    try {
      const result = await deleteScheduleTask(eventId)

      if (result.status === "SUCCESS") {
        setTasks((previous) => previous.filter((task) => task.id !== eventId))
        setSlotOverrides((previous) => {
          const next = { ...previous }
          delete next[eventId]
          return next
        })
        addToast("Event deleted.", "success")
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Sign in required to delete events.", "error")
        return
      }

      if (result.status === "NOT_FOUND") {
        setTasks((previous) => previous.filter((task) => task.id !== eventId))
        addToast("This event no longer exists.", "info")
        return
      }

      addToast(`Could not delete event: ${result.message}`, "error")
    } catch {
      addToast("Could not delete event right now.", "error")
    } finally {
      setTaskBusy(eventId, false)
    }
  }, [addToast, busyTaskIds, setTaskBusy])

  const handleSubmitEvent = useCallback(async (draft: EventDraft, eventId?: string) => {
    if (isSavingEvent) return false

    setIsSavingEvent(true)

    const scheduledDate = weekDates[draft.day] ?? weekMeta.weekStartISO
    const durationMinutes = Math.max(15, draft.durationSlots * 60)

    try {
      const result = await upsertScheduleTask({
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

      setSlotOverrides((previous) => ({
        ...previous,
        [result.taskId]: {
          day: draft.day,
          startSlot: draft.startSlot,
        },
      }))

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
  }, [addToast, isSavingEvent, loadWeekData, weekDates, weekMeta.weekStartISO])

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
  }, [addToast, isImportingPlanner, loadWeekData, weekMeta.weekStartISO])

  const handleGoPrevWeek = useCallback(() => {
    setWeekAnchorISO(addDaysISO(weekMeta.weekStartISO, -7))
  }, [weekMeta.weekStartISO])

  const handleGoNextWeek = useCallback(() => {
    setWeekAnchorISO(addDaysISO(weekMeta.weekStartISO, 7))
  }, [weekMeta.weekStartISO])

  const handleGoPrevMonth = useCallback(() => {
    setWeekAnchorISO(addMonthsISO(weekMeta.weekStartISO, -1))
  }, [weekMeta.weekStartISO])

  const handleGoNextMonth = useCallback(() => {
    setWeekAnchorISO(addMonthsISO(weekMeta.weekStartISO, 1))
  }, [weekMeta.weekStartISO])

  const handleGoCurrentWeek = useCallback(() => {
    setWeekAnchorISO(toISODateLocal(new Date()))
  }, [])

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
    const match = /^slot-(\d+)-(\d+)$/.exec(dropTarget)
    if (!match) return

    const targetDay = Number(match[1])
    const targetSlot = Number(match[2])
    const targetDate = weekDates[targetDay]
    if (!targetDate) return

    const activeEvent = events.find((item) => item.id === eventId)
    if (!activeEvent) return

    const nextStartSlot = clamp(targetSlot, 0, Math.max(0, TIME_SLOTS.length - activeEvent.durationSlots))
    setSlotOverrides((previous) => ({
      ...previous,
      [eventId]: {
        day: targetDay,
        startSlot: nextStartSlot,
      },
    }))

    if (activeEvent.dateISO === targetDate) {
      return
    }

    const todayISO = toISODateLocal(new Date())
    if (targetDate < todayISO) {
      addToast("You cannot move tasks to a past date.", "error")
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
        addToast("Could not move task right now.", "error")
      } finally {
        setTaskBusy(eventId, false)
      }
    })()
  }, [addToast, events, setTaskBusy, weekDates])

  return (
    <div className="page-root animate-fade-in space-y-3">
      <ScheduleHeader
        weekRangeTitle={weekMeta.title}
        filterChips={filterChips}
        activeChipId={activeChipId}
        onChipClick={setActiveChipId}
        onAddEvent={() => openCreateModal(0)}
        onImportPlanner={handleImportFromPlanner}
        isImportingPlanner={isImportingPlanner}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onPrevWeek={handleGoPrevWeek}
        onNextWeek={handleGoNextWeek}
        onPrevMonth={handleGoPrevMonth}
        onNextMonth={handleGoNextMonth}
        onCurrentWeek={handleGoCurrentWeek}
      />

      {isLoadingWeek ? (
        <section
          className="flex h-[66vh] items-center justify-center rounded-2xl border"
          style={{
            borderColor: "var(--sh-border)",
            background: "var(--sh-card)",
            boxShadow: "var(--sh-shadow-sm)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
            Loading week schedule...
          </p>
        </section>
      ) : (
        <WeeklyCalendarGrid
          weekDates={weekDates}
          events={filteredEvents}
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

type ScheduleHeaderProps = {
  weekRangeTitle: string
  filterChips: FilterChip[]
  activeChipId: string
  onChipClick: (chipId: string) => void
  onAddEvent: () => void
  onImportPlanner: () => void
  isImportingPlanner: boolean
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onCurrentWeek: () => void
}

function ScheduleHeader({
  weekRangeTitle,
  filterChips,
  activeChipId,
  onChipClick,
  onAddEvent,
  onImportPlanner,
  isImportingPlanner,
  statusFilter,
  onStatusFilterChange,
  onPrevWeek,
  onNextWeek,
  onPrevMonth,
  onNextMonth,
  onCurrentWeek,
}: ScheduleHeaderProps) {
  return (
    <header
      className="space-y-3 rounded-xl border p-4"
      style={{
        background: "var(--sh-card)",
        borderColor: "var(--sh-border)",
        boxShadow: "var(--sh-shadow-sm)",
      }}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
          {weekRangeTitle}
        </h1>

        <div className="flex flex-wrap gap-1.5">
          <HeaderNavButton label="- Month" onClick={onPrevMonth} />
          <HeaderNavButton label="- Week" onClick={onPrevWeek} />
          <HeaderNavButton label="Current" onClick={onCurrentWeek} />
          <HeaderNavButton label="Week +" onClick={onNextWeek} />
          <HeaderNavButton label="Month +" onClick={onNextMonth} />
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterChips.map((chip) => {
            const active = chip.id === activeChipId
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChipClick(chip.id)}
                className="cursor-pointer rounded-full border px-3 py-1.5 text-xs transition"
                style={
                  active
                    ? {
                        background: "var(--sh-text-primary)",
                        color: "var(--background)",
                        borderColor: "transparent",
                      }
                    : {
                        background: "var(--sh-card)",
                        borderColor: "var(--sh-border)",
                        color: "var(--sh-text-secondary)",
                      }
                }
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}
            className="rounded border px-3 py-1.5 text-xs"
            style={{
              borderColor: "var(--sh-border)",
              color: "var(--sh-text-secondary)",
              background: "var(--sh-card)",
            }}
            aria-label="Filter by completion status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>

          <button
            type="button"
            onClick={onImportPlanner}
            disabled={isImportingPlanner}
            className="rounded border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--sh-border)",
              color: "var(--sh-text-secondary)",
              background: "var(--sh-card)",
            }}
          >
            {isImportingPlanner ? "Syncing..." : "Import schedule from planner"}
          </button>

          <button
            type="button"
            onClick={onAddEvent}
            className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            + Add Event
          </button>
        </div>
      </div>
    </header>
  )
}

type HeaderNavButtonProps = {
  label: string
  onClick: () => void
}

function HeaderNavButton({ label, onClick }: HeaderNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border px-2.5 py-1.5 text-xs transition"
      style={{
        borderColor: "var(--sh-border)",
        color: "var(--sh-text-secondary)",
        background: "var(--sh-card)",
      }}
    >
      {label}
    </button>
  )
}

type WeeklyCalendarGridProps = {
  weekDates: string[]
  events: CalendarEvent[]
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

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
      grouped[Number(day)].sort((a, b) => {
        if (a.startSlot !== b.startSlot) return a.startSlot - b.startSlot
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
        return a.priority - b.priority
      })
    }

    return grouped
  }, [events])

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--sh-border)",
        background: "var(--sh-card)",
        boxShadow: "var(--sh-shadow-sm)",
      }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <div
          className="grid border-b"
          style={{
            borderColor: "var(--sh-border)",
            gridTemplateColumns: "68px repeat(7, minmax(0, 1fr))",
          }}
        >
          <div
            className="border-r"
            style={{
              borderColor: "var(--sh-border)",
              background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
            }}
          />
          {DAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-0.5 py-2 text-center text-xs ${index < DAY_LABELS.length - 1 ? "border-r" : ""}`}
              style={{
                color: "var(--sh-text-secondary)",
                borderColor: "var(--sh-border)",
              }}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                {formatDayDateLabel(weekDates[index])}
              </span>
            </div>
          ))}
        </div>

        <div className="max-h-[72vh] overflow-y-auto">
          <div
            className="grid"
            style={{ gridTemplateColumns: "68px repeat(7, minmax(0, 1fr))" }}
          >
            <TimeColumn />

            {DAY_LABELS.map((_, day) => (
              <DayColumn
                key={day}
                day={day}
                events={eventsByDay[day]}
                isLast={day === DAY_LABELS.length - 1}
                busyTaskIds={busyTaskIds}
                onQuickAdd={onQuickAdd}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeDragEvent ? <DragPreviewCard event={activeDragEvent} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}

function TimeColumn() {
  return (
    <div
      className="border-r"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
      }}
    >
      {TIME_SLOTS.map((time) => (
        <div
          key={time}
          className="border-b pr-2 pt-1 text-right text-[11px]"
          style={{
            height: ROW_HEIGHT,
            color: "var(--sh-text-muted)",
            borderColor: "var(--sh-border)",
          }}
        >
          {time}
        </div>
      ))}
      <div className="h-10 border-b" style={{ borderColor: "var(--sh-border)" }} />
    </div>
  )
}

type DayColumnProps = {
  day: number
  events: CalendarEvent[]
  isLast: boolean
  busyTaskIds: Set<string>
  onQuickAdd: (day: number) => void
  onEditEvent: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
  onToggleComplete: (eventId: string, nextCompleted: boolean) => void
}

function DayColumn({
  day,
  events,
  isLast,
  busyTaskIds,
  onQuickAdd,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: DayColumnProps) {
  return (
    <div className={isLast ? "" : "border-r"} style={{ borderColor: "var(--sh-border)" }}>
      <div className="relative" style={{ height: TIME_SLOTS.length * ROW_HEIGHT }}>
        {TIME_SLOTS.map((_, slotIndex) => (
          <DroppableSlot key={`slot-${day}-${slotIndex}`} day={day} slot={slotIndex} />
        ))}

        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            busy={busyTaskIds.has(event.id)}
            onEdit={() => onEditEvent(event.id)}
            onDelete={() => onDeleteEvent(event.id)}
            onToggleComplete={() => onToggleComplete(event.id, !event.completed)}
          />
        ))}
      </div>

      <div className="flex h-10 items-center justify-center border-t" style={{ borderColor: "var(--sh-border)" }}>
        <QuickAddButton onClick={() => onQuickAdd(day)} />
      </div>
    </div>
  )
}

function DroppableSlot({ day, slot }: { day: number; slot: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${day}-${slot}` })

  return (
    <div
      ref={setNodeRef}
      className="border-b transition-colors"
      style={{
        height: ROW_HEIGHT,
        borderColor: "var(--sh-border)",
        background: isOver
          ? "color-mix(in srgb, var(--accent) 22%, transparent)"
          : "transparent",
      }}
      aria-label={`${DAY_LABELS[day]} ${TIME_SLOTS[slot]} slot`}
    />
  )
}

type EventCardProps = {
  event: CalendarEvent
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}

function EventCard({ event, busy, onEdit, onDelete, onToggleComplete }: EventCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  })

  const palette = getSubjectPalette(event.subjectName)
  const dragTransform = CSS.Translate.toString(transform)

  return (
    <div
      ref={setNodeRef}
      style={{
        top: event.startSlot * ROW_HEIGHT,
        height: event.durationSlots * ROW_HEIGHT,
        transform: dragTransform,
        transition: "transform 180ms ease-out, box-shadow 180ms ease-out",
        zIndex: isDragging ? 50 : 20,
      }}
      className="absolute left-1 right-1"
    >
      <div
        {...attributes}
        {...listeners}
        className={`h-full cursor-grab rounded-md border p-2 text-xs shadow-sm transition duration-200 ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-xl"
            : "hover:-translate-y-0.5 hover:shadow-md"
        }`}
        style={palette.containerStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation()
                  onToggleComplete()
                }}
                disabled={busy}
                className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] disabled:opacity-50"
                style={{
                  borderColor: event.completed ? "#34D399" : "var(--sh-border)",
                  background: event.completed ? "rgba(52, 211, 153, 0.18)" : "transparent",
                  color: event.completed ? "#34D399" : "var(--sh-text-muted)",
                }}
                aria-label={event.completed ? "Mark as pending" : "Mark as completed"}
              >
                {event.completed ? "\u2713" : ""}
              </button>

              <div className="min-w-0">
                <div
                  className="truncate font-semibold"
                  style={{
                    color: "var(--sh-text-primary)",
                    textDecoration: event.completed ? "line-through" : "none",
                    opacity: event.completed ? 0.7 : 1,
                  }}
                >
                  {event.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                    style={event.completed ? COMPLETED_BADGE_STYLE : PENDING_BADGE_STYLE}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.accent }} />
                    {event.completed ? "Completed" : "Pending"}
                  </span>
                  <span style={{ color: "var(--sh-text-muted)" }}>{event.subjectName}</span>
                  <span style={{ color: "var(--sh-text-muted)" }}>
                    {event.durationSlots}h
                  </span>
                  {event.isPlanGenerated && (
                    <span style={{ color: "var(--sh-text-muted)" }}>Planner</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
            <EventMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DragPreviewCard({ event }: { event: CalendarEvent }) {
  const palette = getSubjectPalette(event.subjectName)

  return (
    <div
      className="w-56 rounded-md border p-2 text-xs shadow-2xl"
      style={{
        transform: "scale(1.03)",
        cursor: "grabbing",
        ...palette.containerStyle,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            {event.title}
          </div>
          <span
            className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={event.completed ? COMPLETED_BADGE_STYLE : PENDING_BADGE_STYLE}
          >
            {event.completed ? "Completed" : "Pending"}
          </span>
        </div>
        <span style={{ color: "var(--sh-text-muted)" }}>...</span>
      </div>
    </div>
  )
}

type QuickAddButtonProps = {
  onClick: () => void
}

function QuickAddButton({ onClick }: QuickAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border shadow transition hover:shadow-md"
      style={{
        background: "var(--sh-card)",
        borderColor: "var(--sh-border)",
        color: "var(--sh-text-secondary)",
      }}
      aria-label="Quick add event"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

type EventMenuProps = {
  onEdit: () => void
  onDelete: () => void
}

function EventMenu({ onEdit, onDelete }: EventMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="rounded p-1 transition"
        style={{ color: "var(--sh-text-muted)" }}
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Event menu"
      >
        ...
      </button>

      {open && (
        <div
          className="absolute right-0 top-7 z-50 min-w-[110px] rounded-md border p-1"
          style={{
            background: "var(--sh-card)",
            borderColor: "var(--sh-border)",
            boxShadow: "var(--sh-shadow)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="w-full rounded px-3 py-1.5 text-left text-xs transition"
            style={{ color: "var(--sh-text-secondary)" }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="w-full rounded px-3 py-1.5 text-left text-xs text-red-500 transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

type AddEventModalProps = {
  presetDay: number
  initialEvent: CalendarEvent | null
  weekDates: string[]
  subjectOptions: ScheduleSubjectOption[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (draft: EventDraft, eventId?: string) => Promise<boolean>
}

function AddEventModal({
  presetDay,
  initialEvent,
  weekDates,
  subjectOptions,
  isSaving,
  onClose,
  onSubmit,
}: AddEventModalProps) {
  const firstSubject = subjectOptions[0]?.id ?? OTHERS_SUBJECT_ID

  const [title, setTitle] = useState(() => initialEvent?.title ?? "")
  const [subjectId, setSubjectId] = useState<string>(() => initialEvent?.subjectId ?? firstSubject)
  const [day, setDay] = useState<number>(() => initialEvent?.day ?? presetDay)
  const [startSlot, setStartSlot] = useState<number>(() => initialEvent?.startSlot ?? 0)
  const [durationSlots, setDurationSlots] = useState<number>(
    () => initialEvent?.durationSlots ?? 1
  )

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose()
    }

    document.addEventListener("keydown", onEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onEscape)
      document.body.style.overflow = ""
    }
  }, [isSaving, onClose])

  const maxDuration = Math.max(1, TIME_SLOTS.length - startSlot)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle || isSaving) return

    const success = await onSubmit(
      {
        title: trimmedTitle,
        subjectId,
        day,
        startSlot,
        durationSlots,
      },
      initialEvent?.id
    )

    if (success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        onClick={() => {
          if (!isSaving) onClose()
        }}
        aria-label="Close modal"
      />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border p-5"
        style={{
          background: "var(--sh-card)",
          borderColor: "var(--sh-border)",
          boxShadow: "var(--sh-shadow-lg)",
        }}
      >
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>
          {initialEvent ? "Edit Event" : "Add Event"}
        </h2>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={FIELD_INPUT_CLASS}
              style={FIELD_INPUT_STYLE}
              placeholder="Enter event title"
              disabled={isSaving}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className={FIELD_INPUT_CLASS}
                style={FIELD_INPUT_STYLE}
                disabled={isSaving}
              >
                {subjectOptions.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Day">
              <select
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
                className={FIELD_INPUT_CLASS}
                style={FIELD_INPUT_STYLE}
                disabled={isSaving}
              >
                {DAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}, {formatDayDateLabel(weekDates[index])}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <select
                value={startSlot}
                onChange={(event) => {
                  const nextStartSlot = Number(event.target.value)
                  setStartSlot(nextStartSlot)
                  const nextMaxDuration = Math.max(1, TIME_SLOTS.length - nextStartSlot)
                  setDurationSlots((previous) => Math.min(previous, nextMaxDuration))
                }}
                className={FIELD_INPUT_CLASS}
                style={FIELD_INPUT_STYLE}
                disabled={isSaving}
              >
                {TIME_SLOTS.map((time, index) => (
                  <option key={time} value={index}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Duration">
              <select
                value={durationSlots}
                onChange={(event) => setDurationSlots(Number(event.target.value))}
                className={FIELD_INPUT_CLASS}
                style={FIELD_INPUT_STYLE}
                disabled={isSaving}
              >
                {Array.from({ length: maxDuration }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value} hour{value > 1 ? "s" : ""}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : initialEvent ? "Save Event" : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const FIELD_INPUT_CLASS =
  "w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:border-indigo-500"

const FIELD_INPUT_STYLE: CSSProperties = {
  background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
  borderColor: "var(--sh-border)",
  color: "var(--sh-text-primary)",
}

const COMPLETED_BADGE_STYLE: CSSProperties = {
  background: "color-mix(in srgb, #10B981 28%, transparent)",
  color: "#34D399",
}

const PENDING_BADGE_STYLE: CSSProperties = {
  background: "color-mix(in srgb, #F59E0B 28%, transparent)",
  color: "#FBBF24",
}

function getSubjectPalette(subject: string) {
  const accent = resolveSubjectAccent(subject)
  return {
    accent,
    containerStyle: {
      background: `color-mix(in srgb, var(--sh-card) 76%, ${accent} 24%)`,
      borderColor: `color-mix(in srgb, ${accent} 52%, transparent)`,
      color: "var(--sh-text-primary)",
    } as CSSProperties,
  }
}
