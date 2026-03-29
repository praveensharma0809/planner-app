"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type CompleteTaskResponse =
  | { status: "SUCCESS" }
  | { status: "UNAUTHORIZED" }
  | { status: "NOT_FOUND" }
  | { status: "ERROR"; message: string }

function getTodayAndYesterdayISO() {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
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
      console.error("completeTask: profile read error:", profileError.message)
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
      console.error("completeTask: profile update error:", updateError.message)
      return
    }

    if (updated) {
      return
    }
  }
}

export async function completeTask(taskId: string) {
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
  // The .eq("completed", false) guard makes this idempotent —
  // if the task is already done, 0 rows are updated and we stop.
  const { data: updatedTask, error: taskError } = await supabase
    .from("tasks")
    .update({ completed: true })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("completed", false)
    .select("subject_id")
    .maybeSingle()

  if (taskError) {
    console.error("completeTask: task update error:", taskError.message)
    return { status: "ERROR", message: taskError.message } satisfies CompleteTaskResponse
  }

  // Task was already complete or not found — nothing else to do.
  if (!updatedTask) {
    revalidatePath("/dashboard/calendar")
    return { status: "NOT_FOUND" } satisfies CompleteTaskResponse
  }

  // Step 2: Update streak with compare-and-set protection.
  await updateStreakOncePerDay(supabase, user.id)

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
  revalidatePath("/schedule")
  return { status: "SUCCESS" } satisfies CompleteTaskResponse
}
