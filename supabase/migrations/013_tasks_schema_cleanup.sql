BEGIN;

CREATE INDEX IF NOT EXISTS idx_tasks_user_topic_sort
  ON tasks(user_id, topic_id, sort_order, created_at);

COMMIT;
