BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_chapter_sort ON tasks(topic_id, sort_order);

COMMIT;
