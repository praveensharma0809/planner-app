-- =============================================================================
-- StudyHard Planner Redesign Migration
-- Run against the production Supabase database
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop legacy objects up front so later column drops do not fail on dependencies.
DROP VIEW IF EXISTS public.subject_workload_view CASCADE;
DROP FUNCTION IF EXISTS public.compute_subject_intelligence() CASCADE;
DROP FUNCTION IF EXISTS public.complete_task_with_streak(uuid);
DROP FUNCTION IF EXISTS public.increment_completed_items(uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

CREATE TABLE IF NOT EXISTS topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',
  revision_sessions   integer NOT NULL DEFAULT 0 CHECK (revision_sessions >= 0),
  practice_sessions   integer NOT NULL DEFAULT 0 CHECK (practice_sessions >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_params_user ON topic_params(user_id);

CREATE TABLE IF NOT EXISTS plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Migrate existing data into new structure
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Create a default topic for each existing subject
INSERT INTO topics (id, user_id, subject_id, name, sort_order, created_at)
SELECT
  gen_random_uuid(),
  s.user_id,
  s.id,
  s.name,
  0,
  s.created_at
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM topics t WHERE t.subject_id = s.id
);

-- 2b. Create topic_params from existing subject workload data
INSERT INTO topic_params (user_id, topic_id, estimated_hours, priority, deadline)
SELECT
  t.user_id,
  t.id,
  GREATEST(0, ROUND(((s.total_items - s.completed_items) * s.avg_duration_minutes) / 60.0, 1)),
  s.priority,
  s.deadline
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM topic_params tp WHERE tp.topic_id = t.id
);

-- 2c. Re-parent subtopics: add topic_id column, populate it
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE CASCADE;

UPDATE subtopics st
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = st.subject_id
  AND st.topic_id IS NULL;

-- 2d. Create plan_config from profiles
INSERT INTO plan_config (user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes)
SELECT
  p.id,
  CURRENT_DATE,
  COALESCE(p.exam_date, CURRENT_DATE + INTERVAL '90 days'),
  COALESCE(p.daily_available_minutes, 120),
  COALESCE(p.daily_available_minutes, 120)
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_config pc WHERE pc.user_id = p.id
);

-- 2e. Migrate plan_events to plan_snapshots
INSERT INTO plan_snapshots (user_id, task_count, schedule_json, config_snapshot, summary, created_at)
SELECT
  pe.user_id,
  pe.task_count,
  '[]'::jsonb,
  '{}'::jsonb,
  pe.summary,
  pe.created_at
FROM plan_events pe
WHERE NOT EXISTS (
  SELECT 1 FROM plan_snapshots ps
  WHERE ps.user_id = pe.user_id AND ps.created_at = pe.created_at
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Modify existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Tasks: add topic_id, session_type, plan_version
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'core'
  CHECK (session_type IN ('core', 'revision', 'practice'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_version uuid;

-- Backfill topic_id for existing tasks
UPDATE tasks tk
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = tk.subject_id
  AND tk.topic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_version ON tasks(plan_version);

-- 3b. off_days: fix missing default on id
ALTER TABLE off_days ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3c. subtopics: make topic_id NOT NULL, drop old columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subtopics WHERE topic_id IS NULL) THEN
    EXECUTE 'ALTER TABLE subtopics ALTER COLUMN topic_id SET NOT NULL';
  END IF;
END $$;

ALTER TABLE subtopics DROP COLUMN IF EXISTS total_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS subject_id;

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id);

-- 3d. Subjects: add sort_order, drop legacy workload/intelligence columns
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS avg_duration_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS total_items_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS completed_items_valid;

ALTER TABLE subjects DROP COLUMN IF EXISTS total_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS avg_duration_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS deadline;
ALTER TABLE subjects DROP COLUMN IF EXISTS priority;
ALTER TABLE subjects DROP COLUMN IF EXISTS mandatory;
ALTER TABLE subjects DROP COLUMN IF EXISTS custom_daily_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS remaining_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS urgency_score;
ALTER TABLE subjects DROP COLUMN IF EXISTS health_state;
ALTER TABLE subjects DROP COLUMN IF EXISTS estimated_completion_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Drop legacy objects
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS plan_events;
DROP INDEX IF EXISTS idx_subtopics_subject_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users select own topics" ON topics;
DROP POLICY IF EXISTS "Users insert own topics" ON topics;
DROP POLICY IF EXISTS "Users update own topics" ON topics;
DROP POLICY IF EXISTS "Users delete own topics" ON topics;
CREATE POLICY "Users select own topics" ON topics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own topics" ON topics FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own topics" ON topics FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own topics" ON topics FOR DELETE USING (user_id = auth.uid());

ALTER TABLE topic_params ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users select own topic_params" ON topic_params;
DROP POLICY IF EXISTS "Users insert own topic_params" ON topic_params;
DROP POLICY IF EXISTS "Users update own topic_params" ON topic_params;
DROP POLICY IF EXISTS "Users delete own topic_params" ON topic_params;
CREATE POLICY "Users select own topic_params" ON topic_params FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own topic_params" ON topic_params FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own topic_params" ON topic_params FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own topic_params" ON topic_params FOR DELETE USING (user_id = auth.uid());

ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users select own plan_config" ON plan_config;
DROP POLICY IF EXISTS "Users insert own plan_config" ON plan_config;
DROP POLICY IF EXISTS "Users update own plan_config" ON plan_config;
DROP POLICY IF EXISTS "Users delete own plan_config" ON plan_config;
CREATE POLICY "Users select own plan_config" ON plan_config FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own plan_config" ON plan_config FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own plan_config" ON plan_config FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own plan_config" ON plan_config FOR DELETE USING (user_id = auth.uid());

ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users select own plan_snapshots" ON plan_snapshots;
DROP POLICY IF EXISTS "Users insert own plan_snapshots" ON plan_snapshots;
CREATE POLICY "Users select own plan_snapshots" ON plan_snapshots FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own plan_snapshots" ON plan_snapshots FOR INSERT WITH CHECK (user_id = auth.uid());

-- Refresh RLS on subtopics
DROP POLICY IF EXISTS "Subtopics are user-scoped" ON subtopics;
DROP POLICY IF EXISTS "Users manage own subtopics" ON subtopics;
CREATE POLICY "Users manage own subtopics" ON subtopics FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: Atomic commit helper for plan commits
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Insert new tasks
  INSERT INTO tasks (user_id, subject_id, topic_id, title, scheduled_date, duration_minutes, session_type, priority, completed, is_plan_generated, plan_version)
  SELECT
    p_user_id,
    (t->>'subject_id')::uuid,
    (t->>'topic_id')::uuid,
    t->>'title',
    (t->>'scheduled_date')::date,
    (t->>'duration_minutes')::integer,
    COALESCE(t->>'session_type', 'core'),
    COALESCE((t->>'priority')::integer, 3),
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
