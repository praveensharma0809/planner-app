BEGIN;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS rest_after_days integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subjects_rest_after_days_nonnegative'
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_rest_after_days_nonnegative
      CHECK (rest_after_days >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subjects_start_before_deadline'
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_start_before_deadline
      CHECK (start_date IS NULL OR deadline IS NULL OR start_date <= deadline);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_subjects_user_start_deadline
  ON public.subjects(user_id, start_date, deadline);

CREATE INDEX IF NOT EXISTS idx_topic_params_user_dates
  ON public.topic_params(user_id, earliest_start, deadline);

COMMIT;
