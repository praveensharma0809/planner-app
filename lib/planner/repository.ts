/* eslint-disable @typescript-eslint/no-explicit-any */

type SupabaseLike = any

export async function getPlanSnapshots(
  supabase: SupabaseLike,
  userId: string,
  limit = 20
) {
  return supabase
    .from("plan_snapshots")
    .select("id, user_id, task_count, schedule_json, settings_snapshot, summary, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
}

export async function getTopicsForUser(
  supabase: SupabaseLike,
  userId: string,
  select: string,
  topicIds?: string[]
) {
  const query = supabase
    .from("topics")
    .select(select)
    .eq("user_id", userId)

  if (topicIds && topicIds.length > 0) {
    return query.in("id", topicIds)
  }

  return query
}

export async function getSubjectsForUser(
  supabase: SupabaseLike,
  userId: string,
  select = "id, name, sort_order, deadline, archived"
) {
  return supabase
    .from("subjects")
    .select(select)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
}

export async function getOpenManualTasksByTopic(
  supabase: SupabaseLike,
  userId: string,
  select = "topic_id, title, duration_minutes, sort_order, created_at",
  topicIds?: string[]
) {
  const query = supabase
    .from("tasks")
    .select(select)
    .eq("user_id", userId)
    .eq("task_source", "manual")
    .eq("completed", false)

  if (topicIds && topicIds.length > 0) {
    return query.in("topic_id", topicIds)
  }

  return query
}

export async function getOffDaysForUser(
  supabase: SupabaseLike,
  userId: string
) {
  return supabase.from("off_days").select("date").eq("user_id", userId)
}

export async function getTopicParamsForUser(
  supabase: SupabaseLike,
  userId: string,
  topicIds?: string[]
) {
  const query = supabase
    .from("topics")
    .select(
      "id, estimated_hours, priority, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency"
    )
    .eq("user_id", userId)

  if (topicIds && topicIds.length > 0) {
    return query.in("id", topicIds)
  }

  return query
}

export async function getPlannerSettings(
  supabase: SupabaseLike,
  userId: string,
  select = "*"
) {
  return supabase
    .from("planner_settings")
    .select(select)
    .eq("user_id", userId)
    .maybeSingle()
}

export async function commitPlanAtomic(
  supabase: SupabaseLike,
  args: {
    userId: string
    tasks: unknown
    summary: string
    configSnapshot: unknown
    keepMode: string
    newPlanStartDate: string | null
  }
) {
  return supabase.rpc("commit_plan_atomic", {
    p_user_id: args.userId,
    p_tasks: args.tasks,
    p_snapshot_summary: args.summary,
    p_config_snapshot: args.configSnapshot,
    p_keep_mode: args.keepMode,
    p_new_plan_start_date: args.newPlanStartDate,
  })
}

export async function getPendingPlanTasks(
  supabase: SupabaseLike,
  userId: string
) {
  return supabase
    .from("tasks")
    .select(
      "subject_id, topic_id, title, duration_minutes, session_type, priority, session_number, total_sessions, scheduled_date"
    )
    .eq("user_id", userId)
    .eq("task_source", "plan")
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })
    .order("priority", { ascending: true })
}

export async function getRescheduleContext(
  supabase: SupabaseLike,
  userId: string,
  plannerSettingsSelect: string,
  topicSelect: string
) {
  return Promise.all([
    supabase
      .from("profiles")
      .select("daily_available_minutes, exam_date")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("planner_settings")
      .select(plannerSettingsSelect)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("off_days").select("date").eq("user_id", userId),
    supabase
      .from("subjects")
      .select("id, name, sort_order, deadline")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
    supabase.from("topics").select(topicSelect).eq("user_id", userId),
    supabase
      .from("topics")
      .select(
        "id, estimated_hours, priority, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency"
      )
      .eq("user_id", userId),
  ])
}

export async function getExistingTasksInRange(
  supabase: SupabaseLike,
  userId: string,
  startDate: string,
  endDate: string
) {
  return supabase
    .from("tasks")
    .select("scheduled_date, duration_minutes, task_source, completed")
    .eq("user_id", userId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
}

export async function deletePendingPlanTasks(
  supabase: SupabaseLike,
  userId: string
) {
  return supabase
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("task_source", "plan")
    .eq("completed", false)
}

export async function insertPlanSnapshot(
  supabase: SupabaseLike,
  payload: {
    user_id: string
    task_count: number
    schedule_json: unknown
    settings_snapshot: unknown
    summary: string
  }
) {
  return supabase
    .from("plan_snapshots")
    .insert(payload)
    .select("id")
    .maybeSingle()
}

export async function insertTasks(
  supabase: SupabaseLike,
  payload: unknown
) {
  return supabase.from("tasks").insert(payload)
}
