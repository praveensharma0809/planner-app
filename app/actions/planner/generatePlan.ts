"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generatePlan, type PlanResult } from "@/lib/planner/analyzePlan"
import type { PlannableUnit, GlobalConstraints } from "@/lib/planner/types"
import type { TopicParams, PlanConfig, Topic } from "@/lib/types/db"

export type GeneratePlanResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "NO_CONFIG" }
  | { status: "NO_TOPICS" }
  | PlanResult

export async function generatePlanAction(): Promise<GeneratePlanResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  // Load plan config
  const { data: config } = await supabase
    .from("plan_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!config) return { status: "NO_CONFIG" }
  const planConfig = config as PlanConfig

  // Load topics with their subjects and params
  const { data: topics } = await supabase
    .from("topics")
    .select("id, user_id, subject_id, name, sort_order, created_at")
    .eq("user_id", user.id)

  if (!topics || topics.length === 0) return { status: "NO_TOPICS" }

  // Load subjects for name lookup
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("archived", false)

  const subjectNameMap = new Map<string, string>()
  for (const s of subjects ?? []) {
    subjectNameMap.set(s.id, s.name)
  }

  // Filter out topics for archived subjects
  const activeSubjectIds = new Set((subjects ?? []).map((s) => s.id))
  const activeTopics = (topics as Topic[]).filter((t) =>
    activeSubjectIds.has(t.subject_id)
  )

  if (activeTopics.length === 0) return { status: "NO_TOPICS" }

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
      priority: p.priority,
      deadline: p.deadline ?? planConfig.exam_date,
      depends_on: p.depends_on ?? [],
      revision_sessions: p.revision_sessions,
      practice_sessions: p.practice_sessions,
    }

    if (p.earliest_start) {
      unit.earliest_start = p.earliest_start
    }

    return [unit]
  })

  if (units.length === 0) return { status: "NO_TOPICS" }

  const constraints: GlobalConstraints = {
    study_start_date: planConfig.study_start_date,
    exam_date: planConfig.exam_date,
    weekday_capacity_minutes: planConfig.weekday_capacity_minutes,
    weekend_capacity_minutes: planConfig.weekend_capacity_minutes,
    session_length_minutes: planConfig.session_length_minutes,
    final_revision_days: planConfig.final_revision_days,
    buffer_percentage: planConfig.buffer_percentage,
  }

  return generatePlan({ units, constraints, offDays })
}
