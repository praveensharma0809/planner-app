# Current System Overview

**Last updated:** February 28, 2026 (Session 8 — Batch 2)

This document describes the current implemented and stable state of StudyHard. It is kept in sync with every change batch.

---

## 1. Application Purpose

StudyHard is a Strategic Execution Engine for people preparing for high-stakes goals. Users define subjects with item counts and deadlines, specify daily capacity, and the system generates a capacity-aware task schedule through an analyze-review-confirm pipeline. Tasks are tracked on a dashboard and calendar. Streaks, backlog, and subject progress are maintained automatically on completion.


## 2. Major Modules and Folders

- **`app/`** — Next.js 16 (App Router) frontend pages and layouts.
  - `/auth/` — Login and signup screens using Supabase browser client. Branded UI with loading states, toast errors, try-catch error handling, `<main>` semantic wrappers, and cross-page links.
  - `/onboarding/` — 5-step onboarding wizard: Profile → Subjects → Off-Days → Blueprint Preview → Confirm & Generate. Uses toast system (no alert() calls). All 6 async handlers wrapped in try-catch. Progressbar aria roles. Accessible input labels.
  - `/dashboard/` — Authenticated area, protected by middleware:
    - `layout.tsx` — Sidebar navigation (responsive: slide-out drawer on mobile, fixed on desktop).
    - `Sidebar.tsx` — Nav links with icons, active state indicator bar (emerald accent), transitions, sign-out button with try-catch.
    - `page.tsx` — Dashboard: streak (with break warning), today's tasks (with quick-add), weekly strip, deadline proximity alerts, backlog, plan health with execution score, mini monthly calendar, backlog reschedule banner.
    - `QuickAddTask.tsx` — Inline quick-add task for today, embedded in dashboard. Subject picker, duration input, Enter-to-submit.
    - `subjects/` — Subject CRUD via server actions (`SubjectCard`, `AddSubjectForm`). Supports archive/restore (soft-delete). Archived subjects shown in separate section. Subtopics panel per subject.
    - `calendar/` — Week view AND month view:
      - **WeekView** — HTML5 drag-and-drop rescheduling, mark complete, inline reschedule, undo complete (↩), Add Custom Task form. Optimistic UI + revert.
      - **MonthView** — Interactive monthly grid with keyboard navigation (arrow keys), day expansion with task completion/undo, `role="grid"`, roving tabindex.
    - `settings/` — Profile/settings editor + off-days management + re-trigger onboarding + theme toggle.
  - `/planner/` — Analyze → overload resolution → task preview → commit pipeline. Confirmation dialog before re-generating. Plan history log. Division-by-zero guards.
  - `/components/` — `SubmitButton`, `Toast` (with aria-live), `ThemeProvider` (light/dark).
  - Root `page.tsx` — Redirects based on auth/profile state.

- **`lib/`** – Shared library code.
  - `constants.ts` — APP_NAME, timing constants, urgency/score/health thresholds, locale config, priority options.
  - `supabase.ts` — Browser Supabase client.
  - `supabase/server.ts` — `createServerSupabaseClient()` cookie-based server client.
  - `types/db.ts` — `Profile`, `Subject` (with `archived`), `Task`, `OffDay`, `Subtopic`, `PlanEvent`.
  - `planner/` — Pure planning logic: `scheduler.ts`, `overloadAnalyzer.ts`, `analyzePlan.ts`.

- **`app/actions/plan/`** – Server actions for task and plan mutations.
  - `completeTask.ts` — Mark complete, update subject counter + streak. Returns `void`.
  - `uncompleteTask.ts` — Mark incomplete, decrement subject counter (floor 0). No streak change.
  - `analyzePlan.ts` — Load profile/subjects(excl. archived)/off_days, run engine, return blueprint.
  - `commitPlan.ts` — Delete future generated tasks, insert new schedule, log plan event.
  - `rescheduleTask.ts` — Move task to new date. Reject past dates.
  - `resolveOverload.ts` — Recompute with adjustments. Excludes archived subjects.
  - `createTask.ts` — Custom manual task creation.
  - `logPlanEvent.ts` — Log events to plan_events table.
  - `getPlanHistory.ts` — Fetch last 20 plan events.

- **`app/actions/dashboard/`** – Read-only server actions. All subject queries filter `archived = false`.
- **`app/actions/subjects/`** – `addSubject`, `updateSubject`, `deleteSubject`, `toggleArchiveSubject`, `subtopics`.
- **`app/actions/offdays/`** – `addOffDay`, `deleteOffDay`, `getOffDays`.
- **`middleware.ts`** – Session refresh, auth redirect, profile redirect.


## 3. Backend Architecture Style

Serverless via Supabase (PostgreSQL + Auth + RLS). All mutations through Next.js Server Actions with cookie-based Supabase server client. Planning engine is pure functions in `lib/planner/`. All actions return structured types (SUCCESS/UNAUTHORIZED/ERROR).


## 4. Database Structure

Six public tables, all with RLS (`user_id = auth.uid()`):

