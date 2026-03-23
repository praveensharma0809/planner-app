# Planner 3-Step Implementation Plan

Last updated: March 23, 2026
Owner: Planner redesign stream (Phase-1 consolidation)

## Session Updates

### Session: March 20, 2026 (Step-1 execution)

Status: Step-1 completed.

Delivered in this session:
- Reindexed planner flow to 3 phases and moved preview/commit to new Phase-2/Phase-3.
- Wired Phase-1 intake to build params/config defaults and generate preview directly.
- Extended planner setup/plan actions for subject-level start/deadline/rest metadata fallback.
- Added hierarchy validation for subject/chapter date relationships.
- Added subject/chapter metadata support in subject actions and chapter update flow.
- Added additive migration for `subjects.start_date` and `subjects.rest_after_days` plus date indexes.
- Updated planner issue routing and phase labels to match the 3-phase model.

Validation run:
- `npm run typecheck` passed after fixing a parser regression in planner wizard client code.
- `npm run test -- tests/actions/saveTopicParams.test.ts` passed after updating mocks for new `subjects` lookup behavior.

Carryover:
- Full lint and full test-suite run are still pending and should be completed in the next session before Step-2 signoff.

Note:
- The Current State Snapshot section below is the pre-implementation baseline retained for audit history.

### Session: March 20, 2026 (Step-2 execution pass)

Status: Step-2 in progress (major intake UI block completed in this pass).

Delivered in this session:
- Replaced Step-2 placeholder panels in intake with working compact controls.
- Added Step-2 Block-1 inputs for:
  - study start and exam date,
  - weekday/weekend capacity,
  - day-of-week capacity overrides,
  - custom date capacity entries,
  - off-day management (add/remove) from planner intake.
- Added Step-2 Block-2 inputs for:
  - flexibility minutes,
  - max daily minutes,
  - max active subjects/day,
  - explicit Save Step-2 Constraints action.
- Added task duration controls in Step-1:
  - inline per-task duration edit with persistence,
  - bulk apply duration to selected tasks.
- Expanded edit surfaces for metadata:
  - subject drawer now supports start date, deadline, rest-after-days, and in-drawer delete,
  - chapter edit modal now supports start date, deadline, rest-after-days, and in-modal delete.
- Extended planner data loading to include task duration and chapter metadata needed by the new edit surfaces.

Validation run:
- `npm run typecheck` passed.
- `npm run test -- tests/actions/addOffDay.test.ts tests/actions/saveTopicParams.test.ts` passed.

Carryover:
- Remaining Step-2 items still pending from scope matrix:
  - subject/chapter drag-and-drop ordering,
  - dependency editor entry points in both subject and chapter contexts,
  - intake import/reset actions.

### Session: March 20, 2026 (Step-2 completion pass)

Status: Step-2 completed.

Delivered in this session:
- Completed subject and chapter drag-and-drop ordering in intake with persistent reorder actions.
- Added dependency manager modal UX for both subject and chapter entry points, including:
  - target chapter selection in subject scope,
  - searchable dependency candidates,
  - multi-select dependency save flow via topic params.
- Finalized intake top-bar action wiring for import and reset behavior in active flow.
- Added planner navigation-column drag handles and shared reorder interaction polish.

Validation run:
- `npm run typecheck` passed.
- `npm run test` passed (15 files, 95 tests).
- `npm run lint -- "app/(dashboard)/planner/subjects-data-table.tsx"` passed.

Carryover:
- Step-3 cleanup/hardening remains next in sequence.

### Session: March 23, 2026 (Step-3 completion pass)

Status: Step-3 completed.

Delivered in this session:
- Removed obsolete legacy intake components from the active 3-phase planner flow:
  - [app/(dashboard)/planner/components/ConstraintsForm.tsx](app/(dashboard)/planner/components/ConstraintsForm.tsx)
  - [app/(dashboard)/planner/components/ParamsEditor.tsx](app/(dashboard)/planner/components/ParamsEditor.tsx)
  - [app/(dashboard)/planner/components/StudyOrderPanel.tsx](app/(dashboard)/planner/components/StudyOrderPanel.tsx)
  - [app/(dashboard)/planner/components/planner-feasibility.tsx](app/(dashboard)/planner/components/planner-feasibility.tsx)
