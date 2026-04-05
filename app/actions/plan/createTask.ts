"use server"

import { upsertScheduleTask } from "@/app/actions/schedule/upsertScheduleTask"
import { STANDALONE_SUBJECT_ID } from "@/lib/constants"

interface CreateTaskInput {
  subject_id?: string | null
  topic_id?: string
  task_type?: "subject" | "standalone"
  title: string
  scheduled_date: string // YYYY-MM-DD
  duration_minutes: number
  session_type?: "core" | "revision" | "practice"
}

export type CreateTaskResponse =
  | { status: "SUCCESS"; taskId: string }
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }

export async function createTask(input: CreateTaskInput): Promise<CreateTaskResponse> {
  if (input.topic_id) {
    return { status: "ERROR", message: "Topic-linked manual creation is no longer supported." }
  }

  const subjectId = input.subject_id && input.subject_id !== STANDALONE_SUBJECT_ID
    ? input.subject_id
    : STANDALONE_SUBJECT_ID

  const result = await upsertScheduleTask({
    title: input.title,
    subjectId,
    scheduledDate: input.scheduled_date,
    durationMinutes: input.duration_minutes,
  })

  if (result.status === "SUCCESS") {
    return { status: "SUCCESS", taskId: result.taskId }
  }

  if (result.status === "UNAUTHORIZED") {
    return { status: "UNAUTHORIZED" }
  }

  if (result.status === "NOT_FOUND") {
    return { status: "ERROR", message: "Subject not found" }
  }

  return { status: "ERROR", message: result.message }
}
