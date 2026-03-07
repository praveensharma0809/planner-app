"use server"

// This action is now a thin redirect to the new planner pipeline.
export { commitPlan } from "@/app/actions/planner/commitPlan"
export type { CommitPlanResponse } from "@/app/actions/planner/commitPlan"