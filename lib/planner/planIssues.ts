import type {
  PlannerConstraintValues,
  PlannerParamValues,
} from "./draftTypes"
import type { FeasibilityResult, ScheduledSession } from "./types"

export type PlanIssueSeverity = "critical" | "warning"

export type PlanIssueConstraintField =
  | "study_start_date"
  | "exam_date"
  | "weekday_capacity_minutes"
  | "weekend_capacity_minutes"
  | "max_active_subjects"
  | "max_daily_minutes"
  | "flexibility_minutes"

export interface PlanIssueInlineConstraint {
  field: PlanIssueConstraintField
  label: string
  type: "number" | "date"
  min?: number
  max?: number
  step?: number
}

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
      kind: "constraint_set"
      field: PlanIssueConstraintField
      value: number
    }
  | {
      id: string
      label: string
      kind: "date_delta"
      field: "study_start_date" | "exam_date"
      days: number
    }

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

export interface BuildPlanIssuesInput {
  constraints: PlannerConstraintValues | null
  params: PlannerParamValues[]
  feasibility: FeasibilityResult | null
  sessions: ScheduledSession[]
  planStatus?: string | null
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

function getTopicDeadlineMap(
  params: PlannerParamValues[],
  constraints: PlannerConstraintValues
): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of params) {
    map.set(p.topic_id, p.deadline || constraints.exam_date)
  }
  return map
}

function daySpreadMinutes(sessions: ScheduledSession[]): number {
  if (sessions.length === 0) return 0
  const byDate = new Map<string, number>()
  for (const s of sessions) {
    byDate.set(s.scheduled_date, (byDate.get(s.scheduled_date) ?? 0) + s.duration_minutes)
  }
  const values = [...byDate.values()]
  if (values.length === 0) return 0
  return Math.max(...values) - Math.min(...values)
}

export function hasCriticalIssues(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === "critical")
}

export function buildPlanIssues(input: BuildPlanIssuesInput): PlanIssue[] {
  const { constraints, params, feasibility, sessions, planStatus } = input

  if (!constraints) return []

  const issues: PlanIssue[] = []

  if (
    planStatus === "NO_DAYS"
    || (feasibility != null && feasibility.totalSlotsAvailable <= 0)
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
          label: "Go to constraints",
          kind: "jump",
          jumpPhase: 3,
        },
      ],
    })
  }

  let expectedSessions = 0
  let droppedSessions = 0

  if (feasibility) {
    expectedSessions = feasibility.units.reduce(
      (sum, unit) => sum + unit.totalSessions,
      0
    )
    droppedSessions = Math.max(0, expectedSessions - sessions.length)

    if (droppedSessions > 0 || planStatus === "PARTIAL" || planStatus === "INFEASIBLE") {
      issues.push({
        issueId: "unscheduled-sessions",
        severity: "critical",
        title: "Some sessions are not scheduled",
        userMessage:
          "The plan is incomplete. Commit is blocked until all required sessions are placed.",
        resolverHint:
          "Increase capacity, adjust deadlines, or reduce strictness on constrained topics.",
        rootCauseValues: {
          "Expected sessions": expectedSessions,
          "Scheduled sessions": sessions.length,
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
            label: "Go to topic setup",
            kind: "jump",
            jumpPhase: 2,
          },
          {
            id: "unscheduled-jump-3",
            label: "Go to constraints",
            kind: "jump",
            jumpPhase: 3,
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
        inlineEdits: [{ field: "exam_date", label: "Global deadline", type: "date" }],
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
            label: "Go to topic setup",
            kind: "jump",
            jumpPhase: 2,
          },
          {
            id: "impossible-jump-3",
            label: "Go to constraints",
            kind: "jump",
            jumpPhase: 3,
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
          "With flexibility": feasibility.totalFlexAvailable ?? feasibility.totalSlotsAvailable,
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
          "Affected topics": new Set(lateSessions.map((s) => s.topic_id)).size,
        },
        inlineEdits: [{ field: "exam_date", label: "Global deadline", type: "date" }],
        options: [
          {
            id: "late-jump-2",
            label: "Go to topic setup",
            kind: "jump",
            jumpPhase: 2,
          },
          {
            id: "late-jump-3",
            label: "Go to constraints",
            kind: "jump",
            jumpPhase: 3,
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

  return issues.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === "critical" ? -1 : 1
  })
}
