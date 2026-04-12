# Database Schema (Production Baseline)

Last updated: 2026-04-06
Latest migration: supabase/migrations/0001_production_schema.sql

## Scope

This document describes the live Supabase schema for StayPlanned.

## Tables

### profiles

Columns:
- id: uuid, PK, FK -> auth.users(id) ON DELETE CASCADE
- full_name: text, NOT NULL
- phone: text, NULL
- streak_current: integer, NOT NULL, default 0
- streak_longest: integer, NOT NULL, default 0
- streak_last_completed_date: date, NULL
- created_at: timestamptz, NOT NULL, default now()

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
- no_others_subject: lower(trim(name)) <> 'others'
- unique active subject name per user via partial unique index:
  - unique (user_id, lower(name)) where archived = false

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

### planner_settings

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NOT NULL, unique, FK -> auth.users(id) ON DELETE CASCADE
- study_start_date: date, NOT NULL
- exam_date: date, NOT NULL
- weekday_capacity_minutes: integer, NOT NULL
- weekend_capacity_minutes: integer, NOT NULL
- max_active_subjects: integer, NOT NULL, default 0
- day_of_week_capacity: jsonb, NULL
- custom_day_capacity: jsonb, NULL
- flexibility_minutes: integer, NOT NULL, default 0
- max_daily_minutes: integer, NOT NULL, default 480
- intake_import_mode: text, NOT NULL, default 'all'
- created_at: timestamptz, NOT NULL, default now()
- updated_at: timestamptz, NOT NULL, default now()

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
- source_topic_task_id is null OR task_source = 'plan'
- task_type in ('subject', 'standalone')
- (task_type = 'subject' and subject_id is not null) OR (task_type = 'standalone' and subject_id is null)
- standalone tasks must have topic_id and source_topic_task_id as null

Indexes:
- idx_tasks_user_date (user_id, scheduled_date)
- idx_tasks_user_completed_date (user_id, completed, scheduled_date)
- idx_tasks_user_topic_sort (user_id, topic_id, sort_order, created_at)
- idx_tasks_user_source_date (user_id, task_source, scheduled_date)
- idx_tasks_plan_snapshot_id (plan_snapshot_id)
- idx_tasks_user_source_topic_task (user_id, source_topic_task_id)

### off_days

Columns:
- id: uuid, PK
- user_id: uuid, NOT NULL, FK -> auth.users(id) ON DELETE CASCADE
- date: date, NOT NULL
- reason: text, NULL
- created_at: timestamptz, NOT NULL, default now()

Constraints:
- unique (user_id, date)

### ops_events

Columns:
- id: uuid, PK, default gen_random_uuid()
- user_id: uuid, NULL, FK -> auth.users(id) ON DELETE SET NULL
- event_name: text, NOT NULL
- event_status: text, NOT NULL
- duration_ms: integer, NULL
- metadata: jsonb, NOT NULL, default {}
- created_at: timestamptz, NOT NULL, default now()

Constraints:
- event_status in ('started', 'success', 'warning', 'error')
- duration_ms is NULL or >= 0

Indexes:
- idx_ops_events_user_created (user_id, created_at desc)
- idx_ops_events_name_created (event_name, created_at desc)

## RPCs

### commit_plan_atomic_v2

Signature:
- commit_plan_atomic_v2(jsonb, text, jsonb, text, date, text)

Behavior:
- Requires auth.uid()
- Enforces commit hash format and dedupe
- Validates payload fields and session counters
- Applies keep_mode deletion strategy for pending planner tasks
- Inserts plan snapshot and task rows atomically
- Returns (status, task_count, snapshot_id)

### commit_plan_atomic_v2_wrapper

Signature:
- commit_plan_atomic_v2_wrapper(jsonb, text, jsonb, text, date)

Behavior:
- Computes deterministic sha256 commit hash from auth.uid + payload
- Delegates to commit_plan_atomic_v2

### sync_topic_task_completion

Signature:
- sync_topic_task_completion(uuid, boolean)

Behavior:
- Updates a topic_task completion state
- Mirrors the state to related planned task rows

## Triggers

set_updated_at() is attached before update on:
- subjects
- topics
- topic_tasks
- planner_settings
- tasks

## Row-Level Security

RLS is enabled on:
- profiles, subjects, topics, topic_tasks, planner_settings, plan_snapshots, tasks, off_days, ops_events

Policy model:
- profiles ownership: auth.uid() = id
- all user-owned planner tables: auth.uid() = user_id
- ops_events insert allows null user_id or matching auth.uid()
