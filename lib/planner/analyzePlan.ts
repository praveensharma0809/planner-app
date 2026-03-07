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

  if (!feasibility.feasible) {
    return { status: "INFEASIBLE", feasibility }
  }

  const sessions = schedule(units, constraints, offDays)

  return {
    status: "READY",
    schedule: sessions,
    feasibility,
  }
}