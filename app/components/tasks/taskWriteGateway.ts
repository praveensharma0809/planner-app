"use client"

import {
  upsertScheduleTask,
  type UpsertScheduleTaskResponse,
} from "@/app/actions/schedule/upsertScheduleTask"

export type UnifiedTaskWriteInput = {
  title: string
  subjectId: string
  scheduledDate: string
  durationMinutes: number
}

export async function createTaskViaUnifiedFlow(
  input: UnifiedTaskWriteInput
): Promise<UpsertScheduleTaskResponse> {
  return upsertScheduleTask(input)
}

export async function saveTaskViaUnifiedFlow(
  input: UnifiedTaskWriteInput & { taskId?: string }
): Promise<UpsertScheduleTaskResponse> {
  return upsertScheduleTask(input)
}
