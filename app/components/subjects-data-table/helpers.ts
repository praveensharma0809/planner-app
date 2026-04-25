import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
} from "@/lib/planner/draft"

type TaskOrderItem = {
  id: string
  title: string
}

export function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function defaultIntakeConstraints() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return {
    study_start_date: `${year}-${month}-${day}`,
    exam_date: "",
    weekday_capacity_minutes: 180,
    weekend_capacity_minutes: 240,
    day_of_week_capacity: [null, null, null, null, null, null, null] as Array<number | null>,
    custom_day_capacity: {} as Record<string, number>,
    flexibility_minutes: 0,
    max_active_subjects: 0,
  }
}

export function normalizeDurationMinutes(rawMinutes: number): number {
  const parsed = Number.isFinite(rawMinutes)
    ? Math.trunc(rawMinutes)
    : MIN_SESSION_LENGTH_MINUTES

  return clampInteger(parsed, MIN_SESSION_LENGTH_MINUTES, MAX_SESSION_LENGTH_MINUTES)
}

export function normalizeDayOfWeekCapacity(
  values: Array<number | null> | null | undefined
): Array<number | null> {
  const next = Array.from({ length: 7 }, (_, index) => {
    const value = values?.[index]
    if (value == null) return null

    const parsed = Math.trunc(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  })

  return next
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = `${error.name} ${error.message}`.toLowerCase()
  return (
    message.includes("network")
    || message.includes("failed to fetch")
    || message.includes("fetch failed")
    || message.includes("load failed")
    || message.includes("connection")
    || message.includes("timeout")
    || message.includes("socket")
    || message.includes("econn")
    || message.includes("enotfound")
  )
}

export function toMonthCursor(input: Date): string {
  const year = input.getFullYear()
  const month = String(input.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function parseMonthCursor(cursor: string): Date {
  const [yearRaw, monthRaw] = cursor.split("-")
  const year = Number.parseInt(yearRaw, 10)
  const month = Number.parseInt(monthRaw, 10)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }

  return new Date(year, month - 1, 1)
}

export function shiftMonthCursor(cursor: string, delta: number): string {
  const base = parseMonthCursor(cursor)
  base.setMonth(base.getMonth() + delta)
  return toMonthCursor(base)
}

export function formatMonthLabel(cursor: string): string {
  const base = parseMonthCursor(cursor)
  return base.toLocaleString("en-US", { month: "long", year: "numeric" })
}

export function buildMonthGrid(cursor: string): Array<Array<string | null>> {
  const base = parseMonthCursor(cursor)
  const year = base.getFullYear()
  const month = base.getMonth()
  const first = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()

  const cells: Array<string | null> = Array(first.getDay()).fill(null)
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push(iso)
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: Array<Array<string | null>> = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }

  return weeks
}

export function composeSeriesName(
  baseName: string,
  index: number,
  placement: "suffix" | "prefix",
  separator: string,
  numberPadding: number
): string {
  const numeric = String(index).padStart(Math.max(0, numberPadding), "0")
  const cleanSeparator = separator.trim()

  if (placement === "prefix") {
    return cleanSeparator ? `${numeric}${cleanSeparator}${baseName}` : `${numeric}${baseName}`
  }

  return cleanSeparator ? `${baseName}${cleanSeparator}${numeric}` : `${baseName}${numeric}`
}

function buildNumericPatternKey(title: string): string | null {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return null

  if (!/\d/.test(normalized)) return null
  return normalized.replace(/\d+/g, "#")
}

function extractNumericParts(title: string): number[] {
  const matches = title.match(/\d+/g)
  if (!matches) return []

  return matches
    .map((token) => Number.parseInt(token, 10))
    .filter((value) => Number.isFinite(value))
}

export function shouldAutoOrderTasks(tasks: Array<Pick<TaskOrderItem, "title">>): boolean {
  if (tasks.length < 2) return false

  const patternCounts = new Map<string, number>()
  for (const task of tasks) {
    const key = buildNumericPatternKey(task.title)
    if (!key) continue
    patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1)
  }

  let maxPatternCount = 0
  for (const count of patternCounts.values()) {
    if (count > maxPatternCount) {
      maxPatternCount = count
    }
  }

  return maxPatternCount >= 2
}

export function compareTasksNaturally(left: TaskOrderItem, right: TaskOrderItem): number {
  const leftTitle = left.title.trim()
  const rightTitle = right.title.trim()

  if (!leftTitle && !rightTitle) {
    return left.id.localeCompare(right.id)
  }
  if (!leftTitle) return 1
  if (!rightTitle) return -1

  const leftPattern = buildNumericPatternKey(leftTitle)
  const rightPattern = buildNumericPatternKey(rightTitle)

  if (leftPattern && rightPattern && leftPattern === rightPattern) {
    const leftNumbers = extractNumericParts(leftTitle)
    const rightNumbers = extractNumericParts(rightTitle)
    const maxLength = Math.max(leftNumbers.length, rightNumbers.length)

    for (let index = 0; index < maxLength; index += 1) {
      const leftValue = leftNumbers[index]
      const rightValue = rightNumbers[index]

      if (leftValue === undefined && rightValue === undefined) break
      if (leftValue === undefined) return -1
      if (rightValue === undefined) return 1
      if (leftValue !== rightValue) return leftValue - rightValue
    }
  }

  const byTitle = leftTitle.localeCompare(rightTitle, undefined, {
    numeric: true,
    sensitivity: "base",
  })

  if (byTitle !== 0) return byTitle
  return left.id.localeCompare(right.id)
}
