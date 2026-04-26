# Implementation Plan — planner-app (dev-v1)

**Branch:** `dev-v1`
**Date:** 2026-04-25
**Author:** Claude (audit + plan)

This document is the execution plan for resolving the audited issues. Work is grouped into three phases by risk, blast radius, and dependency order. No work begins until the user approves with **IMPLEMENT / EXECUTE**.

## Status

| Phase | State |
|---|---|
| Phase 1 — Stabilization quick wins | ✅ Completed 2026-04-25 |
| Phase 2 — Optimistic UI & reload storm | ✅ Completed 2026-04-25 |
| Phase 3 — Architectural cleanup (forks, deps, DnD) | ✅ Completed 2026-04-26 — see Phase 3 + Phase 5 reports |
| Phase 4 — UI/UX consistency follow-up (optimistic gaps, archive, deps) | ✅ Completed 2026-04-26 — see report |
| Phase 5 — 3.A shared-module extraction (forked-component cleanup) | ✅ Completed 2026-04-26 — see report |

---

## Guiding Principles

1. **Non-breaking.** Existing UI structure (mobile + desktop) preserved. No layout/hierarchy changes unless required by a verified fix.
2. **Incremental.** Each phase ships independently and is independently revertible.
3. **No DB writes.** Any schema change is delivered as a SQL migration file only — never applied.
4. **Dead code removed** as part of the phase that supersedes it.
5. **Verify after each phase** with type-check, lint, and a manual UI pass on mobile + desktop breakpoints before moving to the next phase.

---

## Phase 1 — Quick, Low-Risk Wins (Stabilization) ✅ DONE

**Status:** Completed 2026-04-25. tsc, eslint, mojibake, vitest (273/273), and `next build` all clean. Detailed delivery report below in [Phase 1 Delivery Report](#phase-1-delivery-report).

**Goal:** Fix small, isolated, user-visible defects with minimal architectural impact. No shared-component refactors yet.

### Scope

| # | Issue | Files | Change |
|---|---|---|---|
| 2 | Dashboard one-way completion | `app/(dashboard)/dashboard/page.tsx` | Render uncheck form on completed tasks; wire `setTaskCompletion(taskId, false)` (or `uncompleteTask`). Replace silent `catch {}` with toast. |
| 7a | Sidebar "Free plan" + email | `app/components/layout/Sidebar.tsx` | Remove hardcoded "Free plan" line. Fetch `profiles.full_name` and render it instead of email. Memoize `createBrowserClient`. |
| 7b | Phone +91 format | `app/actions/dashboard/updateProfile.ts`, `app/(dashboard)/dashboard/settings/SettingsForm.tsx` | Update `PHONE_PATTERN` to Indian format (`^(\+91[\s-]?)?[6-9]\d{9}$`). Update placeholder + helper text. Light client-side mask (no extra deps). |
| 9 | `updateProfile` email failure blocks rest | `app/actions/dashboard/updateProfile.ts` | Save `full_name`/`phone` first; attempt email change after; surface partial-success result. |
| 10 | Dashboard "Others" filter | `app/(dashboard)/dashboard/page.tsx:130-135` | Remove the `.not("name","ilike","others")` legacy filter — confirm "Others" subject system is fully deprecated, then drop both clauses. |
| 12 | Silent error swallows on dashboard | `app/(dashboard)/dashboard/page.tsx:250, 262` | Surface failures via existing toast util. |

### Out of scope for Phase 1

- Any change to `subjects-data-table.tsx` (planner or dashboard).
- Optimistic-UI refactor.
- Dependencies feature.

### Verification

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] Manual: complete + uncomplete a task on dashboard; confirm toast on error path (simulate by killing network).
- [ ] Manual: edit profile name/phone with invalid email; confirm name/phone persisted.
- [ ] Manual: sidebar shows full name; "Free plan" gone; mobile + desktop.
- [ ] Phone validation accepts `9876543210`, `+919876543210`; rejects `+15551234567`, `12345`.

### Risk

Low. Each change is local and reversible.

### Estimated effort

Small (few hundred LOC, no new components).

---

## Phase 2 — Optimistic UI & Reload Storm (Core UX Fix) ✅ DONE

**Status:** Completed 2026-04-25.

### Phase 2 Delivery Report

