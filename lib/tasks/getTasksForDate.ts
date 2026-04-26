/**
 * Lightweight date utilities for filtering tasks by a local date string.
 * All functions operate in the user's local timezone to avoid UTC boundary shifts.
 */

type DateLike = Date | string

type TaskWithScheduledDate = {
  scheduled_date: string | null | undefined
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isValidDateOnlyString(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false
  }

  const probe = new Date(year, month - 1, day)
  return (
    probe.getFullYear() === year
    && probe.getMonth() === month - 1
    && probe.getDate() === day
  )
}

/**
 * Normalizes a Date, ISO date string, or other date-like value into a consistent
 * `YYYY-MM-DD` local-date string. Returns `null` for invalid or missing input.
 *
 * @param value - A `Date` object, a date-like string, `null`, or `undefined`.
 * @returns A canonical `YYYY-MM-DD` string, or `null` if the value is not a valid date.
 */
export function normalizeLocalDate(value: DateLike | null | undefined): string | null {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatLocalDate(value)
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  // Keep canonical date-only values stable and avoid timezone shifting.
  if (isValidDateOnlyString(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return formatLocalDate(parsed)
}

/**
 * Returns today's date as a `YYYY-MM-DD` string in the user's local timezone.
 */
export function getTodayLocalDate() {
  return formatLocalDate(new Date())
}

/**
 * Filters a task array to only those whose `scheduled_date` matches the given date.
 *
 * @param tasks - Array of task-like objects with a `scheduled_date` field.
 * @param date - The target date as a `Date` object or date-like string.
 * @returns A new array containing only the tasks scheduled for that date.
 * @example
 * getTasksForDate(tasks, "2026-04-26") // returns tasks scheduled for April 26
 */
export function getTasksForDate<TTask extends TaskWithScheduledDate>(
  tasks: readonly TTask[],
  date: DateLike
) {
  const targetDate = normalizeLocalDate(date)
  if (!targetDate) return [] as TTask[]

  return tasks.filter((task) => normalizeLocalDate(task.scheduled_date) === targetDate)
}
