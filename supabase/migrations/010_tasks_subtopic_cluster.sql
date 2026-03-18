BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES subtopics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_subtopic ON tasks(subtopic_id);

COMMIT;
