-- Migration 004: Add p_keep_mode to commit_plan_atomic
-- Controls what happens to previously generated tasks when a new plan is committed.
--
-- p_keep_mode values:
--   'none'   – delete ALL previous generated tasks (past and future)
--   'until'  – keep previous generated tasks only BEFORE p_new_plan_start_date, delete from that date onward
--   'future' – default: only delete future generated tasks (>= today), keep past (existing behaviour)

CREATE OR REPLACE FUNCTION commit_plan_atomic(
  p_user_id uuid,
  p_tasks jsonb,
  p_snapshot_summary text DEFAULT NULL,
  p_config_snapshot jsonb DEFAULT '{}'::jsonb,
  p_keep_mode text DEFAULT 'future',
  p_new_plan_start_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_snapshot_id uuid := gen_random_uuid();
  v_task_count integer;
  v_cutoff date;
BEGIN

  -- Determine which previous generated tasks to delete based on keep_mode
  IF p_keep_mode = 'none' THEN
    -- Delete ALL previous generated tasks (including past)
    DELETE FROM tasks
    WHERE user_id = p_user_id
      AND is_plan_generated = true;

  ELSIF p_keep_mode = 'until' AND p_new_plan_start_date IS NOT NULL THEN
    -- Keep generated tasks only before the new plan's start date
    DELETE FROM tasks
    WHERE user_id = p_user_id
      AND is_plan_generated = true
      AND scheduled_date >= p_new_plan_start_date;

  ELSE
    -- Default 'future': delete generated tasks from today onward
    DELETE FROM tasks
    WHERE user_id = p_user_id
      AND scheduled_date >= v_today
      AND is_plan_generated = true;
  END IF;

  -- Create snapshot first so we have the ID
  INSERT INTO plan_snapshots (id, user_id, task_count, schedule_json, config_snapshot, summary)
  VALUES (v_snapshot_id, p_user_id, 0, p_tasks, p_config_snapshot, p_snapshot_summary);

  -- Insert new tasks
  INSERT INTO tasks (
    user_id, subject_id, topic_id, title, scheduled_date,
    duration_minutes, session_type, priority,
    session_number, total_sessions,
    completed, is_plan_generated, plan_version
  )
  SELECT
    p_user_id,
    (t->>'subject_id')::uuid,
    (t->>'topic_id')::uuid,
    t->>'title',
    (t->>'scheduled_date')::date,
    (t->>'duration_minutes')::integer,
    COALESCE(t->>'session_type', 'core'),
    COALESCE((t->>'priority')::integer, 3),
    COALESCE((t->>'session_number')::integer, 0),
    COALESCE((t->>'total_sessions')::integer, 0),
    false,
    true,
    v_snapshot_id
  FROM jsonb_array_elements(p_tasks) AS t;

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Update snapshot with actual count
  UPDATE plan_snapshots
  SET task_count = v_task_count
  WHERE id = v_snapshot_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'task_count', v_task_count,
    'snapshot_id', v_snapshot_id
  );
END;
$$;

COMMIT;
