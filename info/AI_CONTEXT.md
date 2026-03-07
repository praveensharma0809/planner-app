# StudyHard AI Context

Last updated: March 6, 2026

This file is written for an AI assistant that needs to understand the repo quickly and safely. It is not just a product summary. It captures the current runtime behavior, important invariants, the live database facts, and the main places where docs, code, and DB can drift.

## 1. What the app is

StudyHard is a Next.js App Router application for deadline-driven planning and execution.

It has two related but separate systems:

1. Planner system
   - Turns subjects, workload, deadlines, and daily capacity into dated `tasks`.
   - Uses an analyze -> adjust -> commit flow.
2. Execution board system
   - A spreadsheet-style monthly tracker for recurring execution items.
   - Does not generate `tasks` and is not the same data model as the planner.

## 2. Stack and boundaries

- Frontend: Next.js 16, React, Tailwind CSS v4
- Language: TypeScript
- Auth and DB: Supabase Auth + Postgres + RLS
- Testing: Vitest

Architecture boundary rules:
- UI lives in `app/`
- DB reads and writes happen in server actions under `app/actions/`
- Pure planning logic lives in `lib/planner/`
- Shared data shapes live in `lib/types/db.ts`
- The repo currently has no checked-in `supabase/` folder, so exact SQL is not versioned in git even though the live DB has now been inspected

## 3. Key folders

- `app/planner` - analyze, overload resolution, preview, commit UI
- `app/dashboard` - daily overview, subjects, calendar, settings
- `app/execution` - monthly execution board
- `app/onboarding` - profile and setup flow
- `app/actions/plan` - planner and task mutation actions
- `app/actions/dashboard` - dashboard read actions
- `app/actions/execution` - execution-board actions
- `app/actions/offdays` - off-day CRUD actions
- `lib/planner` - `analyzePlan.ts`, `overloadAnalyzer.ts`, `scheduler.ts`
- `lib/types/db.ts` - interfaces for profile, subject, task, off-day, subtopic, plan-event, execution entities
- `middleware.ts` - auth and profile gating for protected routes

## 4. Core user data model

User relationship map:

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

Main planner-facing entities:
- `profiles` - user defaults like `daily_available_minutes`, `exam_date`, streak fields, plus a live `age` column
- `subjects` - workload inventory with totals, duration, deadline, priority, mandatory flag, archive flag, and some DB-maintained intelligence fields
- `subtopics` - optional lower-level breakdown under a subject
- `tasks` - dated work items; generated or manual
- `off_days` - dates excluded from scheduling
- `plan_events` - planner history metadata; the table exists in the live DB, though code still degrades gracefully if it is missing

Execution-board entities:
- `execution_categories`
- `execution_items`
- `execution_entries`

Live DB-only / under-documented objects:
- `subject_workload_view`
- `complete_task_with_streak(...)`
- `increment_completed_items(...)`
- `compute_subject_intelligence()`
- `rls_auto_enable()`

## 5. Live DB facts that matter to the app

These are real schema facts from the live Supabase database and are important when reasoning about runtime behavior:

- `profiles.full_name` is `NOT NULL` in the DB
- `profiles.primary_exam` is `NOT NULL` in the DB
- `profiles.daily_available_minutes` is `NOT NULL` and constrained to be greater than zero
- `subjects.deadline` is `NOT NULL` in the DB
- `subjects.archived` is a real non-null boolean with default `false`
- `subjects` has extra columns not central to the planner engine: `custom_daily_minutes`, `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date`
- `off_days.id` has no database default in the live DB
- `plan_events` exists in the live DB
- execution-board tables and RLS policies exist in the live DB

Critical implication:
- The app must supply `off_days.id` on insert. This has now been fixed in `app/actions/offdays/addOffDay.ts` by generating an id in application code.

## 6. Planner engine behavior

The planner engine is the combination of `analyzePlan`, `overloadAnalyzer`, and `scheduler`.

### 6.1 analyzePlan

File: `lib/planner/analyzePlan.ts`

Input:
- `subjects`
- `dailyAvailableMinutes`
- `today`
- `mode`
- optional `examDate`
- optional `offDays`

Output status:
- `NO_SUBJECTS`
- `OVERLOAD`
- `READY`

