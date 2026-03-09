-- Migration: add per-topic session_length_minutes + plan_order preference
-- Date: 2026-03-08

-- Per-topic session length (how long a single study session for this topic is)
ALTER TABLE topic_params
  ADD COLUMN IF NOT EXISTS session_length_minutes integer NOT NULL DEFAULT 60;

-- Plan generation order preference for the plan config
ALTER TABLE plan_config
  ADD COLUMN IF NOT EXISTS plan_order text NOT NULL DEFAULT 'balanced';

-- Constraint: valid plan_order values
ALTER TABLE plan_config
  DROP CONSTRAINT IF EXISTS plan_order_valid;

ALTER TABLE plan_config
  ADD CONSTRAINT plan_order_valid
    CHECK (plan_order IN ('priority', 'deadline', 'subject', 'balanced'));
