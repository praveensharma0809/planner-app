# Database Schema (Final Baseline)

Last updated: 2026-04-04
Latest migration: supabase/migrations/20260414_remove_legacy_order_fields.sql

## Scope

This document describes the final runtime schema focused on planner data flow.

## Tables

### subjects

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- name: text, NOT NULL
- sort_order: integer, NOT NULL, default 0
- archived: boolean, NOT NULL, default false
- deadline: date, NULL
- created_at: timestamptz, NOT NULL, default now()
- updated_at: timestamptz, NOT NULL, default now()

Constraints:
- primary key (id)
- unique active subject name per user via partial unique index:
  - unique (user_id, lower(name)) where archived = false
- subjects_reserved_name_check: lower(trim(name)) <> 'others'

Indexes:
- idx_subjects_user_archived_sort (user_id, archived, sort_order)
- idx_subjects_user_deadline (user_id, deadline)

### topics

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- subject_id: uuid, NOT NULL, FK -> subjects(id) ON DELETE CASCADE
- name: text, NOT NULL
- sort_order: integer, NOT NULL, default 0
- archived: boolean, NOT NULL, default false
- estimated_hours: numeric(6,1), NOT NULL, default 0
- deadline: date, NULL
- earliest_start: date, NULL
- depends_on: uuid[], NOT NULL, default '{}'
- session_length_minutes: integer, NOT NULL, default 60
- rest_after_days: integer, NOT NULL, default 0
- max_sessions_per_day: integer, NOT NULL, default 0
- study_frequency: text, NOT NULL, default 'daily'
- created_at: timestamptz, NOT NULL, default now()
- updated_at: timestamptz, NOT NULL, default now()

Constraints:
- estimated_hours >= 0
- session_length_minutes between 15 and 240
- rest_after_days >= 0
- max_sessions_per_day >= 0
- study_frequency in ('daily', 'spaced')
- earliest_start <= deadline when both are present

Indexes:
- idx_topics_user_subject_sort (user_id, subject_id, sort_order)
- idx_topics_user_archived (user_id, archived)
- idx_topics_user_deadline (user_id, deadline)
- idx_topics_depends_on_gin (GIN on depends_on)

### topic_tasks

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- subject_id: uuid, NOT NULL, FK -> subjects(id) ON DELETE CASCADE
- topic_id: uuid, NOT NULL, FK -> topics(id) ON DELETE CASCADE
- title: text, NOT NULL
- duration_minutes: integer, NOT NULL, default 60
- completed: boolean, NOT NULL, default false
- sort_order: integer, NOT NULL, default 0
- created_at: timestamptz, NOT NULL, default now()
- updated_at: timestamptz, NOT NULL, default now()

Constraints:
- duration_minutes > 0

Indexes:
- idx_topic_tasks_user_topic_sort (user_id, topic_id, sort_order, created_at)
- idx_topic_tasks_user_subject (user_id, subject_id)
- idx_topic_tasks_user_completed (user_id, completed)

### tasks

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- task_type: text, NOT NULL, default 'subject'
- subject_id: uuid, NULL, FK -> subjects(id) ON DELETE CASCADE
- topic_id: uuid, NULL, FK -> topics(id) ON DELETE SET NULL
- source_topic_task_id: uuid, NULL, FK -> topic_tasks(id) ON DELETE SET NULL
- title: text, NOT NULL
- scheduled_date: date, NOT NULL
- duration_minutes: integer, NOT NULL
- session_type: text, NOT NULL, default 'core'
- session_number: integer, NOT NULL, default 0
- total_sessions: integer, NOT NULL, default 1
- sort_order: integer, NOT NULL, default 0
- completed: boolean, NOT NULL, default false
- task_source: text, NOT NULL, default 'manual'
- plan_snapshot_id: uuid, NULL, FK -> plan_snapshots(id) ON DELETE SET NULL
- created_at: timestamptz, NOT NULL, default now()
- updated_at: timestamptz, NOT NULL, default now()

Constraints:
- duration_minutes > 0
- session_type in ('core', 'revision', 'practice')
- task_source in ('manual', 'plan')
- task_type in ('subject', 'standalone')
- (task_type = 'subject' and subject_id is not null) OR (task_type = 'standalone' and subject_id/topic_id/source_topic_task_id are null)
- source_topic_task_id is null OR task_source = 'plan'

Indexes:
- idx_tasks_user_date (user_id, scheduled_date)
- idx_tasks_user_completed_date (user_id, completed, scheduled_date)
- idx_tasks_user_topic_sort (user_id, topic_id, sort_order, created_at)
- idx_tasks_user_source_date (user_id, task_source, scheduled_date)
- idx_tasks_plan_snapshot_id (plan_snapshot_id)
- idx_tasks_user_source_topic_task (user_id, source_topic_task_id)

### plan_snapshots

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- task_count: integer, NOT NULL, default 0
- schedule_json: jsonb, NOT NULL, default []
- settings_snapshot: jsonb, NOT NULL, default {}
- summary: text, NULL
- commit_hash: text, NULL
- created_at: timestamptz, NOT NULL, default now()

Constraints:
- task_count >= 0
- commit_hash is NULL or matches ^[0-9a-f]{64}$

