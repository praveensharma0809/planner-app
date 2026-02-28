"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function completeTask(taskId: string) {
  if (!taskId || typeof taskId !== "string") return

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return

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
    return
  }

  // Task was already complete or not found — nothing else to do.
  if (!updatedTask) {
    revalidatePath("/dashboard/calendar")
    return
  }

  // Step 2: Increment completed_items on the parent subject.
  const { data: subject } = await supabase
    .from("subjects")
    .select("completed_items")
    .eq("id", updatedTask.subject_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (subject) {
    await supabase
      .from("subjects")
      .update({ completed_items: subject.completed_items + 1 })
      .eq("id", updatedTask.subject_id)
      .eq("user_id", user.id)
  }

  // Step 3: Update streak on profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_current, streak_longest, streak_last_completed_date")
    .eq("id", user.id)
    .maybeSingle()

  if (profile) {
    const today = new Date().toISOString().split("T")[0]
    // Compute yesterday in a UTC-safe way
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
    const lastDate = profile.streak_last_completed_date

    let newCurrent = profile.streak_current ?? 0
    let newLongest = profile.streak_longest ?? 0

    if (lastDate === today) {
      // Already counted today; streak unchanged.
    } else if (lastDate === yesterday) {
      newCurrent = newCurrent + 1
    } else {
      // Streak broke (or first ever completion).
      newCurrent = 1
    }

    if (newCurrent > newLongest) {
      newLongest = newCurrent
    }

    await supabase
      .from("profiles")
      .update({
        streak_current: newCurrent,
        streak_longest: newLongest,
        streak_last_completed_date: today
      })
      .eq("id", user.id)
  }

  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard")
}
