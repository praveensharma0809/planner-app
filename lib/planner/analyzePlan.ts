import type { Subject } from "@/lib/types/db"
import { overloadAnalyzer, type OverloadResult } from "@/lib/planner/overloadAnalyzer"
import { scheduler, type ScheduledTask, type SchedulerMode } from "@/lib/planner/scheduler"

export type AnalyzePlanStatus =
  | { status: "NO_SUBJECTS" }
  | ({ status: "OVERLOAD" } & OverloadResult)
  | {
      status: "READY"
      tasks: ScheduledTask[]
      taskCount: number
      overload: OverloadResult
    }

export function analyzePlan(
  subjects: Subject[],
  dailyAvailableMinutes: number,
  today: Date,
  mode: SchedulerMode = "strict",
  examDate?: string | null,
  offDays: Set<string> = new Set()
): AnalyzePlanStatus {
  if (!subjects || subjects.length === 0) {
    return { status: "NO_SUBJECTS" }
  }

  const overload = overloadAnalyzer(
    subjects,
    dailyAvailableMinutes,
    today,
    examDate,
    offDays
  )

  if (overload.overload && mode === "strict") {
    return { status: "OVERLOAD", ...overload }
  }

  const schedule = scheduler(subjects, dailyAvailableMinutes, today, {
    examDeadline: examDate,
    offDays
  })

  return {
    status: "READY",
    tasks: schedule.tasks,
    taskCount: schedule.tasks.length,
    overload
  }
}