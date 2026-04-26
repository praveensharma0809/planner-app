import type {
  FeasibilityResult,
  PlanOrderCriterion,
  ScheduledSession,
  StudyFrequency,
  TopicOrderingMode,
} from "./engine"

/**
 * Minimal topic reference used in planner parameter forms.
 *
 * @param id - Unique topic identifier.
 * @param subject_name - Human-readable subject name.
 * @param topic_name - Human-readable topic name.
 */
export interface PlannerTopicForParams {
  id: string
  subject_name: string
  topic_name: string
}

/**
 * Per-topic parameters configurable by the user before plan generation.
 *
 * @param topic_id - ID of the topic these parameters apply to.
 * @param estimated_hours - Total estimated effort in hours.
 * @param deadline - ISO date string deadline for this topic.
 * @param earliest_start - ISO date string before which scheduling is not allowed.
 * @param depends_on - IDs of topics this topic depends on.
 * @param session_length_minutes - Duration of each session in minutes.
 * @param rest_after_days - Rest days enforced after topic completion.
 * @param max_sessions_per_day - Maximum sessions allowed per day for this topic.
 * @param study_frequency - `"daily"` or `"spaced"` session distribution.
 */
export interface PlannerParamValues {
  topic_id: string
  estimated_hours: number
  deadline: string
  earliest_start: string
  depends_on: string[]
  session_length_minutes: number
  rest_after_days: number
  max_sessions_per_day: number
  study_frequency: StudyFrequency
}

/**
 * Global constraint values editable in the planner UI before plan generation.
 *
 * @param study_start_date - ISO date when studying can begin.
 * @param exam_date - ISO date of the exam / final deadline.
 * @param weekday_capacity_minutes - Default study minutes on weekdays.
 * @param weekend_capacity_minutes - Default study minutes on weekends.
 * @param plan_order - High-level ordering: `"deadline"`, `"subject"`, or `"balanced"`.
 * @param final_revision_days - Days reserved for revision before the exam.
 * @param buffer_percentage - Extra capacity reserved as buffer (0–100).
 * @param max_active_subjects - Max distinct subjects per day.
 * @param day_of_week_capacity - Per-day-of-week capacity overrides (index 0 = Sunday).
 * @param custom_day_capacity - Per-date capacity overrides (ISO date → minutes).
 * @param plan_order_stack - Ordered criteria for topic prioritisation.
 * @param flexibility_minutes - Overflow minutes allowed per day beyond base capacity.
 * @param max_topics_per_subject_per_day - Max distinct topics per subject per day.
 * @param min_subject_gap_days - Minimum calendar days between sessions of the same subject.
 * @param subject_ordering - Per-subject topic ordering mode.
 * @param flexible_threshold - Per-subject completion threshold for flexible_sequential mode (0–1).
 */
export interface PlannerConstraintValues {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  max_active_subjects: number
  day_of_week_capacity: (number | null)[]
  custom_day_capacity: Record<string, number>
  plan_order_stack: PlanOrderCriterion[]
  flexibility_minutes: number
  max_topics_per_subject_per_day: number
  min_subject_gap_days: number
  subject_ordering: Record<string, TopicOrderingMode>
  flexible_threshold: Record<string, number>
}

/**
 * A subject option presented in the planner subject selector.
 *
 * @param id - Unique subject identifier.
 * @param name - Human-readable subject name.
 * @param deadline - Optional ISO deadline date associated with the subject.
 * @param topicIds - List of topic IDs belonging to this subject.
 * @param topics - List of topic references with id and name.
 */
export interface PlannerSubjectOption {
  id: string
  name: string
  deadline?: string
  topicIds?: string[]
  topics?: Array<{ id: string; name: string }>
}

/** Minimum allowed session length in minutes. Sessions shorter than this are clamped. */
export const MIN_SESSION_LENGTH_MINUTES = 15

/** Maximum allowed session length in minutes. Sessions longer than this are clamped. */
export const MAX_SESSION_LENGTH_MINUTES = 240

/**
 * Default session length used as a fallback when no task-based or configured value is available.
 * Also used to detect legacy rows where the configured value may need to be overridden by
 * task-derived durations.
 */
export const LEGACY_DEFAULT_SESSION_LENGTH_MINUTES = 60

