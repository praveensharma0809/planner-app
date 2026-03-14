-- Migration 008: Fix commit_plan_atomic — add explicit 'merge' keep-mode branch
--
-- BUG: In migration 004 the ELSE branch catches both 'future' and 'merge',
-- causing merge mode to silently delete all future generated tasks instead of
-- preserving them.
--
-- FIX: Add an ELSIF for 'merge' that performs NO deletion, and avoid inserting
-- duplicate sessions for topic/date slots that already have a task.
--
-- 'merge' semantics: keep ALL existing generated tasks; insert new sessions
-- only when that topic/date slot does not already exist.

CREATE OR REPLACE FUNCTION commit_plan_atomic(
  p_user_id            uuid,
  p_tasks              jsonb,
  p_snapshot_summary   text    DEFAULT NULL,
  p_config_snapshot    jsonb   DEFAULT '{}'::jsonb,
  p_keep_mode          text    DEFAULT 'future',
  p_new_plan_start_date date   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today        date := CURRENT_DATE;
  v_snapshot_id  uuid := gen_random_uuid();
  v_task_count   integer;
BEGIN

  -- ── Deletion phase: controlled by keep_mode ─────────────────────────────

  IF p_keep_mode = 'none' THEN
    -- Delete ALL previous generated tasks (including completed past ones)
    DELETE FROM tasks
    WHERE user_id = p_user_id
      AND is_plan_generated = true;

  ELSIF p_keep_mode = 'until' AND p_new_plan_start_date IS NOT NULL THEN
    -- Keep generated tasks only BEFORE the new plan's start date
    DELETE FROM tasks
    WHERE user_id        = p_user_id
      AND is_plan_generated = true
      AND scheduled_date >= p_new_plan_start_date;

  ELSIF p_keep_mode = 'merge' THEN
    -- Keep ALL existing generated tasks — no deletion performed.
    -- New sessions are inserted alongside existing ones.
    NULL;

  ELSE
    -- Default 'future': delete generated tasks from today onwards,
    -- keep past (completed or upcoming-within-today) tasks.
    DELETE FROM tasks
    WHERE user_id        = p_user_id
      AND scheduled_date >= v_today
      AND is_plan_generated = true;
  END IF;

  -- ── Snapshot ─────────────────────────────────────────────────────────────

  INSERT INTO plan_snapshots (id, user_id, task_count, schedule_json, config_snapshot, summary)
  VALUES (v_snapshot_id, p_user_id, 0, p_tasks, p_config_snapshot, p_snapshot_summary);

  -- ── Insert new tasks ──────────────────────────────────────────────────────
  -- Merge mode keeps all existing tasks and only inserts sessions when the
  -- same topic/date/session_type slot does not already exist for the user.

  INSERT INTO tasks (
    user_id, subject_id, topic_id, title, scheduled_date,
    duration_minutes, session_type, priority,
    session_number, total_sessions,
    completed, is_plan_generated, plan_version
  )
  SELECT
    p_user_id,
    incoming.subject_id,
    incoming.topic_id,
    incoming.title,
    incoming.scheduled_date,
    incoming.duration_minutes,
    incoming.session_type,
    incoming.priority,
    incoming.session_number,
    incoming.total_sessions,
    false,
    true,
    v_snapshot_id
  FROM (
    SELECT
      (t->>'subject_id')::uuid AS subject_id,
      (t->>'topic_id')::uuid AS topic_id,
      t->>'title' AS title,
      (t->>'scheduled_date')::date AS scheduled_date,
      (t->>'duration_minutes')::integer AS duration_minutes,
      COALESCE(t->>'session_type', 'core') AS session_type,
      COALESCE((t->>'priority')::integer, 3) AS priority,
      COALESCE((t->>'session_number')::integer, 0) AS session_number,
      COALESCE((t->>'total_sessions')::integer, 0) AS total_sessions
    FROM jsonb_array_elements(p_tasks) AS t
  ) AS incoming
  WHERE p_keep_mode <> 'merge'
    OR NOT EXISTS (
      SELECT 1
      FROM tasks existing
      WHERE existing.user_id = p_user_id
        AND existing.scheduled_date = incoming.scheduled_date
        AND existing.topic_id IS NOT DISTINCT FROM incoming.topic_id
        AND existing.session_type = incoming.session_type
    );

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Update snapshot with actual inserted count
  UPDATE plan_snapshots
  SET task_count = v_task_count
  WHERE id = v_snapshot_id;

  RETURN jsonb_build_object(
    'status',      'SUCCESS',
    'task_count',  v_task_count,
    'snapshot_id', v_snapshot_id
  );
END;
$$;
