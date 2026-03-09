"use server"

import { commitPlan } from "@/app/actions/planner/commitPlan"
import { generatePlanAction } from "@/app/actions/planner/generatePlan"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"

const DEFAULT_TOPIC_HOURS = 6
const DEFAULT_PRIORITY = 3
const DEFAULT_SESSION_MINUTES = 60

export type QuickStartPlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_SUBJECTS" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; taskCount: number }

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate + "T12:00:00")
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

export async function quickStartPlan(): Promise<QuickStartPlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.quick_start",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  const track = async (status: "started" | "success" | "warning" | "error", metadata: Record<string, unknown>) => {
    await trackServerEvent({
      supabase,
      eventName: "planner.quick_start",
      status,
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata,
    })
  }

  await track("started", { entry: "onboarding" })

  const today = todayISO()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("daily_available_minutes, exam_date")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    await track("error", { reason: "profile_load_failed", message: profileError?.message ?? null })
    return { status: "ERROR", message: profileError?.message ?? "Profile not found." }
  }

  const examDate =
    profile.exam_date && profile.exam_date >= today
      ? profile.exam_date
      : addDays(today, 90)

  const dailyMinutes = Math.max(30, profile.daily_available_minutes ?? 120)

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name, sort_order")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  if (subjectsError) {
    await track("error", { reason: "subjects_load_failed", message: subjectsError.message })
    return { status: "ERROR", message: subjectsError.message }
  }

  if (!subjects || subjects.length === 0) {
    await track("warning", { reason: "no_subjects" })
    return { status: "NO_SUBJECTS" }
  }

  const subjectIds = subjects.map((subject) => subject.id)

  const { data: existingTopics, error: topicsError } = await supabase
    .from("topics")
    .select("id, subject_id")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds)

  if (topicsError) {
    await track("error", { reason: "topics_load_failed", message: topicsError.message })
    return { status: "ERROR", message: topicsError.message }
  }

  const hasTopicBySubject = new Set((existingTopics ?? []).map((topic) => topic.subject_id))

  const topicsToInsert = subjects
    .filter((subject) => !hasTopicBySubject.has(subject.id))
    .map((subject) => ({
      user_id: user.id,
      subject_id: subject.id,
      name: `${subject.name} - Main`,
      sort_order: 0,
    }))

  if (topicsToInsert.length > 0) {
    const { error: insertTopicError } = await supabase.from("topics").insert(topicsToInsert)
    if (insertTopicError) {
      await track("error", { reason: "topics_insert_failed", message: insertTopicError.message })
      return { status: "ERROR", message: insertTopicError.message }
    }
  }

  const { data: allTopics, error: allTopicsError } = await supabase
    .from("topics")
    .select("id")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds)

  if (allTopicsError) {
    await track("error", { reason: "topics_reload_failed", message: allTopicsError.message })
    return { status: "ERROR", message: allTopicsError.message }
  }

  const topicIds = (allTopics ?? []).map((topic) => topic.id)
  if (topicIds.length === 0) {
    await track("error", { reason: "topics_missing_after_insert" })
    return { status: "ERROR", message: "Could not create topics for quick start." }
  }

  const { data: existingParams, error: paramsError } = await supabase
    .from("topic_params")
    .select("topic_id")
    .eq("user_id", user.id)
    .in("topic_id", topicIds)

  if (paramsError) {
    await track("error", { reason: "topic_params_load_failed", message: paramsError.message })
    return { status: "ERROR", message: paramsError.message }
  }

  const existingParamIds = new Set((existingParams ?? []).map((param) => param.topic_id))

  const paramsToInsert = topicIds
    .filter((topicId) => !existingParamIds.has(topicId))
    .map((topicId) => ({
      user_id: user.id,
      topic_id: topicId,
      estimated_hours: DEFAULT_TOPIC_HOURS,
      priority: DEFAULT_PRIORITY,
      deadline: examDate,
      earliest_start: today,
      depends_on: [],
      revision_sessions: 0,
      practice_sessions: 0,
      session_length_minutes: DEFAULT_SESSION_MINUTES,
      updated_at: new Date().toISOString(),
    }))

  if (paramsToInsert.length > 0) {
    const { error: insertParamsError } = await supabase.from("topic_params").insert(paramsToInsert)
    if (insertParamsError) {
      await track("error", { reason: "topic_params_insert_failed", message: insertParamsError.message })
      return { status: "ERROR", message: insertParamsError.message }
    }
  }

  const { error: configError } = await supabase.from("plan_config").upsert(
    {
      user_id: user.id,
      study_start_date: today,
      exam_date: examDate,
      weekday_capacity_minutes: dailyMinutes,
      weekend_capacity_minutes: dailyMinutes,
      plan_order: "balanced",
      final_revision_days: 2,
      buffer_percentage: 10,
      max_active_subjects: 2,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (configError) {
    await track("error", { reason: "plan_config_upsert_failed", message: configError.message })
    return { status: "ERROR", message: configError.message }
  }

  const generated = await generatePlanAction()

  if (generated.status === "NO_CONFIG") {
    await track("error", { reason: "generate_no_config" })
    return { status: "ERROR", message: "Plan configuration missing." }
  }

  if (generated.status === "NO_TOPICS") {
    await track("error", { reason: "generate_no_topics" })
    return { status: "ERROR", message: "No topics available to plan." }
  }

  if (generated.status === "INFEASIBLE") {
    await track("warning", {
      reason: "generate_infeasible",
      globalGap: generated.feasibility.globalGap,
    })
    return {
      status: "ERROR",
      message: "Quick start could not produce a feasible schedule. Increase daily hours or move exam date.",
    }
  }

  if (generated.status !== "READY") {
    await track("error", { reason: "generate_unknown_status", status: generated.status })
    return { status: "ERROR", message: "Unable to generate plan right now." }
  }

  if (generated.schedule.length === 0) {
    await track("error", { reason: "generate_empty_schedule" })
    return { status: "ERROR", message: "Quick start generated no sessions." }
  }

  const commit = await commitPlan(generated.schedule, "future", "Quick start auto plan")
  if (commit.status !== "SUCCESS") {
    if (commit.status === "UNAUTHORIZED") {
      await track("error", { reason: "commit_unauthorized" })
      return { status: "UNAUTHORIZED" }
    }
    await track("error", { reason: "commit_failed", message: commit.message })
    return { status: "ERROR", message: commit.message }
  }

  await track("success", {
    subjectCount: subjects.length,
    topicCount: topicIds.length,
    taskCount: commit.taskCount,
  })

  return { status: "SUCCESS", taskCount: commit.taskCount }
}
