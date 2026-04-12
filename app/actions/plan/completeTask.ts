"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getTodayLocalDate, normalizeLocalDate } from "@/lib/tasks/getTasksForDate"

export type CompleteTaskResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

function getTodayAndYesterdayISO() {
  const today = getTodayLocalDate()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = normalizeLocalDate(yesterdayDate) ?? today
  return { today, yesterday }
}

async function updateStreakOncePerDay(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
) {
  const { today, yesterday } = getTodayAndYesterdayISO()

  // Compare-and-set retries prevent double increments under concurrent completions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("streak_current, streak_longest, streak_last_completed_date")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) {
      return
    }

    if (!profile) return

    const lastDate = profile.streak_last_completed_date
    if (lastDate === today) return

    let newCurrent = profile.streak_current ?? 0
    let newLongest = profile.streak_longest ?? 0

    if (lastDate === yesterday) {
      newCurrent += 1
    } else {
      newCurrent = 1
    }

    if (newCurrent > newLongest) {
      newLongest = newCurrent
    }

    let updateQuery = supabase
      .from("profiles")
      .update({
        streak_current: newCurrent,
        streak_longest: newLongest,
        streak_last_completed_date: today,
      })
      .eq("id", userId)

    updateQuery = lastDate == null
      ? updateQuery.is("streak_last_completed_date", null)
      : updateQuery.eq("streak_last_completed_date", lastDate)

    const { data: updated, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle()

    if (updateError) {
      return
    }

    if (updated) {
      return
    }
  }
}

async function maybeMarkSourceTopicTaskCompleted(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  sourceTopicTaskId: string
) {
  const { data: remainingIncomplete, error: remainingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("task_source", "plan")
    .eq("source_topic_task_id", sourceTopicTaskId)
    .eq("completed", false)
    .limit(1)

  if (remainingError) {
    return
  }

  if ((remainingIncomplete?.length ?? 0) > 0) {
    return
  }

  const { error: topicTaskUpdateError } = await supabase
    .from("topic_tasks")
    .update({ completed: true })
    .eq("id", sourceTopicTaskId)
    .eq("user_id", userId)

  if (topicTaskUpdateError) {
    return
  }
}

export async function completeTask(taskId: string) {
  try {
    if (!taskId || typeof taskId !== "string") {
      return { status: "NOT_FOUND" } satisfies CompleteTaskResponse
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return { status: "UNAUTHORIZED" } satisfies CompleteTaskResponse
    }

    // Step 1: Mark task complete.
    // The .eq("completed", false) guard makes this idempotent -
    // if the task is already done, 0 rows are updated and we stop.
    const { data: updatedTask, error: taskError } = await supabase
      .from("tasks")
      .update({ completed: true })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("completed", false)
      .select("subject_id, task_source, source_topic_task_id")
      .maybeSingle()

    if (taskError) {
      return { status: "ERROR", message: taskError.message } satisfies CompleteTaskResponse
    }

    // Task was already complete or not found - nothing else to do.
    if (!updatedTask) {
      revalidatePath("/dashboard/calendar")
      return { status: "NOT_FOUND" } satisfies CompleteTaskResponse
    }

    // Step 2: Update streak with compare-and-set protection.
    await updateStreakOncePerDay(supabase, user.id)

    // Step 3: Mark linked intake task complete only when all linked plan sessions are done.
    if (
      updatedTask.task_source === "plan"
      && typeof updatedTask.source_topic_task_id === "string"
      && updatedTask.source_topic_task_id.length > 0
    ) {
      await maybeMarkSourceTopicTaskCompleted(
        supabase,
        user.id,
        updatedTask.source_topic_task_id
      )
    }

    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard/subjects")
    revalidatePath("/planner")
    return { status: "SUCCESS" } satisfies CompleteTaskResponse
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Unexpected error",
    } satisfies CompleteTaskResponse
  }
}
