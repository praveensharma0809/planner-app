"use server"

import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import { logger } from "@/lib/ops/logger"

export type SetTaskCompletionResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

export async function setTaskCompletion(taskId: string, nextCompleted: boolean): Promise<SetTaskCompletionResponse> {
  try {
    if (nextCompleted) {
      return completeTask(taskId)
    }

    return uncompleteTask(taskId)
  } catch (error) {
    logger.error("setTaskCompletion", error)
    return {
      status: "ERROR",
      message: "Something went wrong. Please try again.",
    }
  }
}