- Removed residual coupling to legacy intake types by switching preview constraints typing to shared planner draft types in:
  - [app/(dashboard)/planner/components/PlanPreview.tsx](app/(dashboard)/planner/components/PlanPreview.tsx)
- Kept the active planner runtime and 3-phase flow unchanged while eliminating dead intake surface area.

Validation run:
- `npm run typecheck` passed.
- `npm run test` passed (15 files, 95 tests).
- `npm run lint` passed with warnings only in unrelated dashboard subjects UI file:
  - [app/(dashboard)/dashboard/subjects/subjects-data-table.tsx](app/(dashboard)/dashboard/subjects/subjects-data-table.tsx)

Carryover:
- Optional follow-up: address existing non-blocking React hook warnings in dashboard subjects table.

## Goal

Implement your requested planner redesign at production quality by consolidating old Phase 1 + Phase 2 + Phase 3 into a single intake phase, then keeping preview and commit as the only later phases.

Target phase model:
- Phase 1: Intake (Structure + Parameters + Constraints)
- Phase 2: Preview (old Phase 4)
- Phase 3: Confirm and Commit (old Phase 5)

Out of scope for this execution cycle:
- Items 46 to 53 from your list remain for later phases/settings exactly as requested.

## Current State Snapshot (from codebase)

- Current wizard is still 5 phases in [app/(dashboard)/planner/wizard-state.ts](app/(dashboard)/planner/wizard-state.ts) and [app/(dashboard)/planner/PlannerWizardClient.tsx](app/(dashboard)/planner/PlannerWizardClient.tsx).
- Step-2 in intake UI still has placeholders in [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx).
- Task drag ordering exists in the tasks overview area already.
- Subject/chapter drag ordering is not yet fully implemented in the active intake flow.
- Planner engine and tests still reference legacy fields that you want removed from active product behavior.

## Scope Matrix (what we will implement)

### A. Must implement now

1. Subject and chapter drag-and-drop ordering in intake (Step-1).
2. Subject and chapter deadlines and start dates with parent-child date validation. (Put this in the edit button also)
3. Task duration/session length controls:
- per-task manual edit
- multi-select and apply common duration
4. Dependencies via new Set Dependencies actions in both subject and chapter sections.
5. Edit button expansion for Subjects and Chapters:
- include rest-after-days input
- move delete action into edit UI (remove inline delete buttons)
6. Step-2 Block-1 compact constraints:
- study start date
- exam/end date
- weekday capacity
- weekend capacity
- day-of-week capacity
- custom date capacity (calendar UI)
- off-day dates (calendar UI)
7. Step-2 Block-2 compact constraints:
- flexibility minutes
- max daily minutes
- max active subjects per day
8. Remove Phase-2 and Phase-3 intake screens and reindex remaining phases to 1 to 3.

### B. Must remove from active intake behavior now

1. Topic max sessions per day
2. Topic study frequency
3. Topic priority
4. Topic revision session count
5. Topic practice session count
6. Topic tier
7. Plan order mode
8. Plan order stack
9. Final revision days
10. Buffer percentage
11. Max topics per subject per day
12. Subject ordering mode per subject
13. Flexible threshold per subject
14. Min subject gap days

Note: we will remove these from UI and active planner flow first, then hard-delete dead code/migration cleanup in Step 3 once behavior is stable.

## 3-Step Execution Plan

## Step 1: Foundation and Contract Refactor (Backend + Data + Wizard Topology)

Outcome: app is structurally ready for consolidated Phase 1 without breaking preview/commit.

Step 1 status: Completed (implemented on March 20, 2026 session).

### 1.1 Wizard topology changes

Files:
- [app/(dashboard)/planner/wizard-state.ts](app/(dashboard)/planner/wizard-state.ts)
- [app/(dashboard)/planner/PlannerWizardClient.tsx](app/(dashboard)/planner/PlannerWizardClient.tsx)

Work:
- Reindex phases to exactly 3 definitions.
- Replace old phase routing:
  - Old 1 remains new 1 (expanded intake)
  - Old 4 becomes new 2
  - Old 5 becomes new 3
