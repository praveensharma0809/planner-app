-- Migration 003: Add session_number and total_sessions to tasks table
-- These track "Part 2/5" style labeling for multi-session topics.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS session_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 0;

-- Update commit_plan_atomic to extract and store session_number / total_sessions
CREATE OR REPLACE FUNCTION commit_plan_atomic(
  p_user_id uuid,
  p_tasks jsonb,
  p_snapshot_summary text DEFAULT NULL,
  p_config_snapshot jsonb DEFAULT '{}'::jsonb
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
BEGIN
  -- Delete future generated tasks
  DELETE FROM tasks
  WHERE user_id = p_user_id
    AND scheduled_date >= v_today
    AND is_plan_generated = true;

  -- Create snapshot first so we have the ID
  INSERT INTO plan_snapshots (id, user_id, task_count, schedule_json, config_snapshot, summary)
  VALUES (v_snapshot_id, p_user_id, 0, p_tasks, p_config_snapshot, p_snapshot_summary);

  -- Insert new tasks (now includes session_number + total_sessions)
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
  FROM jsonb_array_elements(p_tasks) AS t
  WHERE (t->>'scheduled_date')::date >= v_today;

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
