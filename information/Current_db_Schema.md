# Current DB Schema

This file documents the current active database schema after the full reset + recreate flow.

## Overview
The schema is planner-first and minimal. It has 8 functional tables:
1. profiles
2. subjects
3. topics
4. planner_settings
5. tasks
6. plan_snapshots
7. off_days
8. ops_events (optional telemetry)

Core identity source is auth.users. Every user-owned table links to auth.users(id).

## High-level relationships
- auth.users -> profiles (1:1)
- auth.users -> subjects (1:many)
- auth.users -> topics (1:many)
- subjects -> topics (1:many)
- auth.users -> planner_settings (1:1)
- auth.users -> tasks (1:many)
- subjects -> tasks (1:many)
- topics -> tasks (1:many, nullable from tasks side)
- auth.users -> plan_snapshots (1:many)
- plan_snapshots -> tasks (1:many, nullable from tasks side via plan_snapshot_id)
- auth.users -> off_days (1:many)
- auth.users -> ops_events (1:many, nullable user_id)

## Table details

## profiles
Purpose:
- Stores user profile and streak metadata.

Columns:
- id uuid primary key references auth.users(id) on delete cascade
- full_name text not null
- age integer null
- qualification text null
- phone text null
- primary_exam text not null
- exam_date date null
- daily_available_minutes integer not null check > 0
- streak_current integer not null default 0
- streak_longest integer not null default 0
- streak_last_completed_date date null
- created_at timestamptz not null default now()

Notes:
- One row per user.

## subjects
Purpose:
- Top-level study buckets.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- name text not null
- sort_order integer not null default 0
- archived boolean not null default false
- deadline date null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Important constraints/indexes:
- unique active name per user: unique(user_id, lower(name)) where archived=false
- idx_subjects_user_archived_sort (user_id, archived, sort_order)
- idx_subjects_user_deadline (user_id, deadline)

## topics
Purpose:
- Chapter/topic definitions plus scheduling parameters (merged topic config).

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- subject_id uuid not null references subjects(id) on delete cascade
- name text not null
- sort_order integer not null default 0
- archived boolean not null default false
- estimated_hours numeric(6,1) not null default 0 check >= 0
- deadline date null
- earliest_start date null
- depends_on uuid[] not null default '{}'
- session_length_minutes integer not null default 60 check 15..240
- rest_after_days integer not null default 0 check >= 0
- max_sessions_per_day integer not null default 0 check >= 0
- study_frequency text not null default 'daily' check in ('daily','spaced')
- priority integer not null default 3 check 1..5
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Constraints/indexes:
- date-window check: earliest_start <= deadline when both present
- idx_topics_user_subject_sort (user_id, subject_id, sort_order)
- idx_topics_user_archived (user_id, archived)
- idx_topics_user_deadline (user_id, deadline)
- idx_topics_depends_on_gin (GIN on depends_on)

Notes:
- depends_on is logical dependency list; it is not a formal FK array.

## planner_settings
Purpose:
- Per-user planner constraints.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null unique references auth.users(id) on delete cascade
- study_start_date date not null
- exam_date date not null
- weekday_capacity_minutes integer not null check >= 0
- weekend_capacity_minutes integer not null check >= 0
- max_active_subjects integer not null default 0 check >= 0
- day_of_week_capacity jsonb null
- custom_day_capacity jsonb null
- flexibility_minutes integer not null default 0 check >= 0
- max_daily_minutes integer not null default 480 check 30..720
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Notes:
- One row per user.

## tasks
Purpose:
- Unified task store for manual and planner-generated sessions.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- subject_id uuid not null references subjects(id) on delete cascade
- topic_id uuid null references topics(id) on delete set null
- title text not null
- scheduled_date date not null
- duration_minutes integer not null check > 0
- session_type text not null default 'core' check in ('core','revision','practice')
- priority integer not null default 3 check 1..5
- completed boolean not null default false
- task_source text not null default 'manual' check in ('manual','plan')
- plan_snapshot_id uuid null references plan_snapshots(id) on delete set null
- session_number integer not null default 0
- total_sessions integer not null default 0
- sort_order integer not null default 0
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Indexes:
- idx_tasks_user_date (user_id, scheduled_date)
- idx_tasks_user_completed_date (user_id, completed, scheduled_date)
- idx_tasks_user_topic_sort (user_id, topic_id, sort_order, created_at)
- idx_tasks_user_source_date (user_id, task_source, scheduled_date)
- idx_tasks_plan_snapshot_id (plan_snapshot_id)

## plan_snapshots
Purpose:
- Immutable committed plan history and settings snapshot.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- task_count integer not null default 0
- schedule_json jsonb not null default []
- settings_snapshot jsonb not null default {}
- summary text null
- created_at timestamptz not null default now()

Indexes:
- idx_plan_snapshots_user_created (user_id, created_at desc)

## off_days
Purpose:
- Dates excluded from scheduling.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- date date not null
- reason text null
- created_at timestamptz not null default now()

Constraints/indexes:
- unique(user_id, date)
- idx_off_days_user_date (user_id, date)

## ops_events
Purpose:
- Optional telemetry storage.

Columns:
- id uuid primary key default gen_random_uuid()
- user_id uuid null references auth.users(id) on delete set null
- event_name text not null
- event_status text not null check in ('started','success','warning','error')
- duration_ms integer null check >= 0 when present
- metadata jsonb not null default {}
- created_at timestamptz not null default now()

Indexes:
- idx_ops_events_user_created (user_id, created_at desc)
- idx_ops_events_name_created (event_name, created_at desc)

## Functions

## set_updated_at()
- Trigger function that writes updated_at = now() on UPDATE.
- Used by subjects, topics, planner_settings, tasks.

## commit_plan_atomic_v2(...)
- Security definer function for atomic plan commit.
- Uses auth.uid() as authoritative user identity.
- Supports keep modes: future, until, none, merge.
- Creates plan_snapshots row + inserts plan tasks.

## commit_plan_atomic wrappers
- Compatibility signatures exist and forward to commit_plan_atomic_v2.
- p_user_id is ignored in wrappers; auth.uid() controls ownership.

## RLS model summary
RLS is enabled on all tables above.

Ownership-based policies:
- profiles: auth.uid() = id
- all other user-owned tables: auth.uid() = user_id

ops_events insert policy:
- auth.role() = service_role OR auth.uid() = user_id

## Grant model summary
- anon: no broad table/function rights in this schema setup.
- authenticated: select/insert/update/delete on tables + execute on commit functions (still gated by RLS/policy/function checks).
- service_role: full access for trusted server operations.

## Practical notes for future work
- task_source replaces old generated-task flag logic.
- plan_snapshot_id replaces old planner version linkage.
- topic planning params are now stored directly in topics.
- legacy hierarchy and execution tables are intentionally absent.
