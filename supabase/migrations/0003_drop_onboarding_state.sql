-- Drop orphaned onboarding columns introduced by the reverted onboarding work.
-- Safe to re-run: every drop uses IF EXISTS.

-- profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_step;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_goal;

-- sample-data flags
ALTER TABLE public.subjects    DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.topics      DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.topic_tasks DROP COLUMN IF EXISTS is_sample;

-- Indexes created against is_sample (if any) are dropped automatically with the column.
