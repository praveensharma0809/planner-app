import { z } from "zod"

// ─── Primitives ──────────────────────────────────────────────────

// ─── Profile ─────────────────────────────────────────────────────

export const profileSchema = z.object({
  id: z.string(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  streak_current: z.number().optional(),
  streak_longest: z.number().optional(),
  streak_last_completed_date: z.string().nullable().optional(),
  created_at: z.string(),
})

// ─── Subject ─────────────────────────────────────────────────────

export const subjectSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  sort_order: z.number(),
  archived: z.boolean(),
  deadline: z.string().nullable(),
  created_at: z.string(),
})

export const subjectArraySchema = z.array(subjectSchema)

// ─── Topic ───────────────────────────────────────────────────────

export const topicSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  subject_id: z.string(),
  name: z.string(),
  sort_order: z.number(),
  archived: z.boolean(),
  estimated_hours: z.number().optional(),
  deadline: z.string().nullable().optional(),
  earliest_start: z.string().nullable().optional(),
  depends_on: z.array(z.string()).optional(),
  session_length_minutes: z.number().optional(),
  rest_after_days: z.number().optional(),
  max_sessions_per_day: z.number().optional(),
  study_frequency: z.string().optional(),
  created_at: z.string(),
})

export const topicArraySchema = z.array(topicSchema)

// ─── Task ────────────────────────────────────────────────────────

export const taskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  subject_id: z.string().nullable(),
  topic_id: z.string().nullable(),
  title: z.string(),
  task_type: z.enum(["subject", "standalone"]),
  scheduled_date: z.string(),
  duration_minutes: z.number(),
  session_type: z.enum(["core", "revision", "practice"]),
  session_number: z.number().optional(),
  total_sessions: z.number().optional(),
  sort_order: z.number().optional(),
  completed: z.boolean(),
  task_source: z.enum(["manual", "plan"]),
  plan_snapshot_id: z.string().nullable(),
  source_topic_task_id: z.string().nullable().optional(),
  created_at: z.string(),
})

export const taskArraySchema = z.array(taskSchema)

// ─── TopicTask ───────────────────────────────────────────────────

export const topicTaskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  subject_id: z.string(),
  topic_id: z.string(),
  title: z.string(),
  duration_minutes: z.number(),
  completed: z.boolean(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string().optional(),
})

export const topicTaskArraySchema = z.array(topicTaskSchema)

// ─── PlanSnapshot ────────────────────────────────────────────────

export const planSnapshotSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  task_count: z.number(),
  schedule_json: z.unknown(),
  settings_snapshot: z.unknown(),
  summary: z.string().nullable(),
  created_at: z.string(),
})

export const planSnapshotArraySchema = z.array(planSnapshotSchema)

// ─── Planner Settings ────────────────────────────────────────────

export const plannerSettingsSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  daily_capacity_minutes: z.array(z.number()).optional(),
  plan_horizon_days: z.number().optional(),
  off_days: z.array(z.string()).optional(),
  plan_order: z.string().optional(),
  plan_order_stack: z.string().optional(),
  subject_ordering: z.string().optional(),
  intake_import_mode: z.enum(["replace", "merge"]).optional(),
})

// ─── OffDay ─────────────────────────────────────────────────────

export const offDaySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  date: z.string(),
  label: z.string().nullable().optional(),
})

// ─── Partial / narrow column schemas ──────────────────────────────

/** Subject row with only id, name, and optional deadline — used in setup.ts getDraftFeasibility. */
export const subjectNameRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  deadline: z.string().nullable(),
})

export const subjectNameRowArraySchema = z.array(subjectNameRowSchema)

/** Topic parameter row from getTopicParams query (partial Topic columns). */
export const topicParamRowSchema = z.object({
  id: z.string(),
  subject_id: z.string(),
  estimated_hours: z.number().nullable(),
  deadline: z.string().nullable(),
  earliest_start: z.string().nullable(),
  depends_on: z.array(z.string()).nullable(),
  session_length_minutes: z.number().nullable(),
  rest_after_days: z.number().nullable(),
  max_sessions_per_day: z.number().nullable(),
  study_frequency: z.string().nullable(),
})