Behavior:
- If no subjects are provided, returns `NO_SUBJECTS`.
- Calls `overloadAnalyzer(...)` first.
- If overload is detected and mode is `strict`, returns `OVERLOAD`.
- Otherwise calls `scheduler(...)` and returns `READY` with generated tasks plus overload metadata.

Important nuance:
- `SchedulerMode` still includes `"strict" | "auto"` in the pure layer.
- In practice, the UI/server path uses `strict` by default.
- `auto` still exists in tests and pure function contracts, so do not assume it has been removed from code entirely.

### 6.2 overloadAnalyzer

File: `lib/planner/overloadAnalyzer.ts`

Purpose:
- Determine whether the workload is feasible before committing any plan.
- Produce both global overload status and per-subject feasibility details.

Exact behavior:
- Filters out fully complete subjects where `total_items - completed_items <= 0`.
- For each active subject:
  - `remainingItems = total_items - completed_items`
  - `totalRemainingMinutes = remainingItems * avg_duration_minutes`
  - subject deadline is parsed from `subject.deadline`
  - if `examDate` exists and is valid, `effectiveDeadline = min(subject.deadline, examDate)`
  - `availableDays` counts inclusive days from `today` to `effectiveDeadline`, excluding any ISO dates in `offDays`
  - `requiredMinutesPerDay = totalRemainingMinutes / availableDays`
  - `capacityGapMinutesPerDay = max(0, requiredMinutesPerDay - dailyAvailableMinutes)`

Status thresholds from `classify(...)`:
- `safe` when `required <= capacity`
- `tight` when `required <= capacity * 1.1`
- `at_risk` when `required <= capacity * 1.25`
- `impossible` otherwise, or when capacity is invalid or no finite requirement exists

Adjustment suggestions:
- `extendDeadlineDays`
- `reduceItemsBy`
- `increaseDailyMinutesBy`

Global overload is true when either:
- `totalRequiredMinPerDay > dailyAvailableMinutes`, or
- at least one subject is `impossible`

### 6.3 scheduler

File: `lib/planner/scheduler.ts`

Purpose:
- Turn subject workload into dated task rows.

Exact behavior:
- Builds an active subject list with:
  - `remainingItems`
  - `remainingMinutes`
  - deadline clamped by optional exam date
  - `daysLeft = max(1, ceil((deadlineDate - today) / day))`
  - `requiredDaily = remainingMinutes / daysLeft`
  - `urgencyScore = requiredDaily * priority`
- Filters out subjects with no remaining work.
- Sort order is:
  1. mandatory subjects first
  2. earlier deadline first
  3. higher urgency score first
- Scheduling loop:
  - iterates from `today` to the latest deadline among active subjects
  - skips dates present in `offDays`
  - each day starts with `capacity = dailyAvailableMinutes`
  - for each subject, while there is room for another full session and the day is within deadline, it emits a task row
- Generated task shape:
  - `subject_id`
  - `scheduled_date`
  - `duration_minutes`
  - `title` uses `${subject.name} - Session` conceptually; current code uses an en dash in the actual string
  - `priority`

Important nuance:
- Scheduler does not force all work to fit. It schedules until capacity or deadline runs out.
- In `auto` mode at the analyze layer, you can get `READY` plus an overload report even if the schedule is incomplete relative to total requested work.

## 7. Planner server actions

### analyzePlanAction

File: `app/actions/plan/analyzePlan.ts`

Behavior:
- Gets authenticated user from Supabase server client.
- Loads `profiles.daily_available_minutes` and `profiles.exam_date`.
- Loads subjects for the user.
- Loads `off_days` for the user.
- Calls `analyzePlan(...)`.
- Returns one of:
  - `UNAUTHORIZED`
  - `NO_PROFILE`
  - `NO_SUBJECTS`
  - `OVERLOAD`
  - `READY`

Implementation note:
- Current query selects subjects by `user_id` and does not explicitly apply `archived = false` in this file.

### resolveOverload

File: `app/actions/plan/resolveOverload.ts`

Purpose:
- Re-run analysis in memory after the user proposes an adjustment.

Supported adjustments:
- `increaseDailyMinutes`
- `extendDeadline`
- `reduceItems`

