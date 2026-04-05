"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
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
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
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
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"
import { setTaskCompletion } from "@/app/actions/plan/setTaskCompletion"
import { rescheduleTask } from "@/app/actions/plan/rescheduleTask"
import {
  useScheduleTopbar,
  type ScheduleTopbarStatusFilter,
} from "@/app/components/layout/ScheduleTopbarContext"
import { saveTaskViaUnifiedFlow } from "@/app/components/tasks/taskWriteGateway"
import { STANDALONE_SUBJECT_ID, STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import {
  getTasksForDate,
  getTodayLocalDate,
  normalizeLocalDate,
} from "@/lib/tasks/getTasksForDate"

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const SUBJECT_ACCENTS = ["#3B82F6", "#A855F7", "#22C55E", "#F97316", "#06B6D4", "#EC4899", "#EAB308"] as const
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const
const DAY_ORDER_STORAGE_KEY = "schedule-day-order-v1"

type StatusFilter = ScheduleTopbarStatusFilter

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

type CalendarEvent = {
  id: string
  title: string
  subjectId: string
  subjectName: string
  day: number
  dateISO: string
  durationMinutes: number
  completed: boolean
}

type EventDraft = {
  title: string
  subjectId: string
  day: number
  durationMinutes: number
}

type DayOrderMap = Record<number, string[]>
type DayOrderStorage = Record<string, DayOrderMap>

function parseISODate(iso: string) {
  const normalized = normalizeLocalDate(iso)
  if (!normalized) return new Date(Number.NaN)

  const parts = normalized.split("-")
  if (parts.length !== 3) return new Date(Number.NaN)

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date(Number.NaN)
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function addDaysISO(iso: string, days: number) {
  const date = parseISODate(iso)
  if (Number.isNaN(date.getTime())) return getTodayLocalDate()
  date.setDate(date.getDate() + days)
  return normalizeLocalDate(date) ?? getTodayLocalDate()
}

function addMonthsISO(iso: string, months: number) {
  const date = parseISODate(iso)
  if (Number.isNaN(date.getTime())) return getTodayLocalDate()
  date.setMonth(date.getMonth() + months)
  return normalizeLocalDate(date) ?? getTodayLocalDate()
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

  const weekStartISO = normalizeLocalDate(start) ?? getTodayLocalDate()
  const weekEndISO = normalizeLocalDate(end) ?? weekStartISO

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

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

function emptyDayOrderMap(): DayOrderMap {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
}

function readDayOrderStorage(): DayOrderStorage {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(DAY_ORDER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DayOrderStorage
    return parsed ?? {}
  } catch {
    return {}
  }
}

function writeDayOrderStorage(next: DayOrderStorage) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DAY_ORDER_STORAGE_KEY, JSON.stringify(next))
}

function mapTasksToEvents(
  tasks: ScheduleWeekTask[],
  weekDates: string[],
  subjectNameById: Map<string, string>
) {
  const mapped: CalendarEvent[] = []

  for (const [day, dayISO] of weekDates.entries()) {
    const dayTasks = [...getTasksForDate(tasks, dayISO)].sort((a, b) => {
      const completedCompare = Number(a.completed) - Number(b.completed)
      if (completedCompare !== 0) return completedCompare
      return a.created_at.localeCompare(b.created_at)
    })

    for (const task of dayTasks) {
      const isStandalone = task.task_type === "standalone" || !task.subject_id

      const normalizedSubjectId = isStandalone
        ? STANDALONE_SUBJECT_ID
        : task.subject_id!

      const subjectName = isStandalone
        ? STANDALONE_SUBJECT_LABEL
        : subjectNameById.get(normalizedSubjectId) ?? task.subject_name ?? "Unknown subject"

      mapped.push({
        id: task.id,
        title: task.title,
        subjectId: normalizedSubjectId,
        subjectName,
        day,
        dateISO: normalizeLocalDate(task.scheduled_date) ?? task.scheduled_date,
        durationMinutes: Math.max(15, task.duration_minutes),
        completed: task.completed,
      })
    }
  }

  return mapped
}

export default function SchedulePage() {
  const { addToast } = useToast()
  const { setState: setTopbarState, resetState: resetTopbarState } = useScheduleTopbar()

  const [tasks, setTasks] = useState<ScheduleWeekTask[]>([])
  const [subjects, setSubjects] = useState<ScheduleSubjectOption[]>([])
  const [weekAnchorISO, setWeekAnchorISO] = useState(() => getTodayLocalDate())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [activeChipId, setActiveChipId] = useState("all")
  const [isLoadingWeek, setIsLoadingWeek] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [quickAddDay, setQuickAddDay] = useState(0)
  const [mobileDay, setMobileDay] = useState(0)
  const [dayOrderMap, setDayOrderMap] = useState<DayOrderMap>(emptyDayOrderMap)
  const [didHydrateDayOrder, setDidHydrateDayOrder] = useState(false)
  const [activeDragEventId, setActiveDragEventId] = useState<string | null>(null)
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set())
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [isImportingPlanner, setIsImportingPlanner] = useState(false)
  const eventElementMapRef = useRef<Map<string, HTMLDivElement>>(new Map())

  const weekMeta = useMemo(() => getWeekRangeMeta(parseISODate(weekAnchorISO)), [weekAnchorISO])
  const currentWeekStartISO = useMemo(() => getWeekRangeMeta(new Date()).weekStartISO, [])
  const isCurrentWeek = weekMeta.weekStartISO === currentWeekStartISO

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, day) => addDaysISO(weekMeta.weekStartISO, day)),
    [weekMeta.weekStartISO]
  )

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

  useEffect(() => {
    const todayISO = getTodayLocalDate()
    const nextDay = dayIndexFromWeekStart(todayISO, weekMeta.weekStartISO)
    setMobileDay(clamp(nextDay, 0, 6))
  }, [weekMeta.weekStartISO])

  useEffect(() => {
    const storage = readDayOrderStorage()
    setDayOrderMap(storage[weekMeta.weekStartISO] ?? emptyDayOrderMap())
    setDidHydrateDayOrder(true)
  }, [weekMeta.weekStartISO])

  useEffect(() => {
    if (!didHydrateDayOrder) return
    const storage = readDayOrderStorage()
    writeDayOrderStorage({
      ...storage,
      [weekMeta.weekStartISO]: dayOrderMap,
    })
  }, [dayOrderMap, didHydrateDayOrder, weekMeta.weekStartISO])

  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
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
      {
        id: `subject-${STANDALONE_SUBJECT_ID}`,
        label: STANDALONE_SUBJECT_LABEL,
        subjectId: STANDALONE_SUBJECT_ID,
      },
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
    () => mapTasksToEvents(tasks, weekDates, subjectNameById),
    [tasks, weekDates, subjectNameById]
  )

  useEffect(() => {
    setDayOrderMap((previous) => {
      const next: DayOrderMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

      for (let day = 0; day < 7; day++) {
        const dayIds = events.filter((event) => event.day === day).map((event) => event.id)
        const previousForDay = previous[day] ?? []
        const kept = previousForDay.filter((id) => dayIds.includes(id))
        const missing = dayIds.filter((id) => !kept.includes(id))
        next[day] = [...kept, ...missing]
      }

      return next
    })
  }, [events])

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

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])

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

    if (!tasks.some((task) => task.id === taskId)) return

    setTaskBusy(taskId, true)

    try {
      const result = await setTaskCompletion(taskId, nextCompleted)
      if (result.status !== "SUCCESS") {
        if (result.status === "UNAUTHORIZED") {
          addToast("Please sign in again.", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(result.message || "Could not update task status.", "error")
        }
        return
      }

      await loadWeekData(weekMeta.weekStartISO)
    } catch {
      addToast("Could not update task status.", "error")
    } finally {
      setTaskBusy(taskId, false)
    }
  }, [addToast, busyTaskIds, loadWeekData, setTaskBusy, tasks, weekMeta.weekStartISO])

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (busyTaskIds.has(eventId)) return

    setTaskBusy(eventId, true)
    try {
      const result = await deleteScheduleTask(eventId)

      if (result.status === "SUCCESS") {
        setTasks((previous) => previous.filter((task) => task.id !== eventId))
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
    setWeekAnchorISO(getTodayLocalDate())
  }, [])

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
  }, [addToast, eventById, loadWeekData, setTaskBusy, weekDates, weekMeta.weekStartISO])

  return (
    <div className="page-root animate-fade-in flex h-full min-h-0 flex-col overflow-hidden">
      {isLoadingWeek ? (
        <section
          className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border"
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
          dayOrderMap={dayOrderMap}
          eventElementMapRef={eventElementMapRef}
          activeDragEvent={activeDragEvent}
          busyTaskIds={busyTaskIds}
          mobileDay={mobileDay}
          onMobileDayChange={setMobileDay}
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
  mobileDay: number
  onMobileDayChange: (day: number) => void
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
  mobileDay,
  onMobileDayChange,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onQuickAdd,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: WeeklyCalendarGridProps) {
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--sh-border)",
        background: "var(--sh-card)",
        boxShadow: "var(--sh-shadow-sm)",
      }}
    >
      <DndContext
        collisionDetection={collisionDetectionStrategy}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <div
            className="hidden border-b md:grid md:grid-cols-7"
            style={{ borderColor: "var(--sh-border)" }}
        >
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

        <div className="border-b p-2 md:hidden" style={{ borderColor: "var(--sh-border)" }}>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {DAY_LABELS.map((label, index) => {
              const isActive = index === mobileDay
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onMobileDayChange(index)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={
                    isActive
                      ? {
                          color: "#fff",
                          background: "var(--sh-primary)",
                          borderColor: "transparent",
                        }
                      : {
                          color: "var(--sh-text-secondary)",
                          background: "var(--sh-card)",
                          borderColor: "var(--sh-border)",
                        }
                  }
                >
                  {label} {formatDayDateLabel(weekDates[index])}
                </button>
              )
            })}
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-7">
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

        <div className="min-h-0 flex-1 md:hidden">
          <DayColumn
            day={mobileDay}
            events={eventsByDay[mobileDay]}
            eventElementMapRef={eventElementMapRef}
            isLast
            busyTaskIds={busyTaskIds}
            onQuickAdd={onQuickAdd}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
            onToggleComplete={onToggleComplete}
          />
        </div>

        <DragOverlay>
          {activeDragEvent ? <DragPreviewCard event={activeDragEvent} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}

