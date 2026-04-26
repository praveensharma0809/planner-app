/** Regular expression matching canonical YYYY-MM-DD date strings. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Allowed session types for plan execution. */
export const SESSION_TYPES = ["core", "revision", "practice"] as const

/** Allowed study frequency values. */
export const STUDY_FREQUENCIES = ["daily", "spaced"] as const

/** Allowed task source origins. */
export const TASK_SOURCES = ["manual", "plan"] as const

/** Allowed task type classifications. */
export const TASK_TYPES = ["subject", "standalone"] as const

export type SessionType = (typeof SESSION_TYPES)[number]
export type StudyFrequency = (typeof STUDY_FREQUENCIES)[number]
export type TaskType = (typeof TASK_TYPES)[number]

type CanonicalIntakeTaskLike = {
  task_source?: string | null
  plan_snapshot_id?: string | null
  session_number?: number | null
  total_sessions?: number | null
}

/**
 * Returns `true` when `value` matches the `YYYY-MM-DD` format exactly.
 *
 * @param value - The string to test.
 */
export function isISODate(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

/**
 * Trims a nullable string and returns it, or `null` if the result is empty.
 * Does not validate date format — use {@link isISODate} for format checking.
 *
 * @param value - A date string, `null`, or `undefined`.
 * @returns The trimmed string, or `null`.
 */
export function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Coerces a nullable string to a valid {@link SessionType}, falling back to `"core"`.
 *
 * @param value - The raw value (e.g., from a database column or form input).
 * @param fallback - The session type to return when the value is not recognized (default `"core"`).
 * @returns A recognized session type.
 */
export function normalizeSessionType(
  value: string | null | undefined,
  fallback: SessionType = "core"
): SessionType {
  const candidate = value as SessionType | null | undefined
  if (candidate && SESSION_TYPES.includes(candidate)) {
    return candidate
  }
  return fallback
}

/**
 * Coerces a nullable string to a valid {@link StudyFrequency}, falling back to `"daily"`.
 *
 * @param value - The raw value (e.g., from a database column or form input).
 * @returns A recognized study frequency.
 */
export function normalizeStudyFrequency(value: string | null | undefined): StudyFrequency {
  const candidate = value as StudyFrequency | null | undefined
  return candidate && STUDY_FREQUENCIES.includes(candidate) ? candidate : "daily"
}

/**
 * Coerces a nullable string to a valid {@link TaskType}, falling back to `"subject"`.
 *
 * @param value - The raw value (e.g., from a database column or form input).
 * @param fallback - The task type to return when the value is not recognized (default `"subject"`).
 * @returns A recognized task type.
 */
export function normalizeTaskType(
  value: string | null | undefined,
  fallback: TaskType = "subject"
): TaskType {
  const candidate = value as TaskType | null | undefined
  if (candidate && TASK_TYPES.includes(candidate)) {
    return candidate
  }
  return fallback
}

/**
 * Returns `true` when a task is a canonical "intake" row — a manual source task
 * with `session_number: 0`, `total_sessions: 1`, and no `plan_snapshot_id`.
 * These are used to seed the planner and should not appear in schedule/dashboard views.
 *
 * @param task - A task-like object with optional `task_source`, `plan_snapshot_id`,
 *   `session_number`, and `total_sessions` fields.
 */
export function isCanonicalIntakeManualTask(task: CanonicalIntakeTaskLike): boolean {
  return (
    task.task_source === "manual"
    && task.plan_snapshot_id == null
    && task.session_number === 0
    && task.total_sessions === 1
  )
}

/**
 * Validates a date window (start and end dates). Returns an error message string
 * if either date is invalid or if start is after end, otherwise returns `null`.
 *
 * @param start - The start date string (or `null`).
 * @param end - The end date string (or `null`).
 * @param startLabel - Human-readable label for the start date (used in the error message).
 * @param endLabel - Human-readable label for the end date (used in the error message).
 * @returns An error message string if validation fails, or `null` if valid.
 */
export function validateDateWindow(
  start: string | null,
  end: string | null,
  startLabel: string,
  endLabel: string
): string | null {
  if (start && !isISODate(start)) {
    return `${startLabel} must be a valid date.`
  }

  if (end && !isISODate(end)) {
    return `${endLabel} must be a valid date.`
  }

  if (start && end && start > end) {
    return `${startLabel} must be on or before ${endLabel}.`
  }

  return null
}