Behavior:
- No DB writes.
- Loads current profile, subjects, and off-days.
- Applies the adjustment to in-memory subject/profile data.
- Calls `analyzePlan(...)` again and returns the new status.

### commitPlan

File: `app/actions/plan/commitPlan.ts`

Purpose:
- Persist a confirmed blueprint.

Exact behavior:
- Auth check first.
- Computes `todayISO`.
- Deletes only rows from `tasks` where:
  - `user_id = current user`
  - `scheduled_date >= today`
  - `is_plan_generated = true`
- This preserves:
  - past tasks
  - manual tasks where `is_plan_generated = false`
- Inserts only upcoming tasks from the provided schedule.
- Revalidates `/dashboard` and `/dashboard/calendar`.
- Calls `logPlanEvent("committed", ...)`.

### logPlanEvent and getPlanHistory

Files:
- `app/actions/plan/logPlanEvent.ts`
- `app/actions/plan/getPlanHistory.ts`

Important nuance:
- The live DB does contain `plan_events`.
- The code still degrades gracefully if the table is absent, which makes the app more resilient but means docs should not assume the graceful path indicates the table is actually missing.

### completeTask

File: `app/actions/plan/completeTask.ts`

Exact behavior:
1. Marks the task complete only if it is currently incomplete.
2. If no row updates, stops early.
3. Loads the parent subject and increments `completed_items` by 1.
4. Loads the profile and updates streak fields.
5. Revalidates `/dashboard` and `/dashboard/calendar`.

Important properties:
- The `completed = false` filter makes the action idempotent.
- Streak logic uses `today` and a UTC-safe `yesterday` value.
- The app uses direct table updates, not RPC, for completion.

### createTask and rescheduleTask

Files:
- `app/actions/plan/createTask.ts`
- `app/actions/plan/rescheduleTask.ts`

Behavior:
- `createTask` inserts manual tasks with `is_plan_generated = false` after verifying the subject belongs to the user.
- `rescheduleTask` rejects invalid or past dates and updates only user-owned tasks.

### off-day actions

Files:
- `app/actions/offdays/addOffDay.ts`
- `app/actions/offdays/deleteOffDay.ts`
- `app/actions/offdays/getOffDays.ts`

Behavior:
- `addOffDay` now generates an explicit uuid before insert because the live DB does not default `off_days.id`.
- `deleteOffDay` removes only user-owned off-days.
- `getOffDays` returns the user's dates ordered ascending.

## 8. Planner UI behavior

File: `app/planner/page.tsx`

Main UI flow:

```text
Analyze button
  -> analyzePlanAction()
  -> show READY or OVERLOAD result
  -> optional user adjustment
     -> resolveOverload(adjustment)
  -> optional commit
     -> commitPlan({ tasks })
  -> fetch and show recent plan history
```

UI notes:
- Re-analysis shows a confirmation prompt before replacing the current blueprint.
- Commit is disabled until a fresh `READY` result exists.
- The UI groups tasks by date for preview.

## 9. Dashboard behavior

File: `app/dashboard/page.tsx`

Dashboard responsibilities:
- load streak data
- load weekly tasks
- load upcoming deadlines
- load subject list for quick-add
- derive `todayTasks`, `pendingToday`, `doneToday`
- inline complete pending tasks through `completeTask`

Implementation note:
- `getUpcomingDeadlines()` currently selects by `user_id` and `deadline is not null`, but does not explicitly filter `archived = false` in the file.

## 10. Execution board behavior

Main files:
- `app/execution/page.tsx`
- `app/actions/execution/getExecutionMonth.ts`

Conceptual split from planner:
- Planner output is `tasks` by date.
- Execution board data is `execution_categories`, `execution_items`, and `execution_entries`.

### getExecutionMonth

File: `app/actions/execution/getExecutionMonth.ts`

What it does:
- Resolves a month from `monthKey` or current UTC month.
- Loads current-month categories and items.
- If the target month has no categories, clones the most recent prior month structure.
- Loads entries for the month.
- Computes per-item metrics and global metrics.

Important cloning rule:
- Prior month entries are not cloned.
- Category and item structure is cloned.
- `series_id` is preserved across months so streaks can continue.

Metrics behavior:
- Per-item completion percent = completed days in current month / days in month
- Per-item current streak = backward count of consecutive completed dates across all items sharing the same `series_id`
- Global monthly completion percent = total completed entries / (`days_in_month * item_count`)
- Global streak = backward count of days with at least one completed execution entry

