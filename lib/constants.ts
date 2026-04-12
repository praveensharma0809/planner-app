// â”€â”€ Shared application constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const APP_NAME = "StayPlanned"

export const MS_PER_DAY = 86_400_000
export const MINUTES_PER_HOUR = 60

export const TOAST_DURATION_MS = 4000

export const URGENCY_CRITICAL_DAYS = 3
export const URGENCY_WARNING_DAYS = 7

export const SCORE_GOOD_THRESHOLD = 70
export const SCORE_WARN_THRESHOLD = 40

export const HEALTH_THRESHOLDS = {
  AT_RISK_DAYS: 3,
  AT_RISK_COMPLETION: 80,
  BEHIND_DAYS: 7,
  BEHIND_COMPLETION: 60,
} as const

export const APP_LOCALE = "en-US"

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export const STANDALONE_SUBJECT_ID = "others"
export const STANDALONE_SUBJECT_LABEL = "Others"

const RESERVED_SUBJECT_KEYWORD = "others"

export function isReservedSubjectName(name: string): boolean {
  return name.trim().toLowerCase() === RESERVED_SUBJECT_KEYWORD
}

export function assertValidSubjectAssignment(subjectName?: string | null): void {
  if (subjectName?.toLowerCase() === "others") {
    throw new Error("Invalid subject assignment")
  }
}

