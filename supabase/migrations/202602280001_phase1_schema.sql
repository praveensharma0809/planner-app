-- Phase 1 schema additions: streak columns on profiles; off_days table with RLS
-- Generated on 2026-02-28

BEGIN;

-- 1) Add streak columns to profiles (additive, preserves data)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_current integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_longest integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_completed_date date;

-- Backfill existing rows to default values where missing
UPDATE public.profiles
SET streak_current = COALESCE(streak_current, 0),
    streak_longest = COALESCE(streak_longest, 0)
WHERE streak_current IS NULL OR streak_longest IS NULL;

-- 2) Create off_days table (blocked scheduling dates)
CREATE TABLE IF NOT EXISTS public.off_days (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT off_days_user_date_unique UNIQUE (user_id, date)
);

-- Support lookups by user/date even with the unique constraint present
CREATE INDEX IF NOT EXISTS off_days_user_id_idx ON public.off_days (user_id, date);

-- 3) RLS policies to isolate rows per user
ALTER TABLE public.off_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS off_days_select_own ON public.off_days;
CREATE POLICY off_days_select_own ON public.off_days
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS off_days_insert_own ON public.off_days;
CREATE POLICY off_days_insert_own ON public.off_days
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS off_days_update_own ON public.off_days;
CREATE POLICY off_days_update_own ON public.off_days
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS off_days_delete_own ON public.off_days;
CREATE POLICY off_days_delete_own ON public.off_days
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;

-- Rollback (manual, destructive; run only if you need to revert this migration)
-- BEGIN;
-- DROP POLICY IF EXISTS off_days_delete_own ON public.off_days;
-- DROP POLICY IF EXISTS off_days_update_own ON public.off_days;
-- DROP POLICY IF EXISTS off_days_insert_own ON public.off_days;
-- DROP POLICY IF EXISTS off_days_select_own ON public.off_days;
-- DROP TABLE IF EXISTS public.off_days;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_last_completed_date;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_longest;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_current;
-- COMMIT;
