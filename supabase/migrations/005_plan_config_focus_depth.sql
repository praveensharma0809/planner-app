-- Add max_active_subjects column to plan_config
-- 0 = no limit (all subjects active every day)
-- N > 0 = limit to top N subjects by urgency per day
--         Subjects with deadline within 7 days are always included regardless of this setting
ALTER TABLE plan_config
  ADD COLUMN IF NOT EXISTS max_active_subjects int NOT NULL DEFAULT 0;
