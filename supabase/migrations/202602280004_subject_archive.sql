-- Add archived column to subjects for soft-delete/archive support

BEGIN;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Index for filtering active subjects quickly
CREATE INDEX IF NOT EXISTS subjects_archived_idx ON public.subjects (user_id, archived);

COMMIT;
