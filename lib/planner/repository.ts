import { createServerSupabaseClient } from "@/lib/supabase/server"

type SupabaseLike = Awaited<ReturnType<typeof createServerSupabaseClient>>

/**
 * Reads the most recent plan snapshots for a user from the plan_snapshots table.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param limit - Maximum number of snapshots to return (default 20).
 * @returns Supabase query result with plan snapshot rows ordered by created_at descending.
 */
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

/**
 * Reads active topics for a user, optionally filtered by subject IDs and/or topic IDs.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param select - Column selection string for the topics query.
 * @param topicIds - Optional array of topic IDs to filter by.
 * @param subjectIds - Optional array of subject IDs to filter by.
 * @returns Supabase query result with matching topic rows (archived=false only).
 */
export async function getTopicsForUser(
  supabase: SupabaseLike,
  userId: string,
  select: string,
  topicIds?: string[],
  subjectIds?: string[]
) {
  let query = supabase
    .from("topics")
    .select(select)
    .eq("user_id", userId)
    .eq("archived", false)

  if (subjectIds && subjectIds.length > 0) {
    query = query.in("subject_id", subjectIds)
  }

  if (topicIds && topicIds.length > 0) {
    query = query.in("id", topicIds)
  }

  return query
}

/**
 * Reads non-archived, non-"others" subjects for a user, ordered by sort_order.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param select - Column selection string (defaults to "id, name, sort_order, deadline, archived").
 * @returns Supabase query result with matching subject rows.
 */
export async function getSubjectsForUser(
  supabase: SupabaseLike,
  userId: string,
  select = "id, name, sort_order, deadline, archived"
) {
  return supabase
    .from("subjects")
    .select(select)
    .eq("user_id", userId)
    .eq("archived", false)
    .not("name", "ilike", "others")
     .not("name", "ilike", "__deprecated_others__")
    .order("sort_order", { ascending: true })
}

/**
 * Reads incomplete topic_tasks for a user, optionally filtered by topic IDs and/or task IDs.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param select - Column selection string.
 * @param topicIds - Optional array of topic IDs to filter by.
 * @param taskIds - Optional array of task IDs to filter by.
 * @returns Supabase query result with matching incomplete topic_task rows.
 */
export async function getOpenManualTasksByTopic(
  supabase: SupabaseLike,
  userId: string,
  select = "id, topic_id, title, duration_minutes, sort_order, created_at",
  topicIds?: string[],
  taskIds?: string[]
) {
  let query = supabase
    .from("topic_tasks")
    .select(select)
    .eq("user_id", userId)
    .eq("completed", false)

  if (topicIds && topicIds.length > 0) {
    query = query.in("topic_id", topicIds)
  }

  if (taskIds && taskIds.length > 0) {
    query = query.in("id", taskIds)
  }

  return query
}

/**
 * Reads planner parameter columns for a user's topics, optionally filtered by topic IDs.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param topicIds - Optional array of topic IDs to filter by.
 * @returns Supabase query result with topic parameter columns.
 */
export async function getTopicParamsForUser(
  supabase: SupabaseLike,
  userId: string,
  topicIds?: string[]
) {
  const query = supabase
    .from("topics")
    .select(
      "id, estimated_hours, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency"
    )
    .eq("user_id", userId)

  if (topicIds && topicIds.length > 0) {
    return query.in("id", topicIds)
  }

  return query
}

/**
 * Reads a user's planner settings row (at most one).
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param select - Column selection string (defaults to "*").
 * @returns Supabase query result with a single planner_settings row, or null.
 */
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

/**
 * Calls the commit_plan_atomic_v2 RPC to atomically write a plan to the database
 * within a transaction, replacing existing plan tasks with the new schedule.
 *
 * @param supabase - Supabase client instance.
 * @param args - Object containing userId, tasks (plan payload), summary, configSnapshot, keepMode, newPlanStartDate, and commitHash.
 * @returns Supabase RPC result.
 */
export async function commitPlanAtomic(
  supabase: SupabaseLike,
  args: {
    userId: string
    tasks: unknown
    summary: string
    configSnapshot: unknown
    keepMode: string
    newPlanStartDate: string | null
    commitHash: string
  }
) {
  return supabase.rpc("commit_plan_atomic_v2", {
    p_tasks: args.tasks,
    p_snapshot_summary: args.summary,
    p_config_snapshot: args.configSnapshot,
    p_keep_mode: args.keepMode,
    p_new_plan_start_date: args.newPlanStartDate,
    p_commit_hash: args.commitHash,
  })
}

