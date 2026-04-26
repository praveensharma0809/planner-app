/** Shared application-wide constants used across the UI, planner engine, and health scoring. */

/** Application display name shown in the sidebar header and document title. */
export const APP_NAME = "PrepVeda"

/** Number of milliseconds in one 24-hour day. Used for date arithmetic throughout the scheduling engine. */
export const MS_PER_DAY = 86_400_000

/** Number of minutes in one hour. Used to convert between minutes and hours for duration calculations. */
export const MINUTES_PER_HOUR = 60

/** Duration (ms) a toast notification remains visible before auto-dismissing. */
export const TOAST_DURATION_MS = 4000

/**
 * Deadline threshold (days) at which a subject is considered critically urgent.
 * When days remaining <= this value, the urgency badge renders red.
 */
export const URGENCY_CRITICAL_DAYS = 3

/**
 * Deadline threshold (days) at which a subject is considered warning-level urgent.
 * When days remaining <= this value (but > CRITICAL), the urgency badge renders yellow.
 */
export const URGENCY_WARNING_DAYS = 7

/** Dashboard health score threshold: at or above this value, the score is displayed as "good" (green). */
export const SCORE_GOOD_THRESHOLD = 70

/** Dashboard health score threshold: at or below this value, the score is displayed as "warning" (yellow/red). */
export const SCORE_WARN_THRESHOLD = 40

/**
 * Composite health check thresholds used by the dashboard health indicator.
 * - AT_RISK_DAYS: consecutive days below completion threshold that trigger "at risk" state
 * - AT_RISK_COMPLETION: percentage threshold for "at risk" classification
 * - BEHIND_DAYS: consecutive days below completion threshold that trigger "behind" state
 * - BEHIND_COMPLETION: percentage threshold for "behind" classification
 */
export const HEALTH_THRESHOLDS = {
  AT_RISK_DAYS: 3,
  AT_RISK_COMPLETION: 80,
  BEHIND_DAYS: 7,
  BEHIND_COMPLETION: 60,
} as const

/** Locale string used for date formatting (e.g., `toLocaleDateString` calls). */
export const APP_LOCALE = "en-US"

/** Three-letter weekday abbreviations used in calendar headers and schedule views. */
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/** The sentinel subject ID for uncategorized / standalone tasks. */
export const STANDALONE_SUBJECT_ID = "others"

/** The human-readable label for the sentinel "Others" subject displayed in UI. */
export const STANDALONE_SUBJECT_LABEL = "Others"

const RESERVED_SUBJECT_KEYWORD = "others"

/**
 * Returns `true` when the given name matches the reserved "Others" sentinel
 * (case-insensitive, trimmed). Used to prevent users from creating a real subject
 * with the reserved name.
 *
 * @param name - The subject name to check.
 */
export function isReservedSubjectName(name: string): boolean {
  return name.trim().toLowerCase() === RESERVED_SUBJECT_KEYWORD
}

/**
 * Throws when `subjectName` is "Others" (case-insensitive).
 * Used as a guard in task creation / editing flows to prevent tasks
 * from being assigned to the standalone sentinel subject.
 *
 * @param subjectName - The subject name to validate (nullable).
 * @throws {Error} If the name resolves to the reserved "Others" keyword.
 */
export function assertValidSubjectAssignment(subjectName?: string | null): void {
  if (subjectName?.toLowerCase() === "others") {
    throw new Error("Invalid subject assignment")
  }
}


