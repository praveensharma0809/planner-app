# StudyHard Project State For AI Models

Last verified: 2026-03-09
Project root: `c:\Users\Lenono\Desktop\planner-app`

This file is an as-built context snapshot from the current codebase, not a redesign proposal.
Use it as the primary handoff document when another AI needs to understand how the app works today.

## 1. Current Product Reality

StudyHard is a Next.js App Router app for structured study planning and daily execution tracking.

Two major systems currently coexist and are both active:

- Planner system: a 5-phase wizard that builds structure, parameters, constraints, generates a schedule, and commits tasks.
- Execution board system: a monthly spreadsheet-like habit tracker with category and item rows and per-day completion toggles.

The codebase has transitioned from an older subject-level planner to a topic-level planner. A compatibility layer still exists under `app/actions/plan` for older call sites.

## 2. Stack, Tooling, And Commands

Core stack:

- Framework: Next.js 16.1.6 (`app` router)
- Language: TypeScript (strict mode)
- UI: React 19 + Tailwind CSS v4
- Auth and DB: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Tests: Vitest (node environment)

Useful scripts (`package.json`):

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run ci:check` (typecheck + lint + test + build)

## 3. High-Level Architecture

Main layers:

- UI routes and components live in `app/**`.
- Server data access and mutations are server actions in `app/actions/**`.
- Planner pure logic is in `lib/planner/**`.
- Shared DB-facing types are in `lib/types/db.ts`.
- Supabase server client utility is `lib/supabase/server.ts`.

Global app wrappers:

- Root layout: `app/layout.tsx`
- Toast context: `app/components/Toast.tsx`
- Theme state: `app/components/ThemeProvider.tsx`
- Global style and design tokens: `app/globals.css`

## 4. Route Map And Runtime Behavior

`/` (`app/page.tsx`):

- Client-side auth check using browser Supabase client.
- Redirects to `/auth/login`, `/onboarding`, or `/dashboard`.

`/auth/login`, `/auth/signup`:

- Client auth flows via browser Supabase client.
- Signup redirects to login after account creation.

`/onboarding` (`app/onboarding/page.tsx`):

- 4-step client wizard.
- Step 1 inserts `profiles` row directly from client.
- Step 2 adds subjects via server action `addSubject`.
- Step 3 manages off-days via `addOffDay` and `deleteOffDay`.
- Step 4 offers `quickStartPlan` (recommended), manual planner entry, or dashboard skip.

`/planner`:

- New canonical planner flow.
- Main page: `app/planner/page.tsx`.
- Components: `StructureBuilder`, `ParamsEditor`, `ConstraintsForm`, `PlanPreview`, `PlanConfirm`, `PlannerStepper`.

`/dashboard`:

- Main dashboard: `app/dashboard/page.tsx`.
- Calendar: `/dashboard/calendar` (`MonthView` currently active).
- Subjects management: `/dashboard/subjects`.
- Settings and off-days: `/dashboard/settings`.
- Ops dashboard: `/dashboard/settings/operations`.

`/execution`:

- Monthly execution board UI (`app/execution/page.tsx`, `ExecutionBoard.tsx`).
- Uses server-side auth checks in actions.
- Note: this route is not explicitly listed in middleware protected-route check.

## 5. Middleware And Access Control

File: `middleware.ts`

Behavior:

- Refreshes Supabase session using cookies.
- Treats `/dashboard`, `/planner`, and `/onboarding` as protected route prefixes.
- Redirects unauthenticated users to `/auth/login?redirectTo=...`.
- For protected routes, checks that `profiles` row exists; if not, redirects to `/onboarding`.

Important nuance:

- `/execution` is not in the protected route list, but execution actions still enforce user auth.

## 6. Current Data Model In Code

Canonical runtime interfaces: `lib/types/db.ts`.

Primary entities now used by planner:

- `Profile`: includes `full_name`, `primary_exam`, `daily_available_minutes`, `exam_date`, streak fields.
- `Subject`: now structural (`id`, `name`, `sort_order`, `archived`), no workload columns.
- `Topic`: child of subject.
- `Subtopic`: child of topic.
- `TopicParams`: effort and constraints per topic.
- `PlanConfig`: global planner constraints.
- `Task`: generated or manual scheduled work rows.
- `PlanSnapshot`: persisted schedule/config snapshot for history.
- `OffDay`: skipped date rows.

Execution entities:

- `ExecutionCategory`
- `ExecutionItem`
- `ExecutionEntry`

## 7. Planner Wizard (Canonical Flow)

Main page: `app/planner/page.tsx`

Phase 1 (structure):

- Load tree with `getStructure`.
- Save with `saveStructure`.
- `saveStructure` archives removed subjects and deletes removed topics/subtopics/params.

Phase 2 (topic parameters):

- Load with `getTopicParams`.
- Save with `saveTopicParams`.
- UI supports effort entry modes (time, days, lectures).
- Persisted key fields: `estimated_hours`, `priority`, `deadline`, `earliest_start`, `depends_on`, `session_length_minutes`.
- `revision_sessions` and `practice_sessions` are currently forced to `0` on save for compatibility.

Phase 3 (global constraints):

- Load with `getPlanConfig`.
- Save with `savePlanConfig`.
- Key fields used: `study_start_date`, `exam_date`, weekday/weekend capacity, `plan_order`, `final_revision_days`, `buffer_percentage`, `max_active_subjects`.

Phase 4 (preview):

- Generates plan via `generatePlanAction`.
- Shows feasibility warnings and local edit/remove capability before commit.

Phase 5 (confirm):

- Commits via `commitPlan` (planner action namespace).
- Keep-mode options in UI: `until`, `none`, `future`.
- UI default selection is currently `until`.

State persistence detail:

- Wizard progress is persisted in `sessionStorage` under key `planner-wizard-state`.
- Engine version gate in page code: `2026-03-08-sequential-v2`.

## 8. Planner Action Contracts (Current)

Namespace: `app/actions/planner/*`

`generatePlanAction` (`generatePlan.ts`):

- Returns one of: `UNAUTHORIZED`, `NO_CONFIG`, `NO_TOPICS`, planner `PlanResult`.
- Loads active subjects and topics, filters archived subjects, loads topic params and off-days, then runs pure planner engine.
- Emits telemetry event `planner.generate`.

`commitPlan` (`commitPlan.ts`):

- Calls Supabase RPC `commit_plan_atomic`.
- Inputs include `sessions`, `keepMode`, summary, config snapshot, and derived new-plan start date.
- On success revalidates `/dashboard`, `/dashboard/calendar`, `/planner`.
- Emits telemetry event `planner.commit`.

`quickStartPlan` (`quickStartPlan.ts`):

- Auto-creates missing topics for existing active subjects.
- Auto-creates missing topic params with default hours/priority/session length.
- Upserts plan config from profile defaults.
- Runs `generatePlanAction`, then `commitPlan` with summary `Quick start auto plan` and keep mode `future`.
- Emits telemetry event `planner.quick_start`.

`getPlanHistory` (`getPlanHistory.ts`):

- Reads latest 20 rows from `plan_snapshots`.

## 9. Pure Planner Engine (Current Logic)

Files:

- `lib/planner/types.ts`
- `lib/planner/feasibility.ts`
- `lib/planner/scheduler.ts`
- `lib/planner/analyzePlan.ts` (exports `generatePlan`)

High-level behavior:

- `generatePlan` computes feasibility and always attempts scheduling.
- If schedule is empty and feasibility is false, returns `INFEASIBLE`.
- Otherwise returns `READY` with schedule and feasibility payload (even if not fully feasible).

Feasibility engine highlights (`feasibility.ts`):

- Builds day slots from study start to `(exam_date - final_revision_days)`.
- Removes off-days.
- Applies buffer percentage to daily capacity.
- Computes needed minutes per unit from `ceil(estimated_minutes / session_length) * session_length`.
- Classifies unit status as `safe`, `tight`, `at_risk`, or `impossible`.
- Produces per-unit and global suggestions (`increase_capacity`, `extend_deadline`, `reduce_effort`).

Naming nuance:

- `FeasibilityResult.totalSessionsNeeded` and `totalSlotsAvailable` currently hold minute totals, not literal session/slot counts.

Scheduler highlights (`scheduler.ts`):

- Cleans dependencies (removes orphan/self refs), deduplicates units by ID, guards session length `>= 1`.
- Detects circular dependencies and returns empty schedule in that case.
- Enforces sequential topic completion within each subject (topic order is preserved from input order).
- Supports `plan_order`: `balanced`, `priority`, `deadline`, `subject`.
- Supports focus depth via `max_active_subjects`, with urgent subject override (`<= 7` days to deadline).
- Uses round-robin across active subjects each day.
- Applies upfront burn-rate scaling when needed, with hard cap `480` minutes/day.
- Has overflow recovery pass for topics delayed by earlier same-subject sequencing.
- Drops units whose single session length is larger than max day capacity.

Generated session shape:

- `subject_id`, `topic_id`, `title`, `scheduled_date`, `duration_minutes`, `session_type`, `priority`, `session_number`, `total_sessions`.
- Current scheduler emits `session_type: "core"` only.

## 10. SQL And Migration State

Migrations present in repo:

- `supabase/migrations/001_planner_redesign.sql`
- `supabase/migrations/002_session_plan_order.sql`
- `supabase/migrations/003_tasks_session_columns.sql`
- `supabase/migrations/004_commit_keep_previous.sql`
- `supabase/migrations/005_plan_config_focus_depth.sql`
- `supabase/migrations/006_ops_events.sql`

Key schema transition from migration set:

- Introduced topic-level planner tables: `topics`, `topic_params`, `plan_config`, `plan_snapshots`.
- Added planner fields to `tasks`: `topic_id`, `session_type`, `plan_version`, and later `session_number`, `total_sessions`.
- Re-parented `subtopics` from subject to topic.
- Added default to `off_days.id` in SQL, while app still safely supplies UUID explicitly.
- Added `max_active_subjects` and `plan_order` support.
- Added `ops_events` table + indexes + RLS policies.

RPC commit function:

- `commit_plan_atomic` is expected by app commit action.
- Latest migration version includes keep-mode behavior (`none`, `until`, `future`).
- Function inserts snapshot and task rows atomically at DB level.

## 11. Legacy Planner Compatibility Layer

Namespace: `app/actions/plan/*`

Current status:

- `analyzePlan.ts` re-exports new `generatePlanAction`.
- `commitPlan.ts` re-exports new planner commit action.
- `getPlanHistory.ts` re-exports new planner history action.
- `resolveOverload.ts` is now a deprecated stub returning `{ status: "DEPRECATED" }`.
- `logPlanEvent.ts` is a no-op stub.

Still active non-wrapper legacy actions:

- `completeTask.ts`
- `uncompleteTask.ts`
- `createTask.ts`
- `rescheduleTask.ts`
- `rescheduleMissedPlan.ts`

Dashboard and calendar currently call these legacy-path actions.

## 12. Dashboard Subsystem

Main page: `app/dashboard/page.tsx`

Server actions used:

- `getStreak`
- `getWeeklySnapshot`
- `getSubjectProgress`
- `getBacklog`
- `getExecutionMonth`
- plus direct one-off subject query for quick-add dropdown

Dashboard capabilities:

- Today and week progress summary.
- Inline task completion for today.
- Quick add manual task (`is_plan_generated = false`).
- Backlog warning with reschedule-missed flow.
- Embedded execution widget.
- Subject progress health badges.
- Plan history cards from `plan_snapshots`.

Calendar:

- Month view currently used by route.
- Supports complete/uncomplete and date-based reschedule per task.
- Has additional `WeekView` and timetable components in repo, but month view is current route path.

## 13. Execution Subsystem

Core files:

- `app/actions/execution/*`
- `app/execution/page.tsx`
- `app/execution/ExecutionBoard.tsx`
- `app/dashboard/ExecutionWidget.tsx`

`getExecutionMonth` behavior:

- Resolves target month from query or current UTC month.
- Clones previous month structure if target month has no categories.
- Loads categories, items, entries.
- Computes item completion percent and streak.
- Computes global streak and monthly completion percent.

Execution actions include:

- Create/update/delete/undo for categories and items.
- Reorder items within category.
- Toggle daily entries with month-bound validation.

## 14. Onboarding, Settings, And Off-Days

Settings page (`app/dashboard/settings/page.tsx`):

- Profile update via `updateProfile` action.
- Off-day management via `OffDaysManager` and off-day actions.
- Theme toggle.
- Link to operations dashboard.

Off-day insertion details:

- `addOffDay` explicitly sets `id: crypto.randomUUID()`.
- This remains robust even if DB default differs across environments.

## 15. Telemetry And Operations

Telemetry helper: `lib/ops/telemetry.ts`

Events currently tracked:

- `planner.generate`
- `planner.commit`
- `planner.quick_start`
- `planner.reschedule_missed`

Storage behavior:

- Always logs structured events to server console.
- Optionally inserts into `ops_events` when `ENABLE_DB_TELEMETRY=true`.

Ops dashboard:

- Action: `app/actions/ops/getOpsOverview.ts`
- UI route: `/dashboard/settings/operations`
- Provides 24h event summaries, latency stats, issue feed, and quick-start funnel.

## 16. Test Coverage Snapshot

Test config:

- `vitest.config.ts`: node env, global APIs, alias `@ -> ./`.
- `vitest.setup.ts`: timezone UTC, global mock for `next/cache` revalidation functions.

Current test directories:

- `tests/actions/*`
- `tests/planner/*`

What is covered:

- Planner generation, feasibility, and scheduler edge cases.
- Core action behaviors for task creation/completion/reschedule, backlog, streak, month counts, commit RPC path, off-day insert ID behavior.

Observed gaps:

- No full integration tests for new planner wizard actions and phase transitions.
- No test coverage for execution action suite and execution board UI.
- No E2E coverage for onboarding flow.

## 17. Known Caveats And Important Nuances

Planner and naming caveats:

- Feasibility result field names use session/slot words but hold minute totals.
- `generatePlan` can return `READY` with non-feasible metadata if it still generated sessions.

Transition caveats:

- Legacy namespace `app/actions/plan` still exists and is partially active.
- Some comments in legacy files still mention removed old-schema behavior.

Data and query caveats:

- `dashboard` quick-add subject query does not filter archived subjects.
- Some actions intentionally swallow DB errors and return empty/default payloads (`getTopicParams`, `getPlanConfig`, some read actions).

Middleware caveat:

- `/execution` not in middleware protected-route list, though server actions enforce auth.

Schema caveat:

- `plan_config` table includes `session_length_minutes` from migration, but current app-level `PlanConfig` interface and planner usage rely on per-topic `session_length_minutes` instead.

## 18. File Index For Fast AI Onboarding

Read in this order for fastest accurate mental model:

1. `README.md`
2. `app/planner/page.tsx`
3. `app/actions/planner/generatePlan.ts`
4. `lib/planner/analyzePlan.ts`
5. `lib/planner/feasibility.ts`
6. `lib/planner/scheduler.ts`
7. `app/actions/planner/commitPlan.ts`
8. `supabase/migrations/001_planner_redesign.sql`
9. `supabase/migrations/004_commit_keep_previous.sql`
10. `app/dashboard/page.tsx`
11. `app/actions/execution/getExecutionMonth.ts`
12. `lib/types/db.ts`
13. `middleware.ts`
14. `tests/planner/scheduler.test.ts`
15. `tests/actions/commitPlan.test.ts`

## 19. Guidance For AI Code Changes

When changing planner logic:

- Treat `lib/planner/*` as canonical behavior source.
- Keep scheduler sequential-within-subject invariant unless intentionally redesigning.
- Validate edge cases from scheduler tests before and after edits.

When changing data writes:

- Prefer server actions over client direct table writes, except where current onboarding intentionally uses browser client.
- Preserve task ownership and route revalidation patterns.
- Keep commit path compatible with `commit_plan_atomic` signature.

When changing schema assumptions:

- Verify against migration SQL in `supabase/migrations/*` and runtime interfaces in `lib/types/db.ts`.
- If changing RPC params or table columns, update action code and tests together.

---

This file intentionally reflects the mixed transitional state that exists today (new topic-level planner + legacy action namespace adapters) so AI tools do not make incorrect assumptions from older docs.
