-- Add optional deadline column to subjects table
-- When a topic has no individual deadline, the scheduler uses the subject deadline as fallback.
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS deadline date;