/**
 * Reads all incomplete plan-sourced subject tasks for a user, ordered by scheduled_date ascending.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @returns Supabase query result with pending plan task rows.
 */
export async function getPendingPlanTasks(
  supabase: SupabaseLike,
  userId: string
) {
  return supabase
    .from("tasks")
    .select(
      "id, subject_id, topic_id, title, duration_minutes, session_type, session_number, total_sessions, scheduled_date, source_topic_task_id"
    )
    .eq("user_id", userId)
    .eq("task_source", "plan")
    .eq("task_type", "subject")
    .eq("completed", false)
    .order("scheduled_date", { ascending: true })
}

/**
 * Fetches the full context needed for plan rescheduling in parallel: planner settings,
 * subjects, topics, and topic parameters.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param plannerSettingsSelect - Column selection string for planner_settings.
 * @param topicSelect - Column selection string for topics.
 * @returns Tuple of [plannerSettingsResult, subjectsResult, topicsResult, topicParamsResult].
 */
export async function getRescheduleContext(
  supabase: SupabaseLike,
  userId: string,
  plannerSettingsSelect: string,
  topicSelect: string
) {
  const [configRes, subjectsRes] = await Promise.all([
    supabase
      .from("planner_settings")
      .select(plannerSettingsSelect)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("subjects")
      .select("id, name, sort_order, deadline")
      .eq("user_id", userId)
      .eq("archived", false)
      .not("name", "ilike", "others")
       .not("name", "ilike", "__deprecated_others__")
      .order("sort_order", { ascending: true }),
  ])

  const subjectIds = ((subjectsRes.data ?? []) as Array<{ id: string }>).map(
    (subject) => subject.id
  )

  const [topicsRes, topicParamsRes] = subjectIds.length > 0
    ? await Promise.all([
      supabase
        .from("topics")
        .select(topicSelect)
        .eq("user_id", userId)
        .eq("archived", false)
        .in("subject_id", subjectIds),
      supabase
        .from("topics")
        .select(
          "id, estimated_hours, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency"
        )
        .eq("user_id", userId)
        .eq("archived", false)
        .in("subject_id", subjectIds),
    ])
    : [
      { data: [], error: null },
      { data: [], error: null },
    ]

  return [configRes, subjectsRes, topicsRes, topicParamsRes]
}

/**
 * Reads existing subject tasks (of any source/type) within a date range, used to compute
 * daily capacity during rescheduling.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @param startDate - ISO date string for the range start (inclusive).
 * @param endDate - ISO date string for the range end (inclusive).
 * @returns Supabase query result with matching task rows.
 */
export async function getExistingTasksInRange(
  supabase: SupabaseLike,
  userId: string,
  startDate: string,
  endDate: string
) {
  return supabase
    .from("tasks")
    .select("scheduled_date, duration_minutes, task_source, task_type, completed")
    .eq("user_id", userId)
    .eq("task_type", "subject")
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
}

/**
 * Deletes all incomplete plan-generated subject tasks for a user.
 *
 * @param supabase - Supabase client instance.
 * @param userId - The authenticated user's ID.
 * @returns Supabase delete result.
 */
export async function deletePendingPlanTasks(
  supabase: SupabaseLike,
  userId: string
) {
  return supabase
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("task_source", "plan")
    .eq("task_type", "subject")
    .eq("completed", false)
}

/**
 * Inserts a new plan snapshot row into the plan_snapshots table and returns the new row's ID.
 *
 * @param supabase - Supabase client instance.
 * @param payload - Object with user_id, task_count, schedule_json, settings_snapshot, and summary.
 * @returns Supabase insert result with the new row's id (maybeSingle).
 */
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

/**
 * Inserts one or more task rows into the tasks table.
 *
 * @param supabase - Supabase client instance.
 * @param payload - Single task object or array of task objects to insert.
 * @returns Supabase insert result.
 */
export async function insertTasks(
  supabase: SupabaseLike,
  payload: unknown
) {
  return supabase.from("tasks").insert(payload)
}