Indexes:
- idx_plan_snapshots_user_created (user_id, created_at desc)
- uq_plan_snapshots_user_commit_hash unique (user_id, commit_hash) where commit_hash is not null
- idx_plan_snapshots_user_commit_hash_created (user_id, commit_hash, created_at desc) where commit_hash is not null

## RPC: commit_plan_atomic_v2

Signature:
- commit_plan_atomic_v2(
  p_tasks jsonb,
  p_snapshot_summary text,
  p_config_snapshot jsonb,
  p_keep_mode text,
  p_new_plan_start_date date,
  p_commit_hash text
)
returns table(status text, task_count integer, snapshot_id uuid)

Parameter behavior:
- p_tasks: array of session rows to insert into tasks
- p_snapshot_summary: human-readable snapshot summary
- p_config_snapshot: settings snapshot stored in plan_snapshots.settings_snapshot
- p_keep_mode: one of future/until/none/merge (invalid values normalize to future)
- p_new_plan_start_date: boundary date used by keep-mode deletion rules
- p_commit_hash: required 64-char hex hash used for dedupe integrity

Validation flow:
1. Resolve auth.uid(); return UNAUTHORIZED row when no user.
2. Validate p_commit_hash present and format-safe.
3. Acquire advisory lock by (user_id + commit_hash).
4. Reject duplicate commit hash for the same user.
5. Validate payload:
   - non-empty task array
   - at least one generated (non-manual) session
   - scheduled_date format YYYY-MM-DD
   - duration > 0
   - session_type in core/revision/practice
   - valid session counters
6. Apply keep-mode delete strategy on pending plan tasks.
7. Insert plan_snapshots row with commit_hash.
8. Parse and normalize task payload.
9. Validate ownership/joins against subjects/topics/topic_tasks.
10. Insert execution tasks.
11. Verify inserted count equals requested count.
12. Update plan_snapshots.task_count and return SUCCESS row.

## RPC: commit_plan_atomic_v2_wrapper

Signature:
- commit_plan_atomic_v2_wrapper(
  p_tasks jsonb,
  p_snapshot_summary text,
  p_config_snapshot jsonb,
  p_keep_mode text,
  p_new_plan_start_date date
)

Behavior:
- Computes sha256 hex commit hash from auth.uid + task payload.
- Calls commit_plan_atomic_v2 with that computed hash.

## commit_hash Rules

- Format: must be exactly 64 lowercase hex chars.
- Uniqueness: unique per user by (user_id, commit_hash) when commit_hash is not null.
- Duplicate protection logic:
  - function-level precheck raises duplicate_commit before insert
  - unique index provides hard enforcement against race/replay
4. Returns moved/unscheduled counts and dropped reasons.

## 6) Special DB Logic (Triggers, RPC, Middleware, Policies)

### Triggers
- set_updated_at() trigger function is attached to:
  - subjects
  - topics
  - topic_tasks
  - planner_settings
  - tasks
- Effect: updated_at is refreshed on UPDATE.

### RPC / transactional logic
- commit_plan_atomic_v2(jsonb tasks, text summary, jsonb config, text keep_mode, date new_start, text commit_hash)
  - SECURITY DEFINER
  - Auth source is auth.uid()
  - commit hash guard order:
    - commit_hash_required
    - commit hash format validation
    - advisory lock acquisition
    - duplicate hash guard (2-minute window)
  - keep_mode behavior:
    - none: delete all pending plan tasks
    - future: delete pending plan tasks on/after new start
    - until: delete pending plan tasks on/after new start
    - merge: keep all pending plan tasks
  - Inserts plan_snapshots row and inserts validated plan tasks.
- commit_plan_atomic_v2_wrapper(jsonb tasks, text summary, jsonb config, text keep_mode, date new_start)
  - SECURITY DEFINER
  - Computes deterministic commit hash and calls the 6-arg v2 function.
- Public RPC surface is minimal and non-ambiguous:
  - commit_plan_atomic_v2(jsonb,text,jsonb,text,date,text)
  - commit_plan_atomic_v2_wrapper(jsonb,text,jsonb,text,date)

### Row-level security and auth model
- RLS enabled on all app tables.
- Ownership policies:
  - profiles: auth.uid() = id
  - other user-owned tables: auth.uid() = user_id
- ops_events insert policy allows service_role or matching user ownership.

### Application-level special rules
- tasks.task_source must be only manual or plan.
- source_topic_task_id is only valid for plan rows (check constraint).
- commit hash deduplication is enforced through RPC validation + partial index.
- completeTask streak update uses compare-and-set retries to avoid double increments under concurrent completion.
- savePlanConfig and getTopicParams sanitize inherited topic deadlines by clearing topic.deadline to preserve inheritance behavior.
- telemetry insert is optional and environment-gated (ENABLE_DB_TELEMETRY=true).

## 7) Maintenance Notes (How to keep this file current)

When schema changes:
1. Update Supabase migration SQL first.
2. Update this file (db_schema.md) to reflect schema/contract changes.
3. Update this file sections in order:
   - Schema Definition
   - Entity Relationships
   - System Usage Map (new/changed file -> function -> operation)
   - Special Logic
4. Run contract guard tests and app tests.

When runtime DB usage changes without schema changes:
1. Update only System Usage Map and Data Flow sections.
2. Keep operations verbs explicit (SELECT/INSERT/UPDATE/DELETE/UPSERT/RPC).

This file is intended to be consumed by both developers and AI agents as the centralized DB context for this codebase.
