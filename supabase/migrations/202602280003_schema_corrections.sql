-- Schema corrections migration
-- 1. Fix off_days.id missing default
-- 2. Ensure profiles references auth.users (data integrity)
-- 3. Keep complete_task_with_streak function for reference / admin use
--    (app code now uses direct table operations instead of RPC).

BEGIN;

-- 1. off_days.id: add gen_random_uuid() default so inserts work without
--    providing an explicit id value.
ALTER TABLE public.off_days
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. profiles → auth.users FK.
--    Add only if missing. This prevents orphaned profile rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name    = 'profiles'
      AND table_schema  = 'public'
      AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

-- 3. Rebuild complete_task_with_streak cleanly so the schema cache entry is
--    fresh if it is ever needed directly. The application no longer calls this
--    via PostgREST RPC — all task-completion logic runs through direct table
--    updates in the completeTask server action — but keeping the function
--    available is harmless and useful for admin/backfill scripts.
CREATE OR REPLACE FUNCTION public.complete_task_with_streak(p_task_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task   tasks%rowtype;
  v_today  date := current_date;
  v_yesterday date := current_date - interval '1 day';
  v_current  integer;
  v_longest  integer;
  v_last_date date;
BEGIN
  -- Acquire row lock; verify ownership.
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  IF v_task.completed THEN
    RETURN json_build_object('status', 'already_completed');
  END IF;

  -- Mark task complete.
  UPDATE tasks
  SET completed = true
  WHERE id = p_task_id
    AND user_id = auth.uid();

  -- Increment subject.
  UPDATE subjects
  SET completed_items = completed_items + 1
  WHERE id = v_task.subject_id
    AND user_id = auth.uid();

  -- Update streak.
  SELECT streak_current, streak_longest, streak_last_completed_date
  INTO v_current, v_longest, v_last_date
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'no_profile');
  END IF;

  v_current := COALESCE(v_current, 0);
  v_longest := COALESCE(v_longest, 0);

  IF v_last_date = v_today THEN
    NULL; -- Already counted today.
  ELSIF v_last_date = v_yesterday THEN
    v_current := v_current + 1;
  ELSE
    v_current := 1;
  END IF;

  IF v_current > v_longest THEN
    v_longest := v_current;
  END IF;

  UPDATE profiles
  SET streak_current              = v_current,
      streak_longest              = v_longest,
      streak_last_completed_date  = v_today
  WHERE id = auth.uid();

  RETURN json_build_object('status', 'ok');
END;
$$;

COMMENT ON FUNCTION public.complete_task_with_streak(uuid) IS
  'Admin/backfill helper. Application uses direct table ops via completeTask server action instead.';

COMMIT;
