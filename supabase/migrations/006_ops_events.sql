-- Migration 006: Operational telemetry events

CREATE TABLE IF NOT EXISTS ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_status text NOT NULL CHECK (event_status IN ('started', 'success', 'error', 'warning')),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_events_created_at ON ops_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_events_name_created ON ops_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_events_user_created ON ops_events(user_id, created_at DESC);

ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ops_events' AND policyname = 'Users can read own ops events'
  ) THEN
    CREATE POLICY "Users can read own ops events"
      ON ops_events
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ops_events' AND policyname = 'Service role can insert ops events'
  ) THEN
    CREATE POLICY "Service role can insert ops events"
      ON ops_events
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid());
  END IF;
END
$$;
