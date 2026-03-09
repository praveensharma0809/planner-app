"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generatePlan, type PlanResult } from "@/lib/planner/analyzePlan"
import type { PlannableUnit, GlobalConstraints } from "@/lib/planner/types"
import type { TopicParams, PlanConfig, Topic } from "@/lib/types/db"
import { durationSince, trackServerEvent } from "@/lib/ops/telemetry"

export type GeneratePlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_CONFIG" }
  | { status: "NO_TOPICS" }
  | PlanResult

export async function generatePlanAction(): Promise<GeneratePlanResponse> {
  const startedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await trackServerEvent({
      supabase,
      eventName: "planner.generate",
      status: "error",
      userId: null,
      durationMs: durationSince(startedAt),
      metadata: { reason: "unauthorized" },
    })
    return { status: "UNAUTHORIZED" }
  }

  const track = async (status: "success" | "warning" | "error", metadata: Record<string, unknown>) => {
    await trackServerEvent({
      supabase,
      eventName: "planner.generate",
      status,
      userId: user.id,
      durationMs: durationSince(startedAt),
      metadata,
    })
  }

  // Load plan config
  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!config) {
    await track("error", { reason: "no_config" })
    return { status: "NO_CONFIG" }
  }
  const planConfig = config as PlanConfig

  // Load topics with their subjects and params
  const { data: topics } = await supabase
    .from("topics")
    .select("id, user_id, subject_id, name, sort_order, created_at")
    .eq("user_id", user.id)

  if (!topics || topics.length === 0) {
    await track("warning", { reason: "no_topics_raw" })
    return { status: "NO_TOPICS" }
  }

  // Load subjects for name lookup
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, sort_order")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  const subjectNameMap = new Map<string, string>()
  const subjectOrderMap = new Map<string, number>()
  for (const s of subjects ?? []) {
    subjectNameMap.set(s.id, s.name)
    subjectOrderMap.set(s.id, s.sort_order ?? 0)
  }

  // Filter out topics for archived subjects
  const activeSubjectIds = new Set((subjects ?? []).map((s) => s.id))
  const activeTopics = (topics as Topic[])
    .filter((t) => activeSubjectIds.has(t.subject_id))
    .sort((a, b) => {
      const subjectA = subjectOrderMap.get(a.subject_id) ?? Number.MAX_SAFE_INTEGER
      const subjectB = subjectOrderMap.get(b.subject_id) ?? Number.MAX_SAFE_INTEGER
      if (subjectA !== subjectB) return subjectA - subjectB
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at)
      return a.id.localeCompare(b.id)
    })

  if (activeTopics.length === 0) {
    await track("warning", { reason: "no_topics_active_subjects" })
    return { status: "NO_TOPICS" }
  }

  // Load topic params
  const topicIds = activeTopics.map((t) => t.id)
  const { data: params } = await supabase
    .from("topic_params")
    .select("*")
    .eq("user_id", user.id)
    .in("topic_id", topicIds)

  const paramMap = new Map<string, TopicParams>()
  for (const p of (params ?? []) as TopicParams[]) {
    paramMap.set(p.topic_id, p)
  }

  // Load off-days
  const { data: offDayRows } = await supabase
    .from("off_days")
    .select("date")
    .eq("user_id", user.id)

  const offDays = new Set<string>((offDayRows ?? []).map((r) => r.date))

  // Build plannable units
  const units: PlannableUnit[] = activeTopics.flatMap((t) => {
    const p = paramMap.get(t.id)
    if (!p || p.estimated_hours <= 0) return []

    const unit: PlannableUnit = {
      id: t.id,
      subject_id: t.subject_id,
      subject_name: subjectNameMap.get(t.subject_id) ?? "Unknown",
      topic_name: t.name,
      estimated_minutes: Math.round(p.estimated_hours * 60),
      session_length_minutes: p.session_length_minutes ?? 60,
      priority: p.priority,
      deadline: p.deadline ?? planConfig.exam_date,
      depends_on: p.depends_on ?? [],
    }

    if (p.earliest_start) {
      unit.earliest_start = p.earliest_start
    }

    return [unit]
  })

  if (units.length === 0) {
    await track("warning", { reason: "no_topics_with_effort", activeTopics: activeTopics.length })
    return { status: "NO_TOPICS" }
  }

  const constraints: GlobalConstraints = {
    study_start_date: planConfig.study_start_date,
    exam_date: planConfig.exam_date,
    weekday_capacity_minutes: planConfig.weekday_capacity_minutes,
    weekend_capacity_minutes: planConfig.weekend_capacity_minutes,
    plan_order: (planConfig.plan_order as GlobalConstraints["plan_order"]) ?? "balanced",
    final_revision_days: planConfig.final_revision_days,
    buffer_percentage: planConfig.buffer_percentage,
    max_active_subjects: planConfig.max_active_subjects ?? 0,
  }

  const result = generatePlan({ units, constraints, offDays })

  const isFeasibilityResult = result.status === "READY" || result.status === "INFEASIBLE"

  await track(result.status === "READY" ? "success" : "warning", {
    resultStatus: result.status,
    unitCount: units.length,
    sessionCount: result.status === "READY" ? result.schedule.length : 0,
    feasible: isFeasibilityResult ? result.feasibility.feasible : null,
  })

  return result
}
