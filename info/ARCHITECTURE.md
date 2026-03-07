# StudyHard Architecture

Last updated: March 6, 2026

## System shape

StudyHard is a Next.js App Router application backed by Supabase Auth and Postgres. The app is split into three main layers:

1. UI routes in `app/`
2. Server-side data access and mutations in `app/actions/`
3. Pure planning logic in `lib/planner/`

The planner and the execution board are related but separate systems:

- The planner creates dated tasks from subject workload.
- The execution board tracks recurring monthly execution items in a spreadsheet-style grid.

## Key folders

- `app/auth` - login and signup flows using the browser Supabase client
- `app/onboarding` - initial profile, subjects, off-days, and first blueprint flow
- `app/planner` - analyze, overload resolution, preview, and commit plan flow
- `app/dashboard` - overview, subjects, calendar, settings
- `app/execution` - monthly execution board UI
- `app/actions/plan` - planning, task, and plan-history actions
- `app/actions/dashboard` - read-side dashboard queries
- `app/actions/execution` - execution board actions
- `lib/planner` - `analyzePlan.ts`, `overloadAnalyzer.ts`, `scheduler.ts`
- `lib/types/db.ts` - runtime-facing data shapes used across the app

## Data access rules

- Normal app data is not fetched directly from client components.
- Server actions are the main boundary for reads and writes.
- `lib/planner` contains pure functions only and does not know about Supabase.
- Supabase browser client usage is limited to auth/onboarding-style flows where session bootstrap is needed client-side.

## Planner flow

```text
User opens /planner
  -> analyzePlanAction()
     -> load profile + active subjects + off_days
     -> analyzePlan()
        -> overloadAnalyzer()
        -> scheduler() when feasible
  -> UI shows blueprint or overload report
  -> resolveOverload() can recompute with adjustments
  -> commitPlan() writes future generated tasks only
  -> dashboard/calendar revalidate
```

## Execution board flow

```text
User opens /execution
  -> getExecutionMonth()
     -> load categories + items + entries + metrics
     -> clone prior month structure when current month is empty
  -> user toggles a checkbox or edits items
  -> execution server action updates DB
  -> /execution revalidates
```

## Auth and user scoping

```text
auth.users
  -> profiles (1:1)
  -> every user-owned row carries user_id
  -> RLS enforces auth.uid() = user_id
```

Middleware currently protects `/dashboard`, `/planner`, and `/onboarding`-related flows by checking the Supabase session and profile presence.

## Important invariants

- The planner never commits tasks before the user confirms the blueprint.
- Past tasks must remain untouched.
- Generated tasks are distinguished from manual tasks with `is_plan_generated`.
- Archived subjects stay out of active planning queries.
- Execution-board history is preserved across months through `series_id` on execution items.

## Source of truth

- Application behavior: code in `app/` and `lib/`
- Data shapes: `lib/types/db.ts`
- Schema summary: `info/DB_SCHEMA.md`
- Delivery status: `info/PROGRESS.md`

Note: this repo currently has no checked-in `supabase/` folder, so live Supabase schema inspection is the authoritative SQL source.
