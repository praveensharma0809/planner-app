# IMPLEMENTATION_PLAN.md

## Backend Delivery Phases
Ordered, dependency-minimal phases. Each phase is independently testable and preserves current behavior.

**Status legend:** ✅ Complete · 🔄 Partial · ⬜ Not started

---

### Phase 1 — Schema Additions (Non-breaking) ✅
- Changes: add `streak_current`, `streak_longest`, `streak_last_completed_date` to `profiles`; create `off_days` table per DB spec; keep legacy columns untouched.
- Also added (post-audit): `off_days.id DEFAULT gen_random_uuid()`; `profiles → auth.users` FK.
- Files: `supabase/migrations/202602280001_phase1_schema.sql`, `202602280003_schema_corrections.sql`; `lib/types/db.ts` updated.
- Status: **Complete and applied.**

### Phase 2 — Planner Engine Split & Contracts ✅
- Changes: refactored planning pipeline into `analyzePlan` (pure blueprint) and `commitPlan` (DB write) contracts; retired `auto` capacity override.
- Files: `lib/planner/analyzePlan.ts`, `app/actions/plan/analyzePlan.ts`, `app/actions/plan/commitPlan.ts`. `generatePlan.ts` retained as thin orchestrator.
- Tests: unit tests for pure functions pass; `commitPlan` integration test passes.
- Status: **Complete.**

### Phase 3 — Overload Analyzer Upgrade ✅
- Changes: extended `overloadAnalyzer` to emit per-subject capacity gap and adjustment suggestions alongside global summary.
- Files: `lib/planner/overloadAnalyzer.ts`.
- Tests: unit tests covering strict/auto modes pass.
- Status: **Complete.**

### Phase 4 — Scheduler Enhancements ✅
- Changes: added `offDays: Set<string>` parameter; enforces `examDeadline`; clamps subject deadline to exam date; removed capacity override parameter.
- Files: `lib/planner/scheduler.ts`.
- Tests: scheduler unit tests pass (off-days, exam-date, ordering).
- Status: **Complete.**

### Phase 5 — Conflict Resolution Action ✅
- Changes: implemented `resolveOverload` server action \u2014 accepts adjustment inputs (`extendDeadline`, `reduceItems`, `increaseDailyMinutes`), reruns analysis, returns updated blueprint. No DB writes.
- Files: `app/actions/plan/resolveOverload.ts`.
- Status: **Complete (server action). Full UI panel in progress per Frontend Roadmap Phase 2.**

### Phase 6 — Server Action Surface & Planner Route Wiring ✅
- Changes: `/planner` page calls `analyzePlanAction`, `resolveOverload`, and `commitPlan`. Deprecated `auto` mode removed from server path.
- Files: `app/planner/page.tsx`, `app/actions/plan/analyzePlan.ts`.
- Status: **Complete.**

### Phase 7 — Middleware Route Protection ✅
- Changes: `middleware.ts` protects `/dashboard/*`, `/planner/*`, `/onboarding/*`; redirects to login if no session; redirects to `/onboarding` if session exists but no profile row.
- Files: `middleware.ts`.
- Status: **Complete.**

### Phase 8 — Streak Updates on Completion ✅
- Changes: `completeTask.ts` fully reimplemented \u2014 replaced PostgREST RPC with direct table operations. Now performs: mark task complete (idempotent); increment `subjects.completed_items`; compute and update streak fields on `profiles`. See post-audit notes.
- Files: `app/actions/plan/completeTask.ts`.
- Tests: `tests/actions/completeTask.test.ts` \u2014 3 tests passing.
- Note: Root cause of the `uuid \u2192 "0"` production bug (PostgREST schema-cache binding failure) was eliminated by removing the RPC call entirely. `complete_task_with_streak` remains in the DB as an admin helper but the app no longer calls it.
- Status: **Complete.**

### Phase 9 — Dashboard/Calendar Data Actions (Backend Only) ✅
- Changes: all dashboard data actions implemented and wired.
- Files: `app/actions/dashboard/getBacklog.ts`, `getStreak.ts`, `getWeeklySnapshot.ts`, `getUpcomingDeadlines.ts`; `app/actions/plan/rescheduleTask.ts`.
- Tests: integration test patterns validated via mock.
- Status: **Complete.**

### Phase 10 — Copy Audit (Backend Strings) ✅
- Changes: neutralize exam/student-specific wording in server action response messages and UI copy.
- Status: **Complete. Full language audit done in Session 7 — all UI and backend strings neutralized.**

---

## Notes on Non-Breakage
- All schema changes are additive; existing code paths remain compatible.
- New planner pipeline is side-effect free until `commitPlan`; past tasks and manual tasks stay untouched.
- Middleware runs after server actions are deployed; no ordering dependency.

## Post-Audit Corrections (February 28, 2026)
The following issues were identified and resolved during a full system audit:

| Issue | Fix |
|---|---|
| `uuid → "0"` in RPC (PostgREST schema-cache binding) | Removed RPC; rewrote `completeTask` with direct table ops |
| `completeTask` accepted `FormData \| string` (unnecessary complexity) | Simplified to `string` only |
| `console.log` in calendar JSX | Removed |
| Duplicate `revalidatePath` in calendar page | Removed; `completeTask` handles it |
| `TaskCard.tsx` missing `"use client"` directive | Added |
| `completeTask.test.ts` expected RPC call with wrong arg name | Rewrote test to verify direct table ops |
| `vitest.config.ts` missing `setupFiles` | Added |
| `vitest.setup.ts` missing `next/cache` mock | Added global mock |
| `generatePlan.ts` duplicate spread `{ status: "OVERLOAD", ...analysis }` | Fixed to `return analysis` |
| `planner/page.tsx` `return analysis.status` after exhaustive union | Fixed to `return ""` |
| `tests/*.test.ts` wrong vitest reference directive | Fixed to `vitest/globals` |
| `off_days.id` missing `DEFAULT gen_random_uuid()` | Migration 3 adds it |
| `profiles` missing FK to `auth.users` | Migration 3 adds it |
| Empty `app/api/dev/test-plan/` folder | Deleted |

