
import { supabase } from "@/lib/supabase"
import { overloadAnalyzer } from "@/lib/planner/overloadAnalyzer"
import { scheduler } from "@/lib/planner/scheduler"

export async function generatePlan(mode: "strict" | "auto") {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const today = new Date()

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_available_minutes")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { status: "NO_PROFILE" }
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", user.id)

  if (!subjects || subjects.length === 0) {
    return { status: "NO_SUBJECTS" }
  }

  const overload = overloadAnalyzer(
    subjects,
    profile.daily_available_minutes,
    today
  )

  if (overload.overload && mode === "strict") {
    return {
      status: "OVERLOAD",
      ...overload
    }
  }

  const result = scheduler(
    subjects,
    profile.daily_available_minutes,
    mode,
    today
  )

  await supabase
    .from("tasks")
    .delete()
    .eq("user_id", user.id)
    .gte("scheduled_date", today.toISOString().split("T")[0])
    .eq("is_plan_generated", true)

  const tasksToInsert = result.tasks.map(task => ({
    user_id: user.id,
    subject_id: task.subject_id,
    scheduled_date: task.scheduled_date,
    duration_minutes: task.duration_minutes,
    title: task.title,
    priority: task.priority,
    completed: false,
    is_plan_generated: true
  }))

  if (tasksToInsert.length > 0) {
    await supabase.from("tasks").insert(tasksToInsert)
  }

  return {
    status: "SUCCESS",
    taskCount: tasksToInsert.length
  }
}
