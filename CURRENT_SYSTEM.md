# Current System Overview

This document describes the existing implementation of the planner app. It is a reverse‑engineered summary of how the system works today, covering core functionality, architecture, data model, and user flows.

---

## 1. Application Purpose

The web application is a personal study planner geared toward students preparing for competitive exams. Users define subjects with item counts and deadlines, specify their daily available study time, and the system automatically generates a schedule of tasks. Tasks can then be marked complete as the user works through them. There are also dashboard and calendar views for reviewing current and past tasks.


## 2. Major Modules and Folders

- **`app/`** – Next.js 13+ (App Router) frontend pages and layouts.
  - `/auth/` – login and signup screens using Supabase client SDK.
  - `/onboarding/` – profile setup page for new users.
  - `/dashboard/` – authenticated area with `layout.tsx` (sidebar) and subpages:
    - `page.tsx` – today’s task list and daily summary.
    - `subjects/` – subject management (list, add, edit, delete).
    - `calendar/` – month‑view of scheduled tasks.
  - `/planner/` – page to trigger plan generation with overload detection.
  - Root `page.tsx` – redirects users based on auth/profile state.

- **`lib/`** – shared library code.
  - `supabase.ts` – browser Supabase client.
  - `supabase/server.ts` – helper for creating a server‑side Supabase client using Next.js cookies.
  - `types/db.ts` – TypeScript interfaces for `Profile`, `Subject`, and `Task` rows.
  - `planner/` – planning logic:
    - `scheduler.ts` – algorithm that turns subjects into scheduled tasks.
    - `overloadAnalyzer.ts` – checks if current load exceeds daily capacity.
    - `generatePlan.ts` – server action that orchestrates plan generation and writes tasks.

- **`app/actions/plan/`** – server actions for task operations.
  - `completeTask.ts` – mark task complete and bump subject counter.
  - `resolveOverload.ts` – currently empty placeholder.

Other miscellaneous config files include Next.js and ESLint configs, etc.


## 3. Backend Architecture Style

The backend is primarily serverless and handled by Supabase (PostgreSQL + Auth + Edge Functions). There is no custom API server; most data access happens directly from React components or from server‑action helpers (using `"use server"` in Next.js). Authentication and row operations use the Supabase client or server client depending on context. Database logic is mostly in Supabase tables and a few stored procedures (e.g. `increment_completed_items` invoked via RPC).


## 4. Database Structure (Inferred)

Supabase tables mirror the TypeScript interfaces:

- **profiles** – keyed by `id` (user UUID). Fields include `full_name`, `primary_exam`, `qualification`, `phone`, `daily_available_minutes`, `exam_date`, `created_at`.
- **subjects** – each row has `id`, `user_id` foreign key, `name`, `total_items`, `completed_items`, `avg_duration_minutes`, `deadline` (ISO date string), `priority` (numeric), `mandatory` (boolean), `created_at`.
- **tasks** – scheduled study tasks: `id`, `user_id`, `subject_id`, `title`, `scheduled_date`, `duration_minutes`, `priority`, `completed` (bool), `is_plan_generated` (bool), `created_at`.

Additional objects:
- Supabase Auth users table (managed by Supabase).
- A PostgreSQL RPC `increment_completed_items(subject_id_input)` increments a subject's `completed_items` counter when a task is marked complete.


## 5. Task & Schedule Management

- **Plan generation**: When the user clicks "Generate Plan" on `/planner`, the client calls `generatePlan(mode)` (mode is `"strict"` or `"auto"`).
  1. `generatePlan` checks auth and loads user profile and subjects via the server Supabase client.
  2. If no profile or subjects exist it returns an error state.
  3. It runs `overloadAnalyzer` to compute `burnRate` (total remaining minutes divided by days until furthest deadline) and compare to `daily_available_minutes`. If overload and mode is `strict`, it returns an overload status to the client without writing tasks.
  4. Otherwise it calls `scheduler`, which sorts active subjects (mandatory → earliest deadline → urgency score) and iteratively fills days from today forward, producing a list of `ScheduledTask` objects. In `auto` mode, the effective daily capacity is bumped to at least the burn rate; in `strict` mode it stays at the user's declared capacity.
  5. Before inserting new tasks the function deletes any existing `tasks` for the user that were `is_plan_generated = true` and have `scheduled_date >= today` (allows regeneration/rescheduling while preserving past history).
  6. The computed tasks are inserted with `completed = false` and `is_plan_generated = true`.
  7. The client displays success or overload information accordingly.

- **Task completion**: Clicking "Complete" on a task (on dashboard or calendar) triggers the server action `completeTask(taskId)`. This:
  1. Retrieves the task row and returns if already completed or not found.
  2. Updates `completed = true` on the task (ensuring the user owns it).
  3. Calls the `increment_completed_items` RPC to bump the parent subject's `completed_items` counter. This keeps subject progress accurate for scheduling.

- **Rescheduling**: Regenerating a plan automatically deletes future generated tasks and reinserts new ones, so schedules adapt as subject progress or deadlines change. Past tasks (dates before today) are never deleted or modified.


## 6. Authentication System

- Supabase Auth handles user accounts with email/password.
- Client‑side pages (`/auth/login`, `/auth/signup`) use the browser Supabase client to sign in/up.
- Protected areas (dashboard, onboarding, planner) check `supabase.auth.getUser()` in `useEffect` hooks or server actions; unauthenticated users are redirected to login.
- After signing up the user must complete the onboarding profile; the presence of a row in `profiles` determines if onboarding is needed.


## 7. Key User Flows

1. **Sign up / login:** User registers via `/auth/signup` (Supabase sends confirmation). Login via `/auth/login`. The root page redirects them appropriately.
2. **Onboarding:** After first login, the user is prompted to enter full name, primary exam, and daily available study hours. This creates a `profiles` row with `id = user.id` and calculates `daily_available_minutes`.
3. **Add subjects:** In `/dashboard/subjects`, the user adds subjects by specifying name, total items, average duration, deadline, and priority. Subjects can be edited or deleted. Deleting a subject likely cascades to tasks through foreign key constraints (the UI warns about associated tasks).
4. **Generate plan:** Navigate to `/planner` and hit "Generate Plan". If overload is detected the UI shows required vs. available minutes and offers to proceed strict or auto‑adjust. Successful generation inserts scheduled tasks for upcoming days.
5. **Dashboard / daily tasks:** `/dashboard` shows tasks scheduled for the current day, along with a summary of total, completed, and remaining minutes. Tasks can be marked complete; completion updates the subject progress.
6. **Calendar:** `/dashboard/calendar` lists tasks grouped by date for the current month. Users may complete tasks from here as well.
7. **Subject progress:** As tasks are completed, the `completed_items` field on subjects increments. This influences future schedule generations since only remaining items appear.


---

This documentation captures the current implementation and behavior of the planner application. It is intended as a reference before any proposed enhancements or refactors.