/**
 * Predefined options for per-date custom day capacity (in minutes).
 */
export const CUSTOM_DAY_CAPACITY_PRESETS = [0, 30, 60, 90, 120, 180, 240] as const

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Determines the session length in minutes by combining task durations and a user-configured
 * value with legacy-awareness.
 *
 * **Resolution priority:**
 * 1. If a configured value exists and it is not the legacy default (60), use it (clamped).
 * 2. If configured is the legacy default and task-derived duration is longer, use task-derived.
 * 3. If configured is the legacy default and no longer task duration exists, use configured.
 * 4. If no configured value, use task-derived duration if available.
 * 5. Fall back to {@link LEGACY_DEFAULT_SESSION_LENGTH_MINUTES} (60).
 *
 * All values are clamped to [{@link MIN_SESSION_LENGTH_MINUTES}, {@link MAX_SESSION_LENGTH_MINUTES}].
 *
 * @param taskDurations - Array of task durations (in minutes) to derive a session length from.
 * @param configuredMinutes - User-configured session length, or null/undefined if not set.
 * @returns The resolved session length in minutes.
 */
export function inferSessionLengthMinutes(
  taskDurations: number[],
  configuredMinutes?: number | null
): number {
  const normalizedDurations = taskDurations
    .map((value) => Math.trunc(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  const derivedFromTasks =
    normalizedDurations.length > 0
      ? clampInteger(
          Math.max(...normalizedDurations),
          MIN_SESSION_LENGTH_MINUTES,
          MAX_SESSION_LENGTH_MINUTES
        )
      : null

  const hasConfigured =
    configuredMinutes != null &&
    Number.isFinite(configuredMinutes) &&
    configuredMinutes > 0

  const normalizedConfigured = hasConfigured
    ? clampInteger(
        Math.trunc(configuredMinutes),
        MIN_SESSION_LENGTH_MINUTES,
        MAX_SESSION_LENGTH_MINUTES
      )
    : null

  if (normalizedConfigured != null) {
    // Legacy rows often carry a default 60 even for longer task durations.
    if (
      normalizedConfigured === LEGACY_DEFAULT_SESSION_LENGTH_MINUTES &&
      derivedFromTasks != null &&
      derivedFromTasks > normalizedConfigured
    ) {
      return derivedFromTasks
    }
    return normalizedConfigured
  }

  if (derivedFromTasks != null) return derivedFromTasks
  return LEGACY_DEFAULT_SESSION_LENGTH_MINUTES
}

/**
 * Normalizes a planner entity name for comparison: trims whitespace, collapses
 * multiple spaces into one, and lowercases.
 *
 * @param name - Raw name string to normalize.
 * @returns The normalized name.
 */
export function normalizePlannerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Detects a dependency cycle in a directed graph using depth-first search.
 *
 * @param edges - Map from node ID to its list of dependency IDs.
 * @returns An array of node IDs forming a cycle (starting and ending with the same
 *          node), or `null` if the graph is acyclic.
 */
export function findDependencyCycle(
  edges: Map<string, string[]>
): string[] | null {
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
    if (active.has(node)) {
      const cycleStart = path.lastIndexOf(node)
      return [...path.slice(cycleStart), node]
    }

    if (visited.has(node)) {
      return null
    }

    visited.add(node)
    active.add(node)
    path.push(node)

    for (const next of edges.get(node) ?? []) {
      const cycle = dfs(next)
      if (cycle) {
        return cycle
      }
    }

    path.pop()
    active.delete(node)
    return null
  }

  for (const node of edges.keys()) {
    const cycle = dfs(node)
    if (cycle) {
      return cycle
    }
  }

  return null
}

/**
 * Severity level for a plan issue.
 *
 * - `"critical"`: Blocks plan commitment; must be resolved.
 * - `"warning"`: Non-blocking but indicates suboptimal conditions.
 */
export type PlanIssueSeverity = "critical" | "warning"

/**
 * Constraint field identifiers that can be inline-edited from the plan issues UI.
 */
export type PlanIssueConstraintField =
  | "study_start_date"
  | "exam_date"
  | "weekday_capacity_minutes"
  | "weekend_capacity_minutes"
  | "max_active_subjects"
  | "flexibility_minutes"

/**
 * Describes an inline-editable constraint field shown alongside a plan issue.
 *
 * @param field - Which constraint field can be edited.
 * @param label - Human-readable label for the field.
 * @param type - Input type: `"number"` or `"date"`.
 * @param min - Optional minimum value for number fields.
 * @param max - Optional maximum value for number fields.
 * @param step - Optional step increment for number fields.
 */
export interface PlanIssueInlineConstraint {
  field: PlanIssueConstraintField
  label: string
  type: "number" | "date"
  min?: number
  max?: number
  step?: number
}

/**
 * A single action the user can take to resolve a plan issue.
 *
 * Discriminated union by `kind`:
 * - `"jump"`: Navigate to a different planner phase (e.g., back to intake).
 *   - `jumpPhase`: Target phase number.
 * - `"constraint_delta"`: Adjust a numeric constraint by a delta.
 *   - `field`: The constraint field to modify.
 *   - `delta`: Amount to add (can be negative).
 * - `"date_delta"`: Shift a date constraint by a number of days.
 *   - `field`: `"study_start_date"` or `"exam_date"`.
 *   - `days`: Number of days to add.
 *
 * @param id - Unique identifier for this action.
 * @param label - Human-readable action label.
 * @param kind - Action kind discriminator.
 */
export type PlanIssueAction =
  | {
      id: string
      label: string
      kind: "jump"
      jumpPhase: number
    }
  | {
      id: string
      label: string
      kind: "constraint_delta"
      field: PlanIssueConstraintField
      delta: number
      min?: number
      max?: number
    }
  | {
      id: string
      label: string
      kind: "date_delta"
      field: "study_start_date" | "exam_date"
      days: number
    }

/**
 * A single detected issue with the current plan, presented to the user.
 *
 * @param issueId - Unique identifier for this issue type (e.g., `"no-usable-days"`).
 * @param severity - `"critical"` (blocks commit) or `"warning"` (informational).
 * @param title - Short issue title.
 * @param userMessage - Detailed message explaining the issue to the user.
 * @param resolverHint - Guidance on how to resolve the issue.
 * @param rootCauseValues - Key-value pairs showing the data that triggered the issue.
 * @param options - Actionable suggestions the user can apply.
 * @param inlineEdits - Constraint fields that can be edited inline alongside the issue.
 */
export interface PlanIssue {
  issueId: string
  severity: PlanIssueSeverity
  title: string
  userMessage: string
  resolverHint: string
  rootCauseValues: Record<string, string | number>
  options: PlanIssueAction[]
  inlineEdits: PlanIssueInlineConstraint[]
}

/**
 * Input to {@link buildPlanIssues} containing all data needed to detect plan issues.
 *
 * @param constraints - Current planner constraint values (null if not yet configured).
 * @param params - Per-topic parameter values.
 * @param feasibility - Feasibility check result, or null if not yet computed.
 * @param sessions - Currently scheduled sessions.
 * @param planStatus - Status of the plan generation (`"READY"`, `"PARTIAL"`, `"INFEASIBLE"`, etc.).
 */
export interface BuildPlanIssuesInput {
  constraints: PlannerConstraintValues | null
  params: PlannerParamValues[]
  feasibility: FeasibilityResult | null
  sessions: ScheduledSession[]
  planStatus?: string | null
}

/**
 * Counts of generated vs. manual sessions compared to the expected total.
 *
 * @param expectedSessions - Total sessions the feasibility check expects.
 * @param generatedSessions - Number of auto-generated sessions present.
 * @param manualSessions - Number of manually created sessions.
 * @param missingGeneratedSessions - Shortfall: `expectedSessions - generatedSessions` (0 if none).
 */
export interface GeneratedSessionCoverage {
  expectedSessions: number
  generatedSessions: number
  manualSessions: number
  missingGeneratedSessions: number
}

/**
 * Warning message shown when the user has removed auto-generated sessions.
 */
export const MISSING_GENERATED_SESSIONS_MESSAGE =
  "You have removed required planned sessions. Add them back or regenerate plan."

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

function getTopicDeadlineMap(
  params: PlannerParamValues[],
  constraints: PlannerConstraintValues
): Map<string, string> {
  const deadlineMap = new Map<string, string>()
  for (const param of params) {
    deadlineMap.set(param.topic_id, param.deadline || constraints.exam_date)
  }
  return deadlineMap
}

function daySpreadMinutes(sessions: ScheduledSession[]): number {
  if (sessions.length === 0) return 0

  const byDate = new Map<string, number>()
  for (const session of sessions) {
    byDate.set(
      session.scheduled_date,
      (byDate.get(session.scheduled_date) ?? 0) + session.duration_minutes
    )
  }

  const values = [...byDate.values()]
  if (values.length === 0) return 0
  return Math.max(...values) - Math.min(...values)
}

/**
 * Checks whether any issue in the list has `"critical"` severity.
 *
 * @param issues - Array of plan issues to inspect.
 * @returns `true` if at least one issue is critical, `false` otherwise.
 */
export function hasCriticalIssues(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === "critical")
}

