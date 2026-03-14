-- =============================================================================
-- Planner v2 Engine — new columns for advanced scheduling features
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- topic_params: per-topic scheduling hints
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE topic_params
  ADD COLUMN IF NOT EXISTS rest_after_days        integer NOT NULL DEFAULT 0  CHECK (rest_after_days >= 0),
  ADD COLUMN IF NOT EXISTS max_sessions_per_day   integer NOT NULL DEFAULT 0  CHECK (max_sessions_per_day >= 0),
  ADD COLUMN IF NOT EXISTS study_frequency        text    NOT NULL DEFAULT 'daily'
    CHECK (study_frequency IN ('daily', 'spaced', 'dense')),
  ADD COLUMN IF NOT EXISTS tier                   integer NOT NULL DEFAULT 0  CHECK (tier >= 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- plan_config: v2 global constraint columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE plan_config
  ADD COLUMN IF NOT EXISTS day_of_week_capacity          jsonb,
  ADD COLUMN IF NOT EXISTS custom_day_capacity            jsonb,
  ADD COLUMN IF NOT EXISTS plan_order_stack               jsonb,
  ADD COLUMN IF NOT EXISTS flexibility_minutes            integer DEFAULT 0  CHECK (flexibility_minutes >= 0),
  ADD COLUMN IF NOT EXISTS max_daily_minutes              integer DEFAULT 480 CHECK (max_daily_minutes >= 30 AND max_daily_minutes <= 720),
  ADD COLUMN IF NOT EXISTS max_topics_per_subject_per_day integer DEFAULT 1  CHECK (max_topics_per_subject_per_day >= 1),
  ADD COLUMN IF NOT EXISTS min_subject_gap_days           integer DEFAULT 0  CHECK (min_subject_gap_days >= 0),
  ADD COLUMN IF NOT EXISTS subject_ordering               jsonb,
  ADD COLUMN IF NOT EXISTS flexible_threshold             jsonb;

COMMIT;