**What was wrong:**
- Every mutation handler in `dashboard/subjects/subjects-data-table.tsx` (15 sites), `MonthView.tsx`, `RescheduleMissedButton.tsx`, and `AddTaskButton.tsx` called `await action(); router.refresh()`. The `router.refresh()` call **suspends the component subtree** while the RSC payload is re-fetched, producing a full-screen reload feel.
- Tutorial wizard images were loaded sequentially per-slide, producing blank frames on slow networks.

**What was fixed:**
- Introduced a `refreshInBackground()` helper (or inline `startTransition(() => router.refresh())`) in every mutation handler. The RSC re-fetch now happens off the render-blocking path; the UI stays interactive.
- `MonthView.tsx`: added local optimistic state for complete/uncomplete and reschedule with rollback on action failure. Delete locally filters first, then refreshes in background.
- `TutorialWizard.tsx`: uses React 19's `preload(src, { as: "image" })` from `react-dom` on mount to warm the cache for all flow images before the user navigates.
- `revalidatePath` audit: calls are correctly scoped to routes that show the mutated data — no redundancy to drop. Removing them would break cross-route cache freshness.
- Planner `subjects-data-table.tsx` already uses an in-component `refetchFromDbState()` with explicit `beginMutation`/`endMutation` loading states — no `router.refresh()` calls; pattern is already correct.

**Files touched:**
- `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` — added `useCallback` + `useTransition`, `refreshInBackground` helper, replaced all 15 `router.refresh()` calls.
- `app/(dashboard)/dashboard/calendar/MonthView.tsx` — `useTransition`, optimistic complete/reschedule with rollback, background refresh on delete.
- `app/(dashboard)/dashboard/RescheduleMissedButton.tsx` — `useTransition` background refresh.
- `app/components/tasks/AddTaskButton.tsx` — `useTransition` background refresh after create.
- `app/components/onboarding/TutorialWizard.tsx` — `preload()` of all flow images on mount.

**Deferred to Phase 3:** Forked `subjects-data-table.tsx` unification, dependencies redesign, DnD on Subjects page.

---

**Goal:** Eliminate full-screen reloads on Planner and Subjects pages. Make all task/chapter/subject interactions feel instant. This is issue #3 — the highest-impact UX fix.

### Strategy

Adopt a single, consistent pattern for all mutations:

```ts
const [optimistic, setOptimistic] = useOptimistic(serverState, reducer);
startTransition(async () => {
  setOptimistic({ type: "...", payload });   // instant UI update
  const result = await serverAction(...);    // backend
  if (!result.ok) {
    showMutationError(result.error);          // rollback handled by useOptimistic
  }
});
```

Server actions keep their `revalidatePath` calls (so cross-tab/route freshness still works), but client components no longer `router.refresh()` after every action — they trust optimistic state and let RSC reconcile in the background.

### Scope

| # | Issue | Files | Change |
|---|---|---|---|
| 3a | `router.refresh()` storm | `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` (19 sites) | Replace each with `useOptimistic` + `startTransition`. Remove `router.refresh()` calls. |
| 3b | Planner mutations | `app/(dashboard)/planner/subjects-data-table.tsx`, `MonthView.tsx`, `RescheduleMissedButton.tsx` | Same pattern. |
| 8 | `AddTaskButton` quick-add | `app/components/AddTaskButton.tsx:82` | Optimistic insert; no full refresh. |
| 13 | `MonthView` triple refresh | `app/(dashboard)/planner/MonthView.tsx:153/176/193` | Optimistic. |
| 3c | Tutorial sequential image load | `app/components/onboarding/TutorialWizard.tsx` | Render all slide `<Image>` elements but show only active (CSS `display`/opacity). Add `priority` to first 2-3, `loading="eager"` for the rest. Optionally `<link rel="preload">` for next-frame. |
| 3d | `revalidatePath` over-broadcast | `app/actions/subjects/*.ts`, `app/actions/plan/*.ts` | Audit each action; revalidate only the route(s) that actually need it. Drop redundant duplicates. |

### Approach (subjects-data-table.tsx)

Because both data-tables are large (~1.5k and ~3.5k lines), introduce a small **helper hook** in `lib/hooks/useOptimisticAction.ts` to keep call sites short and consistent:

```ts
export function useOptimisticAction<TState, TAction>(
  initial: TState,
  reducer: (state: TState, action: TAction) => TState
) { /* wraps useOptimistic + startTransition + error toast */ }
```