export const topicParamRowArraySchema = z.array(topicParamRowSchema)

/** Subject row with only id and deadline — used in getTopicParams. */
export const subjectDeadlineRowSchema = z.object({
  id: z.string(),
  deadline: z.string().nullable(),
})

export const subjectDeadlineRowArraySchema = z.array(subjectDeadlineRowSchema)

/** Minimal topic row with id, subject_id, name — used in getDraftFeasibility. */
export const topicBareRowSchema = z.object({
  id: z.string(),
  subject_id: z.string(),
  name: z.string(),
})

export const topicBareRowArraySchema = z.array(topicBareRowSchema)

/** Planner settings row from Supabase (flexible by design — column list varies). */
export const plannerSettingsRowSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  study_start_date: z.string().nullable().optional(),
  exam_date: z.string().nullable().optional(),
  weekday_capacity_minutes: z.number().nullable().optional(),
  weekend_capacity_minutes: z.number().nullable().optional(),
  max_active_subjects: z.number().nullable().optional(),
  day_of_week_capacity: z.array(z.unknown()).nullable().optional(),
  custom_day_capacity: z.record(z.string(), z.number()).nullable().optional(),
  flexibility_minutes: z.number().nullable().optional(),
  intake_import_mode: z.string().nullable().optional(),
}).passthrough()

/** Archived chapter list item from getArchivedChapters query. */
export const archivedChapterSchema = z.object({
  id: z.string(),
  subject_id: z.string(),
  name: z.string(),
  sort_order: z.number(),
  created_at: z.string(),
})

export const archivedChapterArraySchema = z.array(archivedChapterSchema)

/** Schedule task row from getWeekSchedule query. */
export const scheduleTaskRowSchema = z.object({
  id: z.string(),
  subject_id: z.string().nullable(),
  task_type: z.enum(["subject", "standalone"]),
  title: z.string(),
  scheduled_date: z.string(),
  duration_minutes: z.number(),
  session_type: z.enum(["core", "revision", "practice"]),
  completed: z.boolean(),
  task_source: z.enum(["manual", "plan"]),
  plan_snapshot_id: z.string().nullable(),
  session_number: z.number(),
  total_sessions: z.number(),
  created_at: z.string(),
})

export const scheduleTaskRowArraySchema = z.array(scheduleTaskRowSchema)

/** Subject row with id, name, sort_order used in schedule week view. */
export const scheduleSubjectRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number().nullable(),
})

export const scheduleSubjectRowArraySchema = z.array(scheduleSubjectRowSchema)

/** Minimal subject row with just id and name. */
export const subjectBareRowSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const subjectBareRowArraySchema = z.array(subjectBareRowSchema)

/** RPC sync_topic_task_completion result row. */
export const syncTopicTaskCompletionRowSchema = z.object({
  status: z.enum(["SUCCESS", "UNAUTHORIZED", "NOT_FOUND"]),
  synced_execution_count: z.number(),
})

/** Planner import row from importPlannerSchedule. */
export const plannerImportRowSchema = z.object({
  id: z.string(),
  subject_id: z.string().nullable(),
  title: z.string(),
  scheduled_date: z.string(),
  duration_minutes: z.number(),
  session_type: z.enum(["core", "revision", "practice"]),
  completed: z.boolean(),
  created_at: z.string(),
})

export const plannerImportRowArraySchema = z.array(plannerImportRowSchema)

// ─── Flexible row parsers ────────────────────────────────────────

/**
 * Loosely validates that `value` is an array and each element is a non-null object.
 * Does not validate field-level types — use the typed schemas above for strict checks.
 * Useful as a first-pass safety net before passing rows to domain code.
 */
export const objectArraySchema = z.array(
  z.record(z.string(), z.unknown())
)
