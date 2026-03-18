BEGIN;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_topics_archived ON topics(archived);

COMMIT;
