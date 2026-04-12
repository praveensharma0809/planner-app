import { describe, expect, it } from "vitest"
import {
  buildPlanIssues,
  getSessionCoverage,
  hasCriticalIssues,
  MISSING_GENERATED_SESSIONS_MESSAGE,
  type PlannerConstraintValues,
  type PlannerParamValues,
} from "@/lib/planner/draft"
import type { FeasibilityResult, ScheduledSession } from "@/lib/planner/engine"

const constraints: PlannerConstraintValues = {
  study_start_date: "2026-04-03",
  exam_date: "2026-05-03",
  weekday_capacity_minutes: 180,
  weekend_capacity_minutes: 180,
  plan_order: "balanced",
  final_revision_days: 0,
  buffer_percentage: 0,
  max_active_subjects: 0,
  day_of_week_capacity: [null, null, null, null, null, null, null],
  custom_day_capacity: {},
  plan_order_stack: ["urgency", "subject_order", "deadline"],
  flexibility_minutes: 0,
  max_topics_per_subject_per_day: 1,
  min_subject_gap_days: 0,
  subject_ordering: {},
  flexible_threshold: {},
}

const params: PlannerParamValues[] = [
  {
    topic_id: "topic-1",
    estimated_hours: 3,
    deadline: "",
    earliest_start: "",
    depends_on: [],
    session_length_minutes: 60,
    rest_after_days: 0,
    max_sessions_per_day: 0,
    study_frequency: "daily",
  },
]

const feasibility: FeasibilityResult = {
  feasible: true,
  totalSessionsNeeded: 3,
  totalSlotsAvailable: 3,
  totalFlexAvailable: 3,
  globalGap: 0,
  units: [
    {
      unitId: "topic-1",
      name: "Topic 1",
      deadline: "2026-05-03",
      totalSessions: 3,
      availableMinutes: 180,
      status: "safe",
      suggestions: [],
    },
  ],
  suggestions: [],
}

function makeSession(index: number, overrides?: Partial<ScheduledSession>): ScheduledSession {
  return {
    subject_id: "subject-1",
    topic_id: "topic-1",
    title: `Session ${index}`,
    scheduled_date: "2026-04-10",
    duration_minutes: 60,
    session_type: "core",
    session_number: index,
    total_sessions: 3,
    ...overrides,
  }
}

describe("buildPlanIssues generated-session integrity", () => {
  it("flags missing generated sessions when generated sessions are removed", () => {
    const sessions: ScheduledSession[] = [
      makeSession(1),
      makeSession(2),
    ]

    const coverage = getSessionCoverage(feasibility, sessions)
    expect(coverage.missingGeneratedSessions).toBe(1)

    const issues = buildPlanIssues({
      constraints,
      params,
      feasibility,
      sessions,
      planStatus: "READY",
    })

    expect(hasCriticalIssues(issues)).toBe(true)
    expect(issues.some((issue) => issue.userMessage === MISSING_GENERATED_SESSIONS_MESSAGE)).toBe(true)
  })

  it("does not allow manual sessions to satisfy missing generated sessions", () => {
    const sessions: ScheduledSession[] = [
      makeSession(1),
      makeSession(2),
      makeSession(99, {
        topic_id: "",
        title: "Custom Session",
        is_manual: true,
        session_number: 0,
        total_sessions: 0,
      }),
    ]

    const coverage = getSessionCoverage(feasibility, sessions)
    expect(coverage.generatedSessions).toBe(2)
    expect(coverage.manualSessions).toBe(1)
    expect(coverage.missingGeneratedSessions).toBe(1)

    const issues = buildPlanIssues({
      constraints,
      params,
      feasibility,
      sessions,
      planStatus: "READY",
    })

    expect(hasCriticalIssues(issues)).toBe(true)
    expect(issues.some((issue) => issue.userMessage === MISSING_GENERATED_SESSIONS_MESSAGE)).toBe(true)
  })

  it("clears the missing-generated critical issue when generated sessions are restored", () => {
    const sessions: ScheduledSession[] = [
      makeSession(1),
      makeSession(2),
      makeSession(3),
      makeSession(100, {
        topic_id: "",
        title: "Optional Custom Session",
        is_manual: true,
        session_number: 0,
        total_sessions: 0,
      }),
    ]

    const coverage = getSessionCoverage(feasibility, sessions)
    expect(coverage.missingGeneratedSessions).toBe(0)

    const issues = buildPlanIssues({
      constraints,
      params,
      feasibility,
      sessions,
      planStatus: "READY",
    })

    expect(issues.some((issue) => issue.issueId === "unscheduled-sessions")).toBe(false)
  })
})