type DayColumnProps = {
  day: number
  events: CalendarEvent[]
  eventElementMapRef: MutableRefObject<Map<string, HTMLDivElement>>
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
  eventElementMapRef,
  isLast,
  busyTaskIds,
  onQuickAdd,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  return (
    <div
      ref={setNodeRef}
      className={isLast ? "flex h-full min-h-0 flex-col" : "flex h-full min-h-0 flex-col border-r"}
      style={{
        borderColor: "var(--sh-border)",
        background: isOver ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
      }}
    >
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
        style={{
          height: "100%",
        }}
      >
        {events.length === 0 ? (
          <div
            className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed text-xs"
            style={{
              borderColor: isOver ? "var(--sh-primary)" : "var(--sh-border)",
              color: isOver ? "var(--sh-text-primary)" : "var(--sh-text-muted)",
            }}
          >
            {isOver ? "Release to move task" : "No tasks for this day"}
          </div>
        ) : (
          <SortableContext
            items={events.map((event) => event.id)}
            strategy={verticalListSortingStrategy}
          >
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                registerElement={(element) => {
                  if (element) {
                    eventElementMapRef.current.set(event.id, element)
                  } else {
                    eventElementMapRef.current.delete(event.id)
                  }
                }}
                busy={busyTaskIds.has(event.id)}
                onEdit={() => onEditEvent(event.id)}
                onDelete={() => onDeleteEvent(event.id)}
                onToggleComplete={() => onToggleComplete(event.id, !event.completed)}
              />
            ))}
          </SortableContext>
        )}
      </div>

      <div className="flex h-10 items-center justify-center border-t" style={{ borderColor: "var(--sh-border)" }}>
        <QuickAddButton onClick={() => onQuickAdd(day)} />
      </div>
    </div>
  )
}