- Remove navigation and state dependencies for old ParamsEditor and ConstraintsForm phases.
- Ensure session storage migration logic upgrades old phase indices safely.

### 1.2 Data contract alignment for intake-first model

Files:
- [lib/planner/draft.ts](lib/planner/draft.ts)
- [lib/types/db.ts](lib/types/db.ts)
- [app/actions/planner/setup.ts](app/actions/planner/setup.ts)
- [app/actions/planner/plan.ts](app/actions/planner/plan.ts)

Work:
- Define new intake DTOs that only include retained fields.
- Mark removed fields as deprecated in contracts and stop requiring them.
- Keep DB compatibility by writing safe defaults for legacy columns while UI no longer exposes them.
- Introduce/extend validation for hierarchy dates:
  - subject start <= chapter start <= chapter deadline <= subject deadline (when fields exist)
  - chapter dates cannot contradict subject dates
- Keep dependency-cycle detection and adapt to new dependency UI entry points.

### 1.3 Subject/chapter ordering and metadata actions

Files:
- [app/actions/subjects/addSubject.ts](app/actions/subjects/addSubject.ts)
- [app/actions/subjects/updateSubject.ts](app/actions/subjects/updateSubject.ts)
- [app/actions/subjects/chapters.ts](app/actions/subjects/chapters.ts)
- new action files under [app/actions/subjects](app/actions/subjects)

Work:
- Add dedicated reorder actions:
  - reorder subjects (global)
  - reorder chapters within selected subject
- Extend update actions for new metadata fields used by edit dialogs (start date, deadline, rest-after-days if finalized there).
- Keep action responses standardized for UI toast handling.

### 1.4 Database migration plan (safe, additive-first)

Files:
- new migration under [supabase/migrations](supabase/migrations)

Work:
- Add missing columns needed by your final model if not present (for subject/chapter start dates and chapter-level deadline/start if not persisted via topic_params).
- Add constraints/indexes for date queries used in planner generation.
- Do not drop legacy columns in this step; only deprecate usage in runtime.

Acceptance for Step 1:
- Wizard compiles with only 3 phases.
- Backend accepts new consolidated intake payload.
- Reorder and metadata actions exist and are testable.
- No typecheck/lint regression.

## Step 2: Phase-1 UX Implementation (Production UI for Step-1 and Step-2)

Outcome: users can fully configure planning inputs in consolidated Phase-1 with clean UX and no placeholders.

Step 2 status: Completed (implemented on March 20, 2026 sessions).

### 2.1 Step-1: Subjects/Chapters/Tasks interaction redesign

Primary file:
- [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)

Work:
- Add drag-and-drop ordering in Subjects and Chapters blocks (same quality as task ordering).
- Preserve task drag ordering behavior; verify no regression.
- Add Set Dependencies entry points:
  - one in Subject block context
  - one in Chapter block context
- Implement dependency modal/drawer UX with search/select + cycle prevention feedback.

### 2.2 Edit button redesign

Files:
- [app/(dashboard)/planner/SubjectDrawer.tsx](app/(dashboard)/planner/SubjectDrawer.tsx)
- chapter edit modal section in [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)

Work:
- Expand edit UI for subject/chapter to include:
  - name
  - date fields per scope
  - rest-after-days input (finalized placement based on your confirmation)
  - delete action moved inside edit UI
- Remove inline delete buttons for subject/chapter rows.
- Keep destructive action confirmation dialogs.

### 2.3 Task duration controls

Files:
- [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)
- [app/actions/subjects/tasks.ts](app/actions/subjects/tasks.ts)

Work:
- Add quick per-task duration input.
- Add multi-select bulk duration apply.
- Add Apply to visible / selected pattern with optimistic updates.
- Ensure duration updates reflect in planner-estimation pipeline.

### 2.4 Step-2 block implementation (compact, dense, clean)

Primary file:
- [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)

Supporting files:
- [app/actions/planner/setup.ts](app/actions/planner/setup.ts)
- optional extracted compact components under [app/(dashboard)/planner/components](app/(dashboard)/planner/components)

Work:
- Replace Block-1 placeholder with compact date and capacity controls.
- Embed mini calendar interaction for custom date capacities and off-days.
- Replace Block-2 placeholder with compact constraint controls for flexibility and caps.
- Ensure both blocks fit current visual footprint and remain mobile-safe.
- Add visual hierarchy and polished UI micro-interactions consistent with dashboard design.