/**
 * Computes session coverage metrics by comparing feasibility expectations against
 * the current session list.
 *
 * @param feasibility - Feasibility result containing expected session counts, or null.
 * @param sessions - Current list of scheduled sessions (both generated and manual).
 * @returns A {@link GeneratedSessionCoverage} with counts and the shortfall.
 */
export function getSessionCoverage(
  feasibility: FeasibilityResult | null,
  sessions: ScheduledSession[]
): GeneratedSessionCoverage {
  const expectedSessions = feasibility
    ? feasibility.units.reduce((sum, unit) => sum + unit.totalSessions, 0)
    : 0
  const generatedSessions = sessions.filter((session) => !session.is_manual).length
  const manualSessions = sessions.filter((session) => session.is_manual).length

  return {
    expectedSessions,
    generatedSessions,
    manualSessions,
    missingGeneratedSessions: Math.max(0, expectedSessions - generatedSessions),
  }
}

/**
 * Detects issues with the current plan state and returns actionable suggestions.
 *
 * **Detection algorithm:**
 *
 * 1. **No usable days** — If `planStatus` is `"NO_DAYS"` or feasibility reports
 *    zero available slots, generates a `"no-usable-days"` critical issue.
 *
 * 2. **Unscheduled sessions** — If `planStatus` is `"PARTIAL"` or `"INFEASIBLE"`,
 *    or the session coverage shows dropped sessions, generates an
 *    `"unscheduled-sessions"` critical issue.
 *
 * 3. **Impossible topics** — If any topic has `"impossible"` feasibility status
 *    (time window too small for required sessions), generates a
 *    `"topic-window-impossible"` critical issue.
 *
 * 4. **Flexibility dependency** — If the plan requires flex/overflow minutes to
 *    fit (`flexFeasible` is true), generates a `"flex-heavy"` warning.
 *
 * 5. **Late sessions** — If any session is scheduled after its topic deadline,
 *    generates a `"late-sessions"` critical issue.
 *
 * 6. **Load volatility** — If the spread between the busiest and lightest day
 *    exceeds 180 minutes, generates a `"load-volatility"` warning.
 *
 * Results are sorted with critical issues first.
 *
 * @param input - All data needed to analyze the plan for issues.
 * @returns An array of {@link PlanIssue} objects sorted by severity (critical first).
 */