type EventCardProps = {
  event: CalendarEvent
  registerElement: (element: HTMLDivElement | null) => void
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}

function EventCard({ event, registerElement, busy, onEdit, onDelete, onToggleComplete }: EventCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  })

  const palette = getSubjectPalette(event.subjectName)
  const dragTransform = CSS.Translate.toString(transform)

  return (
    <div
      ref={(element) => {
        setNodeRef(element)
        registerElement(element)
      }}
      style={{
        transform: dragTransform,
        transition: transition ?? "transform 180ms ease-out, box-shadow 180ms ease-out",
        zIndex: isDragging ? 50 : 20,
      }}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab rounded-lg border p-1.5 text-xs shadow-sm transition duration-200 ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-xl"
            : "hover:-translate-y-0.5 hover:shadow-md"
        }`}
        onPointerDownCapture={(event) => {
          const target = event.target as HTMLElement
          if (target.closest("button, input, select, textarea, a, [data-no-drag='true']")) {
            event.stopPropagation()
          }
        }}
        style={palette.containerStyle}
      >
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex flex-1 items-start gap-1">
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onToggleComplete()
              }}
              onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
              disabled={busy}
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] disabled:opacity-50"
              style={{
                borderColor: event.completed ? "#34D399" : "var(--sh-border)",
                background: event.completed ? "rgba(52, 211, 153, 0.18)" : "transparent",
                color: event.completed ? "#34D399" : "var(--sh-text-muted)",
              }}
              aria-label={event.completed ? "Mark as pending" : "Mark as completed"}
            >
              {event.completed ? "\u2713" : ""}
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-1">
              <div className="min-w-0">
                <p
                  className="text-[12.5px] font-semibold leading-snug break-words"
                  title={event.title}
                  style={{
                    color: "var(--sh-text-primary)",
                    textDecoration: event.completed ? "line-through" : "none",
                    opacity: event.completed ? 0.72 : 1,
                  }}
                >
                  {event.title}
                </p>

                <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px]">
                  <span
                    className="shrink-0 rounded px-1.5 py-px font-medium"
                    style={event.completed ? COMPLETED_BADGE_STYLE : PENDING_BADGE_STYLE}
                  >
                    {event.completed ? "Completed" : "Pending"}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--sh-text-muted)" }}>
                    {formatDuration(event.durationMinutes)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                <button
                  type="button"
                  className="task-icon-edit-button"
                  onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onEdit()
                  }}
                  aria-label="Edit task"
                  title="Edit"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5l3 3" />
                  </svg>
                  <span className="sr-only">Edit</span>
                </button>

                <button
                  type="button"
                  className="task-icon-delete-button"
                  onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onDelete()
                  }}
                  aria-label="Delete task"
                  title="Delete"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                  </svg>
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            </div>
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
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition"
      style={{
        background: "color-mix(in srgb, var(--sh-card) 70%, var(--sh-primary) 30%)",
        border: "1px solid color-mix(in srgb, var(--sh-primary) 24%, var(--sh-border) 76%)",
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
  const firstSubject = subjectOptions[0]?.id ?? STANDALONE_SUBJECT_ID

  const [title, setTitle] = useState(() => initialEvent?.title ?? "")
  const [subjectId, setSubjectId] = useState<string>(() => initialEvent?.subjectId ?? firstSubject)
  const [day, setDay] = useState<number>(() => initialEvent?.day ?? presetDay)
  const [durationMinutes, setDurationMinutes] = useState<number>(
    () => initialEvent?.durationMinutes ?? 60
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

  const durationOptions = useMemo(() => {
    const values = new Set<number>(DURATION_OPTIONS)
    values.add(Math.max(15, durationMinutes))
    return [...values].sort((a, b) => a - b)
  }, [durationMinutes])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle || isSaving) return

    const success = await onSubmit(
      {
        title: trimmedTitle,
        subjectId,
        day,
        durationMinutes,
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

          <Field label="Duration">
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className={FIELD_INPUT_CLASS}
              style={FIELD_INPUT_STYLE}
              disabled={isSaving}
            >
              {durationOptions.map((value) => (
                <option key={value} value={value}>
                  {formatDuration(value)}
                </option>
              ))}
            </select>
          </Field>

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