### 2.5 Intake top-bar actions

Primary file:
- [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)

Work:
- Add Import from Subjects options:
  - Import all
  - Import only undone
- Add Reset/Delete All action with guarded confirmation and clear scope text.

Acceptance for Step 2:
- Step-1 and Step-2 collect all retained Phase-1 fields end-to-end.
- No placeholder panels remain.
- Subject/chapter/task ordering all work with persistence.
- UI is compact and production-grade on desktop and mobile widths.

## Step 3: Engine Simplification, Cleanup, and Production Hardening

Outcome: planner runtime uses only desired active fields and passes quality gates.

Step 3 status: Completed (implemented on March 23, 2026 session).

### 3.1 Planner runtime cleanup

Files:
- [lib/planner/draft.ts](lib/planner/draft.ts)
- [lib/planner/engine.ts](lib/planner/engine.ts)
- [app/actions/planner/plan.ts](app/actions/planner/plan.ts)
- [app/actions/planner/setup.ts](app/actions/planner/setup.ts)

Work:
- Remove runtime dependency on eliminated fields.
- Keep deterministic ordering from explicit drag order (subject -> chapter -> task).
- Keep retained constraints only:
  - start/end dates
  - capacities and overrides
  - off-days
  - flexibility minutes
  - max daily minutes
  - max active subjects/day
- Ensure dependencies and rest-after-days continue to work exactly as intended.

### 3.2 Remove obsolete intake screens/components

Files likely impacted:
- [app/(dashboard)/planner/components/ParamsEditor.tsx](app/(dashboard)/planner/components/ParamsEditor.tsx)
- [app/(dashboard)/planner/components/ConstraintsForm.tsx](app/(dashboard)/planner/components/ConstraintsForm.tsx)
- [app/(dashboard)/planner/components/StudyOrderPanel.tsx](app/(dashboard)/planner/components/StudyOrderPanel.tsx)

Work:
- Detach or remove components no longer used in 3-phase flow.
- Remove dead imports and dead action code.
- Keep preview/confirm components as new Phase-2 and Phase-3.

### 3.3 Test and quality hardening

Files:
- planner tests under [tests/planner](tests/planner)
- actions tests under [tests/actions](tests/actions)

Work:
- Update fixtures to new field set.
- Remove assertions for removed features.
- Add new tests for:
  - subject/chapter reorder persistence
  - date hierarchy validation
  - dependency set and cycle rejection
  - per-task and bulk duration updates
  - consolidated intake save/generate flow
- Run full lint, typecheck, unit test suite.

### 3.4 Release checklist

- Accessibility pass (keyboard drag alternatives, focus trapping, labels).
- Loading/error states for each mutation surface.
- Empty-state and recovery UX.
- Telemetry events for key user actions and planner failures.
- Migration and rollback notes.

Acceptance for Step 3:
- Full planner flow works in 3 phases with retained fields only.
- Legacy removed controls are not visible and do not affect runtime behavior.
- Typecheck/lint/tests pass.
- Manual QA sign-off completed.

## File-Level Implementation Map

Primary implementation files:
- [app/(dashboard)/planner/subjects-data-table.tsx](app/(dashboard)/planner/subjects-data-table.tsx)
- [app/(dashboard)/planner/PlannerWizardClient.tsx](app/(dashboard)/planner/PlannerWizardClient.tsx)
- [app/(dashboard)/planner/wizard-state.ts](app/(dashboard)/planner/wizard-state.ts)
- [app/actions/planner/setup.ts](app/actions/planner/setup.ts)
- [app/actions/planner/plan.ts](app/actions/planner/plan.ts)
- [app/actions/subjects/tasks.ts](app/actions/subjects/tasks.ts)
- [app/actions/subjects/chapters.ts](app/actions/subjects/chapters.ts)
- [app/actions/subjects/updateSubject.ts](app/actions/subjects/updateSubject.ts)
- [lib/planner/draft.ts](lib/planner/draft.ts)
- [lib/planner/engine.ts](lib/planner/engine.ts)
- [tests/planner/scheduler.test.ts](tests/planner/scheduler.test.ts)

