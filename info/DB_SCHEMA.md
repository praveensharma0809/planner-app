# StudyHard Database Schema

Last updated: March 6, 2026
Source: live Supabase schema dump captured on March 6, 2026

This repo snapshot still does not include checked-in SQL migration files, but the schema summary below now reflects the live Supabase database rather than an inferred approximation.

## Public objects present in the live DB

Tables:
- `profiles`
- `subjects`
- `subtopics`
- `tasks`
- `off_days`
- `plan_events`
- `execution_categories`
- `execution_items`
- `execution_entries`

Views:
- `subject_workload_view`

Functions / triggers in `public`:
- `complete_task_with_streak(p_task_id uuid)`
- `compute_subject_intelligence()`
- `increment_completed_items(subject_id_input uuid)`
- `rls_auto_enable()`

## User model

```text
auth.users
  -> profiles.id
      -> subjects.user_id
      -> tasks.user_id
      -> off_days.user_id
      -> subtopics.user_id
      -> plan_events.user_id
      -> execution_categories.user_id
      -> execution_items.user_id
      -> execution_entries.user_id
```

## Core planner tables

### profiles
Primary key and auth link:
- `id` uuid primary key
- foreign key to `auth.users(id)` with `ON DELETE CASCADE`

Columns:
- `full_name` text not null
- `age` integer nullable
- `qualification` text nullable
- `phone` text nullable
- `primary_exam` text not null
- `exam_date` date nullable
- `daily_available_minutes` integer not null
- `created_at` timestamptz not null default `now()`
- `streak_current` integer not null default `0`
- `streak_longest` integer not null default `0`
- `streak_last_completed_date` date nullable

Constraint:
- `daily_minutes_positive`: `daily_available_minutes > 0`

RLS:
- per-user select / insert / update / delete on `id = auth.uid()`

Important note:
- The live DB has an `age` column that is not central to the current app flow.

### subjects
Primary key:
- `id` uuid default `gen_random_uuid()`

Columns:
- `user_id` uuid not null
- `name` text not null
- `created_at` timestamptz not null default `now()`
- `total_items` integer not null
- `avg_duration_minutes` integer not null
- `deadline` date not null
- `priority` integer not null default `3`
- `mandatory` boolean not null default `false`
- `completed_items` integer not null default `0`
- `custom_daily_minutes` integer nullable
- `archived` boolean not null default `false`
- `remaining_minutes` integer nullable
- `urgency_score` integer nullable
- `health_state` text nullable
- `estimated_completion_date` date nullable

Constraints:
- `avg_duration_positive`: `avg_duration_minutes > 0`
- `total_items_positive`: `total_items > 0`
- `completed_items_valid`: `completed_items >= 0 AND completed_items <= total_items`

Indexes:
- `idx_subjects_user` on `(user_id)`
- `subjects_archived_idx` on `(user_id, archived)`

RLS:
- per-user select / insert / update / delete on `user_id = auth.uid()`

Important note:
- The live DB contains intelligence-related fields (`remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date`) that are not the main source of truth for the current planner engine in `lib/planner/`.

### subtopics
Primary key:
- `id` uuid default `gen_random_uuid()`

Columns:
- `user_id` uuid not null
- `subject_id` uuid not null
- `name` text not null
- `total_items` integer not null default `0`
- `completed_items` integer not null default `0`
- `sort_order` integer not null default `0`
- `created_at` timestamptz nullable default `now()`

Indexes:
- `idx_subtopics_subject_id` on `(subject_id)`

RLS:
- one permissive `FOR ALL` policy: `user_id = auth.uid()`

### tasks
Primary key:
- `id` uuid default `gen_random_uuid()`

Columns:
- `user_id` uuid not null
- `title` text not null
- `scheduled_date` date not null
- `duration_minutes` integer not null
- `priority` integer not null default `3`
- `completed` boolean not null default `false`
- `created_at` timestamptz not null default `now()`
- `subject_id` uuid not null
- `is_plan_generated` boolean not null default `true`

Constraint:
- `duration_positive`: `duration_minutes > 0`

Indexes:
- `idx_tasks_user_date` on `(user_id, scheduled_date)`
- `idx_tasks_subject` on `(subject_id)`

RLS:
- per-user select / insert / update / delete on `user_id = auth.uid()`

### off_days
Primary key:
- `id` uuid primary key