export function buildPlanIssues(input: BuildPlanIssuesInput): PlanIssue[] {
  const { constraints, params, feasibility, sessions, planStatus } = input

  if (!constraints) return []

  const issues: PlanIssue[] = []

  if (
    planStatus === "NO_DAYS" ||
    (feasibility != null && feasibility.totalSlotsAvailable <= 0)
  ) {
    issues.push({
      issueId: "no-usable-days",
      severity: "critical",
      title: "No usable study days",
      userMessage:
        "No valid study day exists in your current date window after applying zero-capacity and off-day rules.",
      resolverHint:
        "Increase available time or extend the deadline, then re-check.",
      rootCauseValues: {
        "Study start": constraints.study_start_date,
        Deadline: constraints.exam_date,
        Weekday: constraints.weekday_capacity_minutes,
        Weekend: constraints.weekend_capacity_minutes,
      },
      inlineEdits: [
        { field: "exam_date", label: "Deadline", type: "date" },
        {
          field: "weekday_capacity_minutes",
          label: "Weekday minutes",
          type: "number",
          min: 0,
          step: 30,
        },
        {
          field: "weekend_capacity_minutes",
          label: "Weekend minutes",
          type: "number",
          min: 0,
          step: 30,
        },
      ],
      options: [
        {
          id: "extend-deadline-3",
          label: "Extend deadline by 3 days",
          kind: "date_delta",
          field: "exam_date",
          days: 3,
        },
        {
          id: "add-weekday-30",
          label: "+30 weekday minutes",
          kind: "constraint_delta",
          field: "weekday_capacity_minutes",
          delta: 30,
          min: 0,
        },
        {
          id: "add-weekend-30",
          label: "+30 weekend minutes",
          kind: "constraint_delta",
          field: "weekend_capacity_minutes",
          delta: 30,
          min: 0,
        },
        {
          id: "jump-phase-3",
          label: "Go to intake",
          kind: "jump",
          jumpPhase: 1,
        },
      ],
    })
  }

  let expectedSessions = 0
  let droppedSessions = 0
  let generatedSessions = 0
  let manualSessions = 0

  if (feasibility) {
    const coverage = getSessionCoverage(feasibility, sessions)
    expectedSessions = coverage.expectedSessions
    droppedSessions = coverage.missingGeneratedSessions
    generatedSessions = coverage.generatedSessions
    manualSessions = coverage.manualSessions

    if (
      droppedSessions > 0 ||
      planStatus === "PARTIAL" ||
      planStatus === "INFEASIBLE"
    ) {
      issues.push({
        issueId: "unscheduled-sessions",
        severity: "critical",
        title: "Some sessions are not scheduled",
        userMessage: droppedSessions > 0
          ? MISSING_GENERATED_SESSIONS_MESSAGE
          : "The plan is incomplete. Commit is blocked until all required sessions are placed.",
        resolverHint:
          "Increase capacity, adjust deadlines, or reduce strictness on constrained topics.",
        rootCauseValues: {
          "Expected sessions": expectedSessions,
          "Generated sessions": generatedSessions,
          "Manual sessions": manualSessions,
          Missing: droppedSessions,
        },
        inlineEdits: [
          {
            field: "weekday_capacity_minutes",
            label: "Weekday minutes",
            type: "number",
            min: 0,
            step: 30,
          },
          {
            field: "weekend_capacity_minutes",
            label: "Weekend minutes",
            type: "number",
            min: 0,
            step: 30,
          },
          {
            field: "max_active_subjects",
            label: "Max subjects/day",
            type: "number",
            min: 0,
            max: 8,
            step: 1,
          },
          { field: "exam_date", label: "Deadline", type: "date" },
        ],
        options: [
          {
            id: "unscheduled-weekday-30",
            label: "+30 weekday minutes",
            kind: "constraint_delta",
            field: "weekday_capacity_minutes",
            delta: 30,
            min: 0,
          },
          {
            id: "unscheduled-weekend-30",
            label: "+30 weekend minutes",
            kind: "constraint_delta",
            field: "weekend_capacity_minutes",
            delta: 30,
            min: 0,
          },
          {
            id: "unscheduled-max-subjects",
            label: "+1 max subjects/day",
            kind: "constraint_delta",
            field: "max_active_subjects",
            delta: 1,
            min: 0,
            max: 8,
          },
          {
            id: "unscheduled-extend-deadline",
            label: "Extend deadline by 3 days",
            kind: "date_delta",
            field: "exam_date",
            days: 3,
          },
          {
            id: "unscheduled-jump-2",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
          {
            id: "unscheduled-jump-3",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
        ],
      })
    }

    const impossibleTopics = feasibility.units.filter(
      (unit) => unit.status === "impossible"
    )
    if (impossibleTopics.length > 0) {
      const sample = impossibleTopics
        .slice(0, 3)
        .map((unit) => unit.name)
        .join(", ")
      issues.push({
        issueId: "topic-window-impossible",
        severity: "critical",
        title: "Some topics cannot fit their time window",
        userMessage:
          `${impossibleTopics.length} topic(s) have insufficient minutes before their deadline.` +
          (sample ? ` Example: ${sample}.` : ""),
        resolverHint:
          "Adjust topic deadlines or session structure in topic setup.",
        rootCauseValues: {
          "Impossible topics": impossibleTopics.length,
          "Global minute gap": feasibility.globalGap,
        },
        inlineEdits: [
          { field: "exam_date", label: "Global deadline", type: "date" },
        ],
        options: [
          {
            id: "impossible-extend-deadline",
            label: "Extend deadline by 5 days",
            kind: "date_delta",
            field: "exam_date",
            days: 5,
          },
          {
            id: "impossible-jump-2",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
          {
            id: "impossible-jump-3",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
        ],
      })
    }

    if (feasibility.flexFeasible) {
      issues.push({
        issueId: "flex-heavy",
        severity: "warning",
        title: "Plan depends on flexibility allowance",
        userMessage:
          "The plan fits only when overflow minutes are used on some days.",
        resolverHint:
          "Increase baseline daily capacity to reduce pressure.",
        rootCauseValues: {
          "Base available": feasibility.totalSlotsAvailable,
          "With flexibility":
            feasibility.totalFlexAvailable ?? feasibility.totalSlotsAvailable,
          Needed: feasibility.totalSessionsNeeded,
        },
        inlineEdits: [
          {
            field: "weekday_capacity_minutes",
            label: "Weekday minutes",
            type: "number",
            min: 0,
            step: 30,
          },
          {
            field: "weekend_capacity_minutes",
            label: "Weekend minutes",
            type: "number",
            min: 0,
            step: 30,
          },
          {
            field: "flexibility_minutes",
            label: "Flex minutes",
            type: "number",
            min: 0,
            max: 120,
            step: 15,
          },
        ],
        options: [
          {
            id: "flex-increase-weekday",
            label: "+30 weekday minutes",
            kind: "constraint_delta",
            field: "weekday_capacity_minutes",
            delta: 30,
            min: 0,
          },
          {
            id: "flex-increase-weekend",
            label: "+30 weekend minutes",
            kind: "constraint_delta",
            field: "weekend_capacity_minutes",
            delta: 30,
            min: 0,
          },
        ],
      })
    }
  }

  if (sessions.length > 0) {
    const deadlines = getTopicDeadlineMap(params, constraints)
    const lateSessions = sessions.filter((session) => {
      const deadline = deadlines.get(session.topic_id) ?? constraints.exam_date
      return isIsoDate(deadline) && session.scheduled_date > deadline
    })

    if (lateSessions.length > 0) {
      issues.push({
        issueId: "late-sessions",
        severity: "critical",
        title: "Some sessions are scheduled after topic deadline",
        userMessage:
          `${lateSessions.length} session(s) are currently after their topic deadlines.`,
        resolverHint:
          "Tighten topic windows by updating topic deadlines or increasing capacity.",
        rootCauseValues: {
          "Late sessions": lateSessions.length,
          "Affected topics": new Set(lateSessions.map((session) => session.topic_id)).size,
        },
        inlineEdits: [
          { field: "exam_date", label: "Global deadline", type: "date" },
        ],
        options: [
          {
            id: "late-jump-2",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
          {
            id: "late-jump-3",
            label: "Go to intake",
            kind: "jump",
            jumpPhase: 1,
          },
        ],
      })
    }

    const spread = daySpreadMinutes(sessions)
    if (spread >= 180) {
      issues.push({
        issueId: "load-volatility",
        severity: "warning",
        title: "Daily load is highly uneven",
        userMessage:
          "Some days are much heavier than others, which may hurt consistency.",
        resolverHint:
          "Increase day capacity consistency or tweak constraints for smoother distribution.",
        rootCauseValues: {
          "Load spread (minutes)": spread,
          "Max subjects/day": constraints.max_active_subjects,
        },
        inlineEdits: [
          {
            field: "max_active_subjects",
            label: "Max subjects/day",
            type: "number",
            min: 0,
            max: 8,
            step: 1,
          },
        ],
        options: [
          {
            id: "volatility-max-subjects",
            label: "+1 max subjects/day",
            kind: "constraint_delta",
            field: "max_active_subjects",
            delta: 1,
            min: 0,
            max: 8,
          },
        ],
      })
    }
  }

  return issues.sort((aIssue, bIssue) => {
    if (aIssue.severity === bIssue.severity) return 0
    return aIssue.severity === "critical" ? -1 : 1
  })
}