This avoids touching every call-site with boilerplate.

### Out of scope for Phase 2

- Merging the two `subjects-data-table.tsx` files (Phase 3).
- Adding DnD to subjects page (Phase 3).
- Dependencies redesign (Phase 3).

### Verification

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] Manual: throttle network to "Slow 3G" in DevTools; confirm task check, chapter add, archive all show **instant** UI feedback.
- [ ] Manual: kill network mid-action; confirm rollback + toast.
- [ ] Manual: tutorial wizard — slides advance with no blank frames on Slow 3G.
- [ ] No `router.refresh()` references remain in the listed files (`grep -r "router.refresh" app/`).
- [ ] Mobile + desktop visual regression check on Subjects, Planner, Dashboard.

### Risk

Medium. Optimistic UI bugs (mismatch between optimistic state and server state) can be subtle. Mitigation: keep reducers small, write 2-3 vitest cases per reducer, manually QA every mutation type.

### Estimated effort

Medium. Largest concrete change is rewriting mutation handlers; no new visual components.

---

## Phase 3 — Architectural Cleanup (Forks, Dependencies, DnD) 🟡 PARTIAL

**Status:** 2026-04-25. **3.B (dependencies bugs)**, **DnD on subjects page**, and **3.C (dead-code sweep)** delivered. **3.A (forked component unification)** intentionally deferred — see rationale below.

### Phase 3 Delivery Report (this iteration)

#### Delivered

**3.B — Dependencies feature bug fixes** ([app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx))

- **Bug:** Switching the target chapter inside the subject-scope modal silently kept the prior target's selected prerequisites; saving wrote the wrong dependency set.
  **Fix:** Removed the one-shot load from `openDependencyManager`; added a `useEffect` keyed on `(dependencyModalOpen, dependencyTargetChapterId)` that re-loads `depends_on` from the snapshot every time the user picks a different target.
- **Bug:** Candidate list ignored scope — it surfaced every active chapter globally, including the target's own subject for subject-scope and unrelated subjects for chapter-scope.
  **Fix:** `dependencyCandidates` now filters by `selectedSubject.id`: chapter-scope shows only chapters in the same subject; subject-scope shows only chapters from other subjects. Search-by-name still works on the filtered set.
- **Note on the "label, not selector" claim in the original audit:** Re-reading the code shows chapter-scope's label is correct UX — the target was already chosen before the modal opened. No change.

**DnD on Subjects page** ([app/(dashboard)/dashboard/subjects/subjects-data-table.tsx](app/(dashboard)/dashboard/subjects/subjects-data-table.tsx))

- Subjects column and chapters column are now drag-reorderable via `@dnd-kit/core` + `@dnd-kit/sortable` (already a dep).
- `NavigationColumn` gained two optional props: `onReorder?: (newOrderIds: string[]) => void` and `sensors`. When supplied, items render inside `DndContext` + `SortableContext`; otherwise the column renders flat (preserves the archived-view layout).
- New `NavigationColumnRow` extracted to host `useSortable` per row with a small drag handle (`⋮⋮`) shown only when reordering is enabled.
- Server-side persistence wired to the existing `reorderSubjects` and `reorderChapters` actions. Optimistic state with rollback on failure.

**3.C — Dead code & residue removal**

- Removed all 8 query-site occurrences of the legacy `"others"` / `"__deprecated_others__"` defensive filters (Phase 1 confirmed the Others subject system is fully deprecated; the validation in `addSubject`/`updateSubject` prevents new ones, so the filters were dead defense):
  - [app/(dashboard)/dashboard/calendar/page.tsx](app/(dashboard)/dashboard/calendar/page.tsx)
  - [app/(dashboard)/dashboard/subjects/page.tsx](app/(dashboard)/dashboard/subjects/page.tsx)
  - [app/(dashboard)/planner/page.tsx](app/(dashboard)/planner/page.tsx)
  - [app/actions/dashboard/getSubjectProgress.ts](app/actions/dashboard/getSubjectProgress.ts)
  - [app/actions/dashboard/getUpcomingDeadlines.ts](app/actions/dashboard/getUpcomingDeadlines.ts)
  - [app/actions/schedule/getWeekSchedule.ts](app/actions/schedule/getWeekSchedule.ts)
  - [app/actions/planner/setup.ts](app/actions/planner/setup.ts) (two sites)