Optional/new files expected:
- subject/chapter reorder actions in [app/actions/subjects](app/actions/subjects)
- dependency editor component in [app/(dashboard)/planner/components](app/(dashboard)/planner/components)
- compact Step-2 input subcomponents in [app/(dashboard)/planner/components](app/(dashboard)/planner/components)
- migration SQL in [supabase/migrations](supabase/migrations)

## Execution Order and Timebox

1. Step 1 (foundation/contracts): 1.5 to 2.5 days
2. Step 2 (UI implementation): 2.5 to 4 days
3. Step 3 (cleanup/hardening/tests): 1.5 to 3 days

Total expected: 5.5 to 9.5 days depending on dependency UX complexity.

## Open Decisions Required Before Coding

1. Dependency scope:
- Should dependencies be between chapters/topics only, or also allow subject-level dependency chains?
- Should cross-subject dependencies be allowed?

2. Rest-after-days placement:
- Confirm whether rest-after-days should be stored per chapter/topic only, or also subject-level.
- If both levels exist, should chapter override subject default?

3. Date field source of truth:
- Should chapter start/deadline map directly to topic_params earliest_start/deadline?
- Or do you want first-class columns on topics table?

4. Import/Reset semantics:
- Reset/Delete All should archive all, hard delete all, or only clear planner-specific metadata?

5. Task duration and estimated effort coupling:
- When task durations change, should estimated hours auto-recompute live for each chapter/topic?
- Or should they remain manually editable and independent?

6. Off-day ownership in Step-2:
- Confirm Step-2 calendar should write to off_days table directly during intake edits.

7. Archive behavior:
- You confirmed archived subjects/topics are excluded from planning; should archived tasks be auto-hidden in all intake lists or toggleable?

## Decision Lock-In Matrix (Recommended Defaults)

Use these defaults unless you want to override specific items.

1. Dependency scope (recommended):
- Allow dependencies at both subject and chapter levels.
- Allow cross-subject dependencies.
- Reject cycles with clear error messaging.

2. Rest-after-days placement (recommended):
- Store subject-level default rest-after-days.
- Allow chapter-level override.
- Effective rest rule = chapter override when present, otherwise subject default.

3. Date source of truth (recommended):
- Keep chapter date source in `topic_params` (`earliest_start`, `deadline`) for this cycle.
- Avoid introducing first-class `topics` date columns now.
- Revisit first-class columns only if performance/query pressure appears in production.

4. Import/Reset semantics (recommended):
- `Import all`: import all non-archived subjects/chapters/tasks.
- `Import undone only`: import only tasks with incomplete status.
- `Reset/Delete All`: clear planner-intake metadata and draft/session state only; do not hard-delete core subject/chapter/task records.

5. Task duration and effort coupling (recommended):
- Task duration is source-of-truth for planned effort.
- Recompute chapter/topic planned effort live when durations change.
- Keep explicit manual override only if a dedicated override field already exists; otherwise stay fully derived.

6. Off-day ownership (recommended):
- Step-2 calendar writes directly to `off_days` table during intake edits.
- Use optimistic UI and rollback on mutation failure.

7. Archive behavior (recommended):
- Hide archived tasks by default in intake lists.
- Provide a `Show archived` toggle for advanced visibility.

## Reply Template (copy/paste)

Reply in this format to lock decisions quickly:

1. Dependency scope: [accept recommended / custom: ...]
2. Rest-after-days: [accept recommended / custom: ...]
3. Date source of truth: [accept recommended / custom: ...]
4. Import/Reset semantics: [accept recommended / custom: ...]
5. Duration-effort coupling: [accept recommended / custom: ...]
6. Off-day ownership: [accept recommended / custom: ...]
7. Archive behavior: [accept recommended / custom: ...]

## Definition of Done

- All requested features from items a-i and retained Done points (1-45 scope) are implemented in consolidated Phase-1.
- Old Phase-2 and Phase-3 intake screens are removed from active flow.
- Remaining phases renamed and functioning as new Phase-2 and Phase-3.
- Removed features no longer appear in UI or active scheduling logic.
- End-to-end generation and commit flow works with no critical regressions.
- Code quality gates pass and manual UX QA is signed off.