- **`profiles`** — `id` (FK auth.users), `full_name`, `primary_exam`, `qualification`, `phone`, `daily_available_minutes`, `exam_date`, `streak_current`, `streak_longest`, `streak_last_completed_date`, `created_at`.
- **`subjects`** — `id`, `user_id`, `name`, `total_items`, `completed_items`, `avg_duration_minutes`, `deadline`, `priority`, `mandatory`, **`archived`** (default false), `created_at`.
- **`tasks`** — `id`, `user_id`, `subject_id` (FK), `title`, `scheduled_date`, `duration_minutes`, `priority`, `completed`, `is_plan_generated`, `created_at`.
- **`off_days`** — `id`, `user_id`, `date`, `reason`, `created_at`. Unique on `(user_id, date)`.
- **`subtopics`** — `id`, `user_id`, `subject_id`, `name`, `total_items`, `completed_items`, `sort_order`, `created_at`.
- **`plan_events`** — `id`, `user_id`, `event_type` (analyzed/committed/resolved_overload), `task_count`, `summary`, `created_at`.

Migrations: `202602280001` (streaks, off_days), `202602280002` (streak function), `202602280003` (corrections), `202602280004` (subject archive), `202602280005` (plan_events).


## 5. Task & Schedule Management

### Plan generation
1. `analyzePlanAction()` loads profile, subjects (excl. archived), off_days.
2. `analyzePlan()` → `overloadAnalyzer` + `scheduler` → `ScheduledTask[]`.
3. Overload → `resolveOverload(adjustment)` recomputes (no DB write).
4. Confirmation dialog if re-analyzing existing plan.
5. `commitPlan()` → delete old + insert new + log plan event + revalidate.

### Task completion / undo
- `completeTask(taskId)`: Mark complete, increment subject counter, update streak. Idempotent.
- `uncompleteTask(taskId)`: Mark incomplete, decrement counter (floor 0). No streak change. Undo button (↩) in WeekView + MonthView.

### Rescheduling
- Inline date picker or HTML5 drag-and-drop in WeekView.
- `rescheduleTask(taskId, newDate)`: Rejects past dates.

### Subject archiving
- `toggleArchiveSubject()`: Toggles `archived`. Archived excluded from planning/dashboard/deadlines. Visible in subjects "Archived" section.


## 6. Authentication
- Supabase Auth (email/password), cookie-based sessions.
- `middleware.ts` refreshes sessions, redirects unauthenticated/no-profile.
- All server actions verify auth independently.


## 7. Accessibility
- `focus-visible` keyboard rings. Arrow key MonthView navigation (roving tabindex).
- `aria-label` on all buttons (with dynamic context), `aria-expanded` on toggles.
- `role="grid"` on calendar, `role="status" aria-live="polite"` on toast, `role="progressbar"` on stepper.
- `htmlFor`/`id` on form fields. `<main>` semantic wrappers.


## 8. Error Handling
- Try-catch on all ~30+ client-side async functions with `finally` blocks.
- Toast notifications for all feedback (no `alert()` calls).
- Division-by-zero and NaN guards on numeric computations.
- Optimistic UI with revert on error (WeekView/MonthView).
- Per-route `error.tsx` error boundaries.


## 9. Theme System
- `ThemeProvider` context, `data-theme` attribute on `<html>`.
- Persists to `localStorage` (`studyhard-theme`).
- Light mode via `[data-theme="light"]` CSS overrides.


## 10. Test Suite

**52 tests across 11 files**, all passing, 0 TypeScript errors.

| File | Tests | Coverage |
|---|---|---|
| `completeTask.test.ts` | 3 | Auth, idempotency, table ops |
| `commitPlan.test.ts` | 2 | Future-only insert, unauthorized |
| `getSubjectProgress.test.ts` | 4 | Auth, health computation, edge cases |
| `getMonthTaskCounts.test.ts` | 4 | Auth, aggregation, sorting |
| `getStreak.test.ts` | 4 | Streak calculations |
| `getBacklog.test.ts` | 4 | Backlog filtering |
| `rescheduleTask.test.ts` | 6 | Validation |
| `createTask.test.ts` | 6 | Creation validation |
| `analyzePlan.test.ts` | 2 | OVERLOAD/READY modes |
| `scheduler.test.ts` | 9 | Off-days, exam-date, empty, capacity, interleaving, priority |
| `overloadAnalyzer.test.ts` | 7 | Overload edge cases |


## 11. Recent Changes (Session 8 — Batch 2)

| Change | Key Files |
|---|---|
| Production hardening (try-catch, guards, constants, aria-live) | `lib/constants.ts`, ~14 component files |
| Accessibility (~29 aria fixes) | Multiple components |
| Keyboard calendar navigation | `MonthView.tsx` |
| Confirm before plan regen | `planner/page.tsx` |
| Task undo (uncomplete) with optimistic UI | `uncompleteTask.ts`, WeekView, MonthView |
| Sidebar icons + active indicator | `Sidebar.tsx` |
| Dashboard quick-add task | `QuickAddTask.tsx`, `page.tsx` |
| Subject archive/soft-delete | Migration, toggle action, type update, query filters |
| 7 new scheduler tests (45→52) | `scheduler.test.ts` |
| Planner history log | Migration, log/fetch actions, planner UI |

### Session 8 — Batch 1 Changes

Drag-to-reschedule, streak break warning, deadline alerts, tests 18→45, theme toggle, empty states, responsive polish, subtopics panel.

### Prior Sessions

Auth, onboarding wizard, planner pipeline, dashboard (7+ panels), calendar (week+month), subjects CRUD, settings, toast system, error boundaries, loading skeletons, sidebar, branding, language audit, focus-visible styles.


## 12. Tech Stack

- **Runtime:** Next.js 16.1.6 (App Router, Turbopack)
- **Language:** TypeScript (strict mode, 0 errors)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Testing:** Vitest (52/52 passing)
- **Package manager:** npm