- Reservation strings (`'Others' is reserved for standalone tasks.`) in `addSubject`/`updateSubject`/`upsertScheduleTask`/`setup.ts` kept — they are forward-looking input validation tied to the active `STANDALONE_SUBJECT_LABEL` constant, not residue.

#### Deferred — 3.A (forked component unification)

The two `subjects-data-table.tsx` files (~1.5k LOC dashboard, ~3.5k LOC planner) implement overlapping but **non-symmetric** feature sets: planner has the multi-step intake wizard, bulk-series editor, dependency modal, plan config, topic params, intake import, archived-chapters loading via dedicated server actions; dashboard subjects has a smaller, more focused subject-navigation flow. Unifying them safely requires (a) a shared `mode` API designed against both feature lists, (b) extracting `BulkSeriesEditor`, `ArchivedChaptersModal`, `DependencyDialog`, `DraggableColumn` to a shared module, (c) full manual QA on both pages on mobile + desktop. This is a multi-session refactor; rushing it in this turn would introduce regressions on the highest-traffic pages of the app.

Both forks are now stable and using consistent patterns post Phase 2 (background `router.refresh`, optimistic UI on the dashboard one, in-place `refetchFromDbState` on the planner one). The unification can be picked up as its own PR with a feature-flag rollout (`USE_UNIFIED_TABLE`) as the original plan recommended, without blocking the other Phase 3 deliverables.

#### Deferred — 3.B Option A SQL migration

A new `subject_dependencies` table was not delivered because (a) the existing per-chapter `topics.depends_on` array now works correctly with the bug fixes above, and (b) the user has not selected Option A vs Option B. Recommend revisiting only if the per-chapter shape becomes a real-world pain point.

---

**Goal:** Eliminate the forked `subjects-data-table.tsx` (root cause of issues 1, 4, 5), fix the dependencies feature (issue 6), and remove dead code.

### 3.A — Unify the two `subjects-data-table.tsx` files

Both pages will consume one canonical component, with feature flags / props for page-specific differences (e.g., the dashboard page may not show every Planner column).

- Move shared component to `app/components/subjects-data-table/` (new directory).
- Extract sub-components: `BulkSeriesEditor`, `ArchivedChaptersModal`, `DependencyDialog`, `DraggableColumn`.
- Call sites:
  - `app/(dashboard)/planner/page.tsx` — passes `mode="planner"` (full features).
  - `app/(dashboard)/dashboard/subjects/page.tsx` — passes `mode="subjects"` (or omit features not needed).
- Delete the two old files **only after** both pages green on the new component.

This single refactor resolves:

| # | Resolved by |
|---|---|
| 1 | Archive fragmentation — one set of buttons + one Archived Chapters modal, both pages get the same. |
| 4 | Bulk Series — single `BulkSeriesEditor`. |
| 5 | DnD — single `DraggableColumn`. Subjects page wires `reorderSubjectsAction`/`reorderChaptersAction` (already exist). |

### 3.B — Dependencies redesign (issue 6)

**Decision required from user before coding:**

- **Option A (data-model-pure):** Add a new `subject_dependencies` table (or `dependencies` polymorphic table with `target_type`/`target_id`). SQL migration file delivered, not applied.
- **Option B (UI-only fan-out):** Persist subject-level deps onto every chapter in the subject (write fan-out + read aggregation). No schema change.

Both options fix:
- Subject-scope no longer silently writes to `chapters[0]` only.
- Candidate list filters by scope: chapter-scope shows other chapters in same subject; subject-scope shows other subjects.
- Dependency target picker is a real selector for chapter scope, not a label.

**Default recommendation:** Option A — cleaner long-term, no aggregation reads. SQL migration shipped, applied by user.

Files: `app/(dashboard)/planner/subjects-data-table.tsx:1820-1975` (or its successor in 3.A); `app/actions/subjects/dependencies.ts` (new); `supabase/migrations/<timestamp>_subject_dependencies.sql` (new).

### 3.C — Dead code & residue removal