Columns:
- `user_id` uuid not null
- `date` date not null
- `reason` text nullable
- `created_at` timestamptz not null default `now()`

Unique constraint:
- `(user_id, date)`

Indexes:
- `off_days_user_date_unique`
- `off_days_user_id_idx`

RLS:
- per-user select / insert / update / delete on `user_id = auth.uid()`

Critical note:
- The live DB currently has no default on `off_days.id`.
- Application code must provide the id on insert unless the DB is migrated later.

### plan_events
Primary key:
- `id` uuid default `gen_random_uuid()`

Columns:
- `user_id` uuid not null
- `event_type` text not null
- `task_count` integer not null default `0`
- `summary` text nullable
- `created_at` timestamptz not null default `now()`

Indexes:
- `plan_events_user_id_idx` on `(user_id, created_at DESC)`

RLS:
- select own rows
- insert own rows

Important note:
- The live DB does contain `plan_events`, even though app code still treats it as optional and degrades gracefully if absent.

## Execution board tables

### execution_categories
- `id` uuid primary key default `gen_random_uuid()`
- `user_id` uuid not null
- `month_start` date not null
- `name` text not null
- `sort_order` integer not null default `0`
- `deleted_at` timestamptz nullable
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

Index:
- `execution_categories_user_month_idx` on `(user_id, month_start)`

RLS:
- per-user select / insert / update / delete

### execution_items
- `id` uuid primary key default `gen_random_uuid()`
- `user_id` uuid not null
- `category_id` uuid not null
- `series_id` uuid not null default `gen_random_uuid()`
- `month_start` date not null
- `title` text not null
- `sort_order` integer not null default `0`
- `deleted_at` timestamptz nullable
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

Indexes:
- `execution_items_category_idx` on `(category_id, sort_order)`
- `execution_items_series_idx` on `(user_id, series_id)`
- `execution_items_user_month_idx` on `(user_id, month_start)`

RLS:
- per-user select / insert / update / delete

### execution_entries
- `id` uuid primary key default `gen_random_uuid()`
- `user_id` uuid not null
- `item_id` uuid not null
- `entry_date` date not null
- `completed` boolean not null default `true`
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

Unique constraint:
- `(user_id, item_id, entry_date)`

Indexes:
- `execution_entries_user_date_idx` on `(user_id, entry_date)`
- `execution_entries_item_date_idx` on `(item_id, entry_date)`

RLS:
- per-user select / insert / update / delete

## View

### subject_workload_view
Purpose:
- aggregates subject and subtopic workload into a queryable summary

Columns:
- `subject_id`
- `user_id`
- `subject_name`
- `deadline`
- `priority`
- `archived`
- `effective_total_items`
- `subtopic_count`
- `avg_duration_minutes`
- `total_hours_required`

Behavior:
- joins `subjects` to `subtopics`
- uses `COALESCE(sum(st.total_items), s.total_items)` for effective item totals
- computes `total_hours_required` as rounded numeric hours

Important note:
- This view exists in the DB and corresponds to the `SubjectWorkloadView` TypeScript interface, but it is not the core data source for the current planner pipeline.

## Functions present in the DB

### `complete_task_with_streak(p_task_id uuid)`
- returns `json`
- `SECURITY DEFINER`
- exists in the DB
- current app code does not call it for normal completion flow

### `increment_completed_items(subject_id_input uuid)`
- returns `void`
- exists in the DB
- current app code does not rely on it in the normal completion flow

### `compute_subject_intelligence()`
- trigger function in `plpgsql`
- likely responsible for maintaining some subject intelligence fields in the DB
- current planner engine still computes its own planning metrics in application code

### `rls_auto_enable()`
- event trigger in `plpgsql`
- DB-level helper; not part of day-to-day app logic

## Repo vs live schema drift

Live DB fields not previously documented clearly:
- `profiles.age`
- `subjects.custom_daily_minutes`
- `subjects.remaining_minutes`
- `subjects.urgency_score`
- `subjects.health_state`
- `subjects.estimated_completion_date`
- `subject_workload_view`
- `compute_subject_intelligence()`
- `rls_auto_enable()`

Live DB constraints / facts worth remembering:
- `profiles.full_name` is not null in the live DB
- `profiles.primary_exam` is not null in the live DB
- `subjects.deadline` is not null in the live DB
- `off_days.id` has no default in the live DB

## Useful live inspection queries

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
```

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
