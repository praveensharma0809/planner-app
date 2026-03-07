"use server"

// This action is now a thin redirect to the new planner pipeline.
// The old analyze flow is replaced by the phased planner.
// Kept for backward compatibility with any remaining callers.

export { generatePlanAction as analyzePlanAction } from "@/app/actions/planner/generatePlan"
export type { GeneratePlanResponse as AnalyzePlanResponse } from "@/app/actions/planner/generatePlan"