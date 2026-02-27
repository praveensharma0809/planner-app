# IMPLEMENTATION_PLAN.md

## Backend Delivery Phases
Ordered, dependency-minimal phases. Each phase is independently testable and preserves current behavior.

### Phase 1 — Schema Additions (Non-breaking)
- Changes: add `streak_current`, `streak_longest`, `streak_last_completed_date` to `profiles`; create `off_days` table per DB spec; keep legacy columns untouched.
- Files/Modules: Supabase migration files; type updates in [types/db.ts](types/db.ts) if present.
- Tests/Checks: run migrations in sandbox; verify RLS parity for `off_days`; confirm existing app still runs (no code paths rely on new columns).

### Phase 2 — Planner Engine Split & Contracts
- Changes: refactor planning pipeline into `analyzePlan` (pure blueprint) and `commitPlan` (DB write) contracts; retire `auto` capacity overrides.
- Files/Modules: [lib/planner/generatePlan.ts](lib/planner/generatePlan.ts) (refactor into thin orchestrator or remove logic); new/updated server actions [app/actions/plan/analyzePlan.ts](app/actions/plan/analyzePlan.ts) and [app/actions/plan/commitPlan.ts](app/actions/plan/commitPlan.ts).
- Tests/Checks: unit tests for pure functions (no DB); integration test for `commitPlan` using mock DB adapter to ensure only future generated tasks are deleted and manual tasks untouched.

### Phase 3 — Overload Analyzer Upgrade
- Changes: extend `overloadAnalyzer` to emit per-subject `SubjectFeasibility`, capacity gaps, and adjustment suggestions; keep global summary output.
- Files/Modules: [lib/planner/overloadAnalyzer.ts](lib/planner/overloadAnalyzer.ts); related types in [lib/planner](lib/planner).
- Tests/Checks: unit tests covering safe/tight/at_risk/impossible statuses; effective deadline = `min(subject.deadline, profile.exam_date)`; off-day handling via injected set.

### Phase 4 — Scheduler Enhancements
- Changes: accept `offDays: Set<string>`, enforce `examDeadline`, clamp subject deadline to exam, remove capacity override parameter; preserve ordering logic.
- Files/Modules: [lib/planner/scheduler.ts](lib/planner/scheduler.ts).
- Tests/Checks: unit tests that skip off-days, reject scheduling past exam date, respect daily minutes, and maintain deterministic ordering.

### Phase 5 — Conflict Resolution Action
- Changes: implement `resolveOverload` server action to accept adjustment inputs, rerun analysis, and return updated blueprint; no DB writes.
- Files/Modules: [app/actions/plan/resolveOverload.ts](app/actions/plan/resolveOverload.ts); may reuse analyzer helpers from Phases 2–3.
- Tests/Checks: integration tests with fake inputs verifying idempotent, side-effect-free behavior and correct blueprint diffs.

### Phase 6 — Server Action Surface & Planner Route Wiring
- Changes: ensure `/planner` and onboarding flows call the new actions (`analyzePlan`, `resolveOverload`, `commitPlan`); remove deprecated `auto` path; keep existing completion action untouched.
- Files/Modules: [app/planner/page.tsx](app/planner/page.tsx) (server calls only), [app/onboarding/page.tsx](app/onboarding/page.tsx) server interactions, [lib/planner/generatePlan.ts](lib/planner/generatePlan.ts) if retained as orchestrator.
- Tests/Checks: RSC/server action invocation smoke tests; manual plan generation loop without DB side effects until confirmation.

### Phase 7 — Middleware Route Protection
- Changes: move auth gate to middleware, protecting `/dashboard/*`, `/planner/*`, `/onboarding/*`; redirect to login or onboarding as specified.
- Files/Modules: [middleware.ts](middleware.ts); remove redundant client-side auth guards where safe.
- Tests/Checks: run Next.js middleware tests or request-level integration; verify no flash of protected content and correct redirects with/without profile.

### Phase 8 — Streak Updates on Completion
- Changes: extend completion action to maintain streak columns atomically with `increment_completed_items` RPC; enforce no undo.
- Files/Modules: [app/actions/plan/completeTask.ts](app/actions/plan/completeTask.ts); profile type surface in [types/db.ts](types/db.ts).
- Tests/Checks: unit/integration tests simulating completion across days (yesterday → today, gap reset) ensuring counters match rules.

### Phase 9 — Dashboard/Calendar Data Actions (Backend Only)
- Changes: add server actions for dashboard panels and calendar reschedule per architecture (read-only panels and `rescheduleTask`).
- Files/Modules: [app/actions/dashboard/getBacklog.ts](app/actions/dashboard/getBacklog.ts), [app/actions/dashboard/getStreak.ts](app/actions/dashboard/getStreak.ts), [app/actions/dashboard/getWeeklySnapshot.ts](app/actions/dashboard/getWeeklySnapshot.ts), [app/actions/dashboard/getUpcomingDeadlines.ts](app/actions/dashboard/getUpcomingDeadlines.ts), [app/actions/plan/rescheduleTask.ts](app/actions/plan/rescheduleTask.ts).
- Tests/Checks: integration tests with seeded data for each action; ensure reschedule rejects past dates and respects user scoping.

### Phase 10 — Copy Audit (Backend Strings)
- Changes: neutralize exam/student-specific wording in backend-generated strings (errors, toasts from server actions) while keeping functionality.
- Files/Modules: server action response messages across [app/actions](app/actions), shared helpers if any.
- Tests/Checks: lint/grep pass for deprecated terms; spot-check UI responses fed by server actions.

## Notes on Non-Breakage
- All schema changes are additive; code paths remain compatible with existing columns.
- New planner pipeline runs side-effect free until `commitPlan`; past tasks and manual tasks stay untouched.
- Middleware introduced after planner refactor to avoid blocking in-flight work; confirm routes before enabling.