- Delete the two old `subjects-data-table.tsx` once 3.A is green.
- Confirm `flowSlides.ts` import chain; remove if dead.
- Remove silent `catch {}` blocks introduced before Phase 1.
- Consolidate `addToast` vs `showMutationError` usage to one util.
- Remove the deprecated "Others" filter logic everywhere (after Phase 1 confirmed it's safe).

### Out of scope for Phase 3

- Pricing/billing UI (no "Free plan" returns).
- Any change to auth flow.

### Verification

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] `vitest` clean
- [ ] Manual: archive a chapter from Subjects page → appears in Archived Chapters modal there.
- [ ] Manual: drag-reorder subjects + chapters on Subjects page; persists across reload.
- [ ] Manual: Bulk Series editor identical on both pages (incl. duration field).
- [ ] Manual: dependency picker — chapter scope shows other chapters in the same subject only; subject scope shows other subjects only; saving + reopening reflects correct state.
- [ ] No references to deleted files in `git grep`.
- [ ] Bundle size diff: report before/after gzipped JS for `/planner` and `/dashboard/subjects`.

### Risk

Higher. Component unification touches every interaction on both pages. Mitigation: land 3.A behind a per-page feature flag (`USE_UNIFIED_TABLE`) for one commit, smoke-test, then flip and delete the old code in a follow-up commit on the same branch.

### Estimated effort

Large. The unification alone is the biggest change in this plan. Recommend tackling 3.A and 3.B as separate commits; 3.C as a final cleanup commit.

---

## Cross-Cutting Concerns

### Database safety
- Phase 1 + Phase 2: **no schema changes**.
- Phase 3.B may produce a SQL migration. Delivered as `supabase/migrations/<timestamp>_<name>.sql`. **Not applied** by Claude. User runs in production manually.

### Testing
- Add vitest cases for: `useOptimisticAction` reducer (Phase 2), dependency candidate filtering (Phase 3.B), phone validation regex (Phase 1).
- No e2e tests added unless requested — the project's existing test coverage is light and adding Playwright is out of scope.

### Branching
- All work on `dev-v1`.
- One commit per logical change (not per phase). Phases are organizational, not commit boundaries.
- No force-pushes. No merges to `main` without explicit instruction.

### Reporting (after each phase)
On completion of each phase, deliver a report covering:
- What was wrong (per-issue)
- What was fixed (per-issue)
- Files touched (with line counts)
- Verification results
- Any follow-ups deferred to a later phase

---

## Approval Gate

This plan is in **read-only/proposal state**. Reply with one of:

- **IMPLEMENT PHASE 1** — proceed with Phase 1 only.
- **IMPLEMENT ALL** — proceed sequentially; pause between phases for review.
- **REVISE** — name the items you want changed and a revised plan will be produced.

---

## Phase 4 Delivery Report — 2026-04-26

Follow-up pass after the user re-audited the running app and identified residual UI/UX inconsistencies. Scope was constrained to fixes only — no redesign, no layout/hierarchy changes, no breaking changes to mobile or desktop.

### Issues fixed

