"use server"

// Overload resolution is now handled inline in the phased planner.
// This file is kept as a stub for any remaining imports.

export type AdjustmentInput =
  | { kind: "extendDeadline"; topicId: string; newDeadline: string }
  | { kind: "reduceEffort"; topicId: string; newHours: number }
  | { kind: "increaseDailyMinutes"; deltaMinutes: number }

export async function resolveOverload(): Promise<{ status: "DEPRECATED" }> {
  return { status: "DEPRECATED" }
}
