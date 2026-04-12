import type { CSSProperties } from "react"
import type { ScheduleWeekTask } from "@/app/actions/schedule/getWeekSchedule"
import { STANDALONE_SUBJECT_ID, STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"
import { getTasksForDate } from "@/lib/tasks/getTasksForDate"

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const
export const DAY_ORDER_STORAGE_KEY = "schedule-day-order-v1"

export type DayOrderMap = Record<number, string[]>
export type DayOrderStorage = Record<string, DayOrderMap>

export type CalendarEvent = {
  id: string
  title: string
  subjectId: string
  subjectName: string
  day: number
  dateISO: string
  durationMinutes: number
  completed: boolean
}

export type WeekRangeMeta = {
  weekStartISO: string
  weekEndISO: string
  title: string
}

const SUBJECT_ACCENTS = ["#3B82F6", "#A855F7", "#22C55E", "#F97316", "#06B6D4", "#EC4899", "#EAB308"] as const

export function parseISODate(iso: string) {
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

export function addDaysISO(iso: string, days: number) {
  const date = parseISODate(iso)
  if (Number.isNaN(date.getTime())) return getTodayLocalDate()
  date.setDate(date.getDate() + days)
  return normalizeLocalDate(date) ?? getTodayLocalDate()
}

export function addMonthsISO(iso: string, months: number) {
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

export function formatDayDateLabel(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function getWeekRangeMeta(baseDate: Date): WeekRangeMeta {
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

export function dayIndexFromWeekStart(isoDate: string, weekStartISO: string) {
  const oneDayMs = 24 * 60 * 60 * 1000
  const start = parseISODate(weekStartISO).getTime()
  const target = parseISODate(isoDate).getTime()
  return Math.floor((target - start) / oneDayMs)
}

export function clamp(value: number, min: number, max: number) {
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

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function getSubjectPalette(subject: string) {
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

export function emptyDayOrderMap(): DayOrderMap {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
}

export function readDayOrderStorage(): DayOrderStorage {
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

export function writeDayOrderStorage(next: DayOrderStorage) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DAY_ORDER_STORAGE_KEY, JSON.stringify(next))
}

export function mapTasksToEvents(
  tasks: ScheduleWeekTask[],
  weekDates: string[],
  subjectNameById: Map<string, string>
): CalendarEvent[] {
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
        : (task.subject_id ?? STANDALONE_SUBJECT_ID)

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