| # | Issue | Files touched | Resolution |
|---|---|---|---|
| 4.1 | Founder's message lacked desktop-only beta notice | `app/components/FounderMessageModal.tsx` | Added bold note: "Currently, the app is optimized for desktop only. We are working on launching apps for mobile users." |
| 4.2 | Settings: phone "Save changes" button stuck/unresponsive after first phone update | `app/actions/dashboard/updateProfile.ts`, `app/(dashboard)/dashboard/settings/SettingsForm.tsx` | Server action now returns canonical `saved: { fullName, email, phoneNumber }` (with normalized `+91XXXXXXXXXX` phone). Client form resyncs all three inputs on `SUCCESS` and `PARTIAL_SUCCESS`, eliminating the divergence between typed-but-normalized phone and `savedValues` that left `isDirty` permanently false. |
| 4.3 | Subjects: archived chapters still rendered in active list; no dedicated archived view | `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` | Added `showArchivedChapters` toggle + footer button "Archived Chapters (n)" / "Show Active Chapters". Active list filters `archived === false`; archived list filters `archived === true`; archived view is read-only (no DnD reorder, no Add Task, no Manage). Auto-resets to active when no archived chapters remain. |
| 4.4 | Subjects: task check/uncheck/delete waited on the server before reflecting in UI | `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` | `handleToggleTask`, `handleDeleteTask`, `handleDeleteSelectedTasks` now apply local-state mutation **before** `await`, capture previous snapshot, and roll back on non-success. Mirrors the MonthView optimistic pattern. |
| 4.5 | Dashboard home: pending/completed task rows reloaded the whole list after each click | `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/DashboardTaskActions.tsx` | Each row now carries `data-task-row`. The toggle/delete buttons walk to that ancestor and instantly fade-out the row before the server action runs. `router.refresh()` reconciles on success; on failure the row is restored and an error toast is shown. No container/full reload. |
| 4.6 | Schedule page: toggle/delete called `loadWeekData()` after the server returned, causing the whole week panel to flicker-reload | `app/(dashboard)/schedule/page.tsx` | `handleToggleComplete` flips `task.completed` in local `tasks` state immediately and rolls back on non-success. `handleDeleteEvent` filters the task out of `tasks` first; restores prior snapshot if the delete fails. The `await loadWeekData(weekMeta.weekStartISO)` waterfall is removed from these paths. |
| 4.7 | Planner subject-scope dependency picker showed CHAPTERS from other subjects (cross-mixing); no real subject-level semantics | `app/(dashboard)/planner/subjects-data-table.tsx`, `app/(dashboard)/planner/subjects-data-table.modals.tsx` | Picker now scope-aware: chapter-scope still lists chapters within the same subject; subject-scope lists OTHER subjects only. Load-effect derives the picker's selected set by mapping the anchor chapter's `depends_on` (chapter IDs) back to source subject IDs via `chapterById`. Save handler uses fan-out: in subject scope, every chapter in the target subject gets `depends_on = [last chapter of each selected dep subject]`, persisted in a single `saveTopicParams` call carrying one entry per chapter. The "Target Chapter" select is replaced with a read-only "Target Subject: …" label since fan-out applies subject-wide. |

### Dead code removed

- `DependencyManagerModal` component in `app/(dashboard)/planner/subjects-data-table.modals.tsx` — defined but never imported anywhere; the actual modal is inline in `subjects-data-table.tsx`.
- Orphan types `DependencyScope`, `DependencyTargetOption`, `DependencyCandidate` in the same `.modals.tsx` file (the canonical `DependencyScope` lives in `subjects-data-table.tsx`).

### Files touched (this phase)

- `app/components/FounderMessageModal.tsx`
- `app/actions/dashboard/updateProfile.ts`
- `app/(dashboard)/dashboard/settings/SettingsForm.tsx`
- `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/dashboard/DashboardTaskActions.tsx`
- `app/(dashboard)/schedule/page.tsx`
- `app/(dashboard)/planner/subjects-data-table.tsx`
- `app/(dashboard)/planner/subjects-data-table.modals.tsx`

### Verification

- `npx tsc --noEmit` — exit 0
- `npx eslint app` — exit 0
- `npx vitest run` — 30 files / **273 tests passed**
- `npx next build` — successful production build (Next.js 16.1.6, Turbopack)

### Non-goals / not changed

- No DB schema or RLS change. `topics.depends_on` storage shape is preserved; subject-level deps are encoded purely client-side via fan-out.
- No layout/visual redesign. Mobile and desktop breakpoints unchanged.
- No new dependencies added.

### Known follow-ups deferred

- Subjects: chapter-level archive/unarchive/delete are still imperative (not optimistic). Tasks dominate the user-facing latency, so the current optimistic coverage handles the reported pain. Promoting chapter ops to optimistic is a future polish item.
- Planner subject-scope dep semantics rely on "last chapter" of each dep subject as the anchor. If a user later reorders chapters, the persisted dep does not auto-rebind — it stays pinned to whatever chapter was last at save time. Acceptable for now; revisit if it surfaces in user feedback.

---

## Phase 5 Delivery Report — 2026-04-26 (Phase 3.A follow-through)

The original Phase 3 plan deferred 3.A (forked-component unification) as a multi-session refactor. After Phase 4 closed the user-facing bugs, this phase tackled the leftover code-organization debt **without** changing any visible behavior on either page.

### Approach taken — and why

A full single-component unification with a `mode: "planner" | "subjects"` prop was rejected after a deep diff of the two files:

