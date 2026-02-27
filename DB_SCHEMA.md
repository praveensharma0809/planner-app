# DB_SCHEMA.md
## StudyHard — Target Database Schema
Version: 1.0 (aligns with PROJECT_SPEC v2.0 and ARCHITECTURE v1.0)
Scope: Define the relational schema to support the target architecture without adding new product features.

---
## 1) Entities & Columns

### 1.1 profiles (user profile and planning defaults)
- id (uuid, PK, references auth.users.id)
- full_name (text, nullable)
- primary_exam (text, nullable) — free-text goal name
- exam_date (date, nullable) — final exam deadline (global hard stop)
- daily_available_minutes (integer, nullable)
- created_at (timestamptz, default now())
- qualification (text, nullable) — legacy, retained but unused going forward
- phone (text, nullable) — legacy, retained but unused going forward
- streak_current (integer, default 0) — running streak counter
- streak_longest (integer, default 0)
- streak_last_completed_date (date, nullable) — last day with a completion, used to maintain streak continuity

### 1.2 subjects (work streams with deadlines)
- id (uuid, PK)
- user_id (uuid, FK → auth.users.id, on delete cascade)
- name (text, not null)
- total_items (integer, not null)
- completed_items (integer, not null, default 0)
- avg_duration_minutes (integer, not null)
- deadline (date, nullable) — subject-level deadline; effective deadline = min(deadline, profiles.exam_date)
- priority (integer, not null, default 3) — 1–5
- mandatory (boolean, not null, default false)
- created_at (timestamptz, default now())

### 1.3 tasks (scheduled work items)
- id (uuid, PK)
- user_id (uuid, FK → auth.users.id, on delete cascade)
- subject_id (uuid, FK → subjects.id, on delete cascade)
- title (text, not null) — human-readable label; typically derived from subject + item number
- scheduled_date (date, not null)
- duration_minutes (integer, not null)
- priority (integer, not null) — mirrors subject priority at generation time
- completed (boolean, not null, default false)
- is_plan_generated (boolean, not null, default true) — distinguishes generated vs. manual tasks
- created_at (timestamptz, default now())

### 1.4 off_days (blocked dates to skip scheduling)
- id (uuid, PK)
- user_id (uuid, FK → auth.users.id, on delete cascade)
- date (date, not null)
- reason (text, nullable)
- created_at (timestamptz, default now())
- UNIQUE (user_id, date)

### 1.5 RPC (existing)
- increment_completed_items(subject_id uuid) — keeps subjects.completed_items in sync when tasks are completed.

---
## 2) Relationships & Invariants
- profiles.id = auth.users.id (1:1). Every authenticated user should have exactly one profile row; onboarding enforces creation.
- subjects.user_id FK → auth.users.id (many subjects per user). Cascades on delete to keep data scoped.
- tasks.user_id FK → auth.users.id and subject_id FK → subjects.id. Tasks always belong to a subject and a user; cascades on subject delete.
- off_days.user_id FK → auth.users.id. Unique per user/date to avoid duplicates.
- Effective deadline rule: effective_deadline(subject) = min(subject.deadline if set, profile.exam_date). No task may be scheduled after profile.exam_date.
- Past data rule: commitPlan deletes future generated tasks only where scheduled_date >= today AND is_plan_generated = true; past rows are never mutated.
- Streak rule: streak fields on profiles are updated only through task completion events; there is no undo at MVP.
- Manual tasks: tasks with is_plan_generated = false are never touched by regeneration.

---
## 3) Derived Views / Key Queries (no stored objects required at MVP)
- Backlog detection: tasks where scheduled_date < today AND completed = false; backlog volume = sum(duration_minutes).
- Plan health: per-subject progress = completed_items / total_items; deadline health derived in app from effective deadlines.
- Streak computation: maintained incrementally in profiles; dashboard reads streak_current and streak_longest.
- Weekly snapshot: aggregate tasks by scheduled_date within current week (counts and completed counts).
- Upcoming deadlines: subjects ordered by effective_deadline.

---
## 4) Indexing (recommended)
- tasks: (user_id, scheduled_date) for dashboard/calendar/backlog queries.
- tasks: (user_id, subject_id) for subject-level rollups.
- subjects: (user_id, deadline) for upcoming-deadline panel.
- off_days: UNIQUE (user_id, date) already implies an index; ensure supporting index exists.

---
## 5) Data Flow Fit to Architecture
- Phase 1/2 (analyzePlan/resolveOverload): read profiles, subjects, off_days; compute BlueprintResult in memory; no writes.
- Phase 3 (commitPlan): delete future generated tasks, insert new generated tasks with is_plan_generated = true; never touches past rows or manual tasks.
- Calendar drag (rescheduleTask): updates tasks.scheduled_date; rejects moves before today; does not alter completed state.
- Streak updates: completeTask action marks task completed and updates profiles streak fields atomically with the RPC counter.

---
## 6) Migration Plan (from current schema)
1) Add columns to profiles:
   - streak_current integer DEFAULT 0
   - streak_longest integer DEFAULT 0
   - streak_last_completed_date date NULL
   These are additive and backfilled to 0/NULL; no downtime expected.

2) Create off_days table as defined above with UNIQUE (user_id, date).

3) Retain existing profiles columns qualification and phone but mark deprecated in code; remove from forms and type surfaces. (Future cleanup migration can drop them.)

4) Ensure tasks table keeps is_plan_generated; no change needed.

5) Backfill/verify data integrity:
   - Set any NULL completed_items to 0 on subjects if they exist.
   - Ensure all tasks rows have is_plan_generated populated (default true for legacy rows if missing).

6) RLS review (Supabase): confirm policies for off_days mirror subjects/tasks (user_id isolation) and profiles remains 1:1.

7) Deploy migration in a single transaction; client code should be updated to ignore new columns safely (Supabase client tolerates extra fields).

---
## 7) Assumptions
- Subject subtopics/chapters are deferred (no parent_id or separate table at MVP) per ARCHITECTURE §4.3; future phase can introduce hierarchy.
- Backlog threshold is an application constant, not stored in the database at MVP.
- No additional audit tables are required beyond created_at timestamps; Supabase storage of WAL/backups suffices for recovery at this phase.
- exam_date may be null during onboarding; plan generation requires it to be set before commitPlan executes.

---
## 8) Out of Scope (for this phase)
- Dropping legacy profile columns (qualification, phone).
- Introducing subtopic hierarchy or nested subjects.
- Additional counters (e.g., backlog aggregates) — computed at read time.
- Notifications, multi-profile support, or premium features (not in MVP spec).
