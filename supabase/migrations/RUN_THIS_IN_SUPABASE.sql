-- =============================================================
-- COMBINED MIGRATION: Run this in Supabase Dashboard → SQL Editor
-- This adds 3 features that were created in code but never applied to the DB:
--   1. subjects.archived column (soft-delete / archive support)
--   2. subtopics table (drill-down per subject)
--   3. plan_events table (planner lifecycle logging)
--
-- Copy-paste this ENTIRE file into the SQL Editor and click "Run".
-- The app works without these (features degrade gracefully),
-- but running this enables archive, subtopics, and plan history.
-- =============================================================

BEGIN;

-- ─── 1. Add archived column to subjects ───────────────────────
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS subjects_archived_idx
  ON public.subjects (user_id, archived);


-- ─── 2. Create subtopics table ────────────────────────────────
CREATE TABLE IF NOT EXISTS subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own subtopics'
  ) THEN
    CREATE POLICY "Users manage own subtopics"
      ON subtopics FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subtopics_subject_id ON subtopics(subject_id);


-- ─── 3. Create plan_events table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  task_count integer NOT NULL DEFAULT 0,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_events_user_id_idx
  ON public.plan_events (user_id, created_at DESC);

ALTER TABLE public.plan_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'plan_events_select_own'
  ) THEN
    CREATE POLICY plan_events_select_own ON public.plan_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'plan_events_insert_own'
  ) THEN
    CREATE POLICY plan_events_insert_own ON public.plan_events
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