Unauthorized behavior:
- `getExecutionMonth()` returns `UNAUTHORIZED` if there is no user.
- `app/execution/page.tsx` handles that by rendering a sign-in prompt.

Important nuance:
- `/execution` is not currently protected by middleware.
- Access control still exists through server-side auth checks in the execution actions.

## 11. Middleware and auth

File: `middleware.ts`

Current middleware behavior:
- Refreshes the Supabase session using cookies.
- Treats these as protected routes:
  - `/dashboard`
  - `/planner`
  - `/onboarding`
- If there is no user on a protected route, redirects to `/auth/login`.
- If there is a user but no `profiles` row and the route is not `/onboarding`, redirects to `/onboarding`.

Important nuance:
- `/execution` is not in the protected-route check.

## 12. DB objects that exist but are not central to the current planner path

### `subject_workload_view`
- joins `subjects` and `subtopics`
- computes `effective_total_items`, `subtopic_count`, and `total_hours_required`
- corresponds to `SubjectWorkloadView` in TypeScript
- not the main data source for `analyzePlan`, `overloadAnalyzer`, or `scheduler`

### `compute_subject_intelligence()`
- trigger function in the DB
- likely maintains subject intelligence fields such as `remaining_minutes`, `urgency_score`, or `health_state`
- current planner engine still computes its own planning numbers in application code

### `complete_task_with_streak(...)` and `increment_completed_items(...)`
- both exist in the DB
- current app code does not rely on them in the normal planner/task-completion flow

## 13. Tests that define important behavior

Planning tests live under `tests/planner/`.

Key verified behavior includes:
- strict mode returns `OVERLOAD` when required work exceeds capacity
- auto mode can still return `READY` with overload metadata
- scheduler never schedules beyond the exam date
- scheduler skips off-days
- scheduler does not exceed daily capacity
- overload analyzer clamps deadlines to exam date
- overload analyzer emits adjustment suggestions when overloaded

There is also now a targeted action test for off-day creation that verifies an id is supplied on insert.

When an AI must reason about planner behavior, these tests are as important as the docs.

## 14. Known repo gaps and caveats

1. No checked-in SQL migrations
   - exact SQL history is still not versioned in git
2. Live DB differs from the earlier inferred docs in a few places
   - `profiles.age` exists
   - `subjects` has extra intelligence fields
   - `off_days.id` has no default
   - `subject_workload_view` and extra public functions exist
3. Repo TypeScript types were slightly behind live DB and have been partially aligned
   - but code should still be treated as the behavioral source of truth
4. Archived-subject filtering is not consistently explicit in every server action query
5. Some DB intelligence fields exist, but the pure planner engine in `lib/planner/` remains the main source of planning behavior

## 15. Best files to read after this one

If an AI still needs more confidence, read these next in this order:

1. `lib/planner/analyzePlan.ts`
2. `lib/planner/overloadAnalyzer.ts`
3. `lib/planner/scheduler.ts`
4. `app/actions/plan/analyzePlan.ts`
5. `app/actions/plan/resolveOverload.ts`
6. `app/actions/plan/commitPlan.ts`
7. `app/actions/plan/completeTask.ts`
8. `app/actions/offdays/addOffDay.ts`
9. `app/actions/execution/getExecutionMonth.ts`
10. `lib/types/db.ts`
11. `middleware.ts`
12. `tests/planner/analyzePlan.test.ts`
13. `tests/planner/overloadAnalyzer.test.ts`
14. `tests/planner/scheduler.test.ts`
15. `tests/actions/addOffDay.test.ts`

## 16. If exact DB understanding is required later

Because SQL migrations are not present in the repo, use live Supabase inspection queries or export a fresh schema dump into version control.

Minimum useful queries:

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

## 17. Bottom line for another AI

If you only read `README.md` plus the summary docs, you will understand the repo at a strong overview level.

If you read this file too, you will understand:
- the important runtime behavior
- the main edge cases
- the live DB facts that matter
- where the source of truth actually lives
- which parts of the docs are summaries versus exact behavior

For changes that touch planner logic or the database boundary, still inspect the referenced source files directly before making assumptions.
