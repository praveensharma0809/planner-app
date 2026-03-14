import type { PlanInput, PlanResult } from "./types"
import { checkFeasibility } from "./feasibility"
import { schedule } from "./scheduler"

export type { PlanResult }

export function generatePlan(input: PlanInput): PlanResult {
  const { units, constraints, offDays } = input

  if (!units || units.length === 0) {
    return { status: "NO_UNITS" }
  }

  const feasibility = checkFeasibility(units, constraints, offDays)

  // Always attempt scheduling — even when technically infeasible the
  // scheduler can produce a best-effort plan the user can review.
  const sessions = schedule(units, constraints, offDays)

  if (sessions.length === 0) {
    if (!feasibility.feasible) {
      return { status: "INFEASIBLE", feasibility }
    }
    return { status: "NO_DAYS" }
  }

  // Compute expected vs placed sessions to detect partial plans
  const expectedSessions = feasibility.units.reduce(
    (sum, u) => sum + u.totalSessions,
    0
  )
  const droppedSessions = Math.max(0, expectedSessions - sessions.length)

  if (droppedSessions > 0 && !feasibility.feasible) {
    return {
      status: "PARTIAL",
      schedule: sessions,
      feasibility,
      droppedSessions,
    }
  }

  return {
    status: "READY",
    schedule: sessions,
    feasibility,
  }
}