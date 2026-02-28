-- Plan events log: tracks plan generation, commit, and other planner lifecycle events

BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,        -- 'analyzed' | 'committed' | 'resolved_overload'
  task_count integer NOT NULL DEFAULT 0,
  summary text,                    -- e.g. "Generated 42 tasks across 5 subjects"
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_events_user_id_idx ON public.plan_events (user_id, created_at DESC);

-- RLS
ALTER TABLE public.plan_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_events_select_own ON public.plan_events;
CREATE POLICY plan_events_select_own ON public.plan_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS plan_events_insert_own ON public.plan_events;
CREATE POLICY plan_events_insert_own ON public.plan_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
