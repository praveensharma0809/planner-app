export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const SESSION_TYPES = ["core", "revision", "practice"] as const
export const STUDY_FREQUENCIES = ["daily", "spaced"] as const
export const TASK_SOURCES = ["manual", "plan"] as const

export type SessionType = (typeof SESSION_TYPES)[number]
export type StudyFrequency = (typeof STUDY_FREQUENCIES)[number]

type CanonicalIntakeTaskLike = {
  task_source?: string | null
  plan_snapshot_id?: string | null
  session_number?: number | null
  total_sessions?: number | null
}

export function isISODate(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

export function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

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

export function normalizeStudyFrequency(value: string | null | undefined): StudyFrequency {
  const candidate = value as StudyFrequency | null | undefined
  return candidate && STUDY_FREQUENCIES.includes(candidate) ? candidate : "daily"
}

/**
 * Canonical intake rows are source-only manual tasks used to generate plans.
 * They should not be treated as scheduled execution tasks in dashboard views.
 */
export function isCanonicalIntakeManualTask(task: CanonicalIntakeTaskLike): boolean {
  return (
    task.task_source === "manual"
    && task.plan_snapshot_id == null
    && task.session_number === 0
    && task.total_sessions === 1
  )
}

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