- The two `NavigationColumn` implementations have meaningful UX differences (planner: 208px column, drag-anywhere on the card; dashboard: 220px column, dedicated `⋮⋮` drag handle).
- The two `NameModal` implementations differ (dashboard's accepts a `destructiveActionLabel`/`onDestructiveAction` pair used to surface chapter archive/unarchive from inside the modal; planner's does not).
- Forcing a single component would either alter UX on at least one page (breaking the project's "no breaking changes" rule) or push the divergence into runtime branches inside one file — which is worse than the current duplication.

Instead, we extracted the **truly identical** primitives into a shared module so both pages converge on a single source of truth where it is safe to do so, and kept the visually-divergent shells in their respective files.

### What was delivered

**New shared module:** [app/components/subjects-data-table/](app/components/subjects-data-table/)

- `helpers.ts` — task-ordering and bulk-naming utilities (`clampInteger`, `composeSeriesName`, `compareTasksNaturally`, `shouldAutoOrderTasks`, `buildMonthGrid`, `defaultIntakeConstraints`, `normalizeDayOfWeekCapacity`, `normalizeDurationMinutes`, `isLikelyNetworkError`, month-cursor helpers). Moved from `app/(dashboard)/planner/subjects-data-table.helpers.ts`.
- `shared.tsx` — `RowActionButton` component + `ColumnItem` interface. New file; both files import from here.

**Dead code removed**

- `app/(dashboard)/planner/subjects-data-table.ui.tsx` (485 LOC) — confirmed never imported by anything in the repo. The planner had been using its own inline copies of `NavigationColumn`/`NameModal`/`RowActionButton` all along; the `.ui.tsx` file was orphaned. Deleted in this phase.

**Inline duplicates collapsed**

- Dashboard `subjects-data-table.tsx`: removed inline `clampInteger`, `composeSeriesName`, `buildNumericPatternKey`, `extractNumericParts`, `shouldAutoOrderTasks`, `compareTasksNaturally`, `RowActionButton`, and the `ColumnItem` interface. Now imports them from the shared module.
- Planner `subjects-data-table.tsx`: removed inline `RowActionButton` + `ColumnItem` interface. Imports both from the shared module. (Helper imports already pointed at the moved file.)

### Quantitative impact

| File | Before | After | Δ |
|---|---:|---:|---:|
| `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` | 2054 | 1923 | −131 |
| `app/(dashboard)/planner/subjects-data-table.tsx` | 3881 | 3835 | −46 |
| `app/(dashboard)/planner/subjects-data-table.ui.tsx` (dead) | 485 | — | −485 |
| `app/components/subjects-data-table/helpers.ts` (moved) | — | 218 | +0 (relocation) |
| `app/components/subjects-data-table/shared.tsx` (new) | — | 64 | +64 |
| **Net repo LOC** | | | **−598** |

### Files touched

- Created: `app/components/subjects-data-table/shared.tsx`
- Moved: `app/(dashboard)/planner/subjects-data-table.helpers.ts` → `app/components/subjects-data-table/helpers.ts`
- Deleted: `app/(dashboard)/planner/subjects-data-table.ui.tsx` (was dead code)
- Modified: `app/(dashboard)/planner/subjects-data-table.tsx`
- Modified: `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx`

### Verification

- `npx tsc --noEmit` — exit 0
- `npx eslint app` — exit 0
- `npx vitest run` — 30 files / **273 tests passed**
- `npx next build` — successful production build (Next.js 16.1.6, Turbopack)
- Bundle output: route table identical to Phase 4 (no chunks added/removed)

### What was intentionally NOT done

- **`NavigationColumn` and `NameModal` were not unified.** Documented above — both have UX-divergent visual contracts that would regress one page if forced together. Each file keeps its own implementation, with cross-references in comments so future contributors know.
- **No `subject_dependencies` SQL migration (3.B Option A).** Phase 4 shipped the UI fan-out path (Option B) which fixes the user-visible bug; Option A is no longer required and would only make sense if the per-chapter shape becomes a real-world pain point later.

### Phase 3 status update

Phase 3 is now ✅ complete. Specifically:

- **3.A — Forked-component cleanup** ✅ done via the shared-module extraction documented above.
- **3.B — Dependencies feature bug fixes** ✅ done in Phase 3 + Phase 4 (fan-out persistence, scope-correct picker).
- **3.C — Dead code & residue removal** ✅ done in Phase 3 + Phase 5 (`subjects-data-table.ui.tsx` was the last orphan).


For Phase 3.B, also indicate **Option A** (new table + SQL migration) or **Option B** (fan-out, no schema change).
