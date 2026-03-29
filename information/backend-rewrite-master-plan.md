# Backend Rewrite Master Plan (DB + Planner Engine + Actions)

Status: Completed
Last updated: 2026-03-27

## 1) Goal
Rewrite the backend in a controlled way so it becomes simpler, safer, and easier to maintain.

Primary goals:
- Reduce complexity and file size in core planner code.
- Keep behavior stable for users.
- Keep runtime code tightly synced with the active DB schema.
- Make logic understandable enough for non-technical edits in small areas.

Current strategic decisions (already agreed):
- Remove execution module.
- Keep telemetry optional.
- Remove legacy hierarchy concepts everywhere.
- Use JSON-only snapshots for planning history.

Current DB reality:
- DB v2 cutover is already applied in Supabase.
- Active schema reference is `information/Current_db_Schema.md`.
- Runtime code must now follow DB v2 exactly (no legacy compatibility writes).

## 2) Scope
In scope:
- Database schema redesign and migration.
- Planner engine rewrite (core scheduling logic).
- Planner backend actions rewrite (setup/plan/commit flow).
- Documentation for maintainers and non-technical edits.

Out of scope (for first rewrite pass):
- Full UI redesign.
- New planner features beyond parity.
- Analytics redesign (except optional telemetry wiring).

## 3) Non-Negotiables (Safety Rules)
- No destructive cutover without backup and rollback script.
- No production write path switch until test gates pass.
- All migrations must be reversible or have a documented fallback.
- New backend must preserve existing user-visible behavior unless explicitly approved.

## 4) Target Architecture (High-Level)
- DB v2: lean planner tables only, strict ownership and RLS, minimal RPC surface.
- Engine v2: single orchestrator + small pure helper modules.
- Actions v2: thin validated actions calling engine + persistence layer.
- Contracts: clear JSON payloads between intake, engine, and commit.

## 5) Completed So Far (Progress Snapshot)

Done:
- DB reset/cutover completed and documented.
- `information/Current_db_Schema.md` created as current-state source of truth.
- Planner and schedule actions migrated from legacy columns/tables:
	- Removed runtime references to deprecated planner table/field aliases.
	- Replaced with `topics` merged params, `planner_settings`, `task_source`, and `plan_snapshot_id`.
- Legacy hierarchy UI flows removed from planner and subjects tables.
- Obsolete hierarchy action module removed.
- Legacy assignment action removed.
- Workspace diagnostics currently clean.

Critical sync correction completed:
- `task_source` values standardized to DB-valid set:
	- `manual`
	- `plan`

Open risk to validate in next phase:
- Behavior drift can still hide in edge-case runtime paths even when types compile.
- Need full schema-contract and behavior validation pass before proceeding to new feature work.

Next phase kickoff (completed):
- Phase 7 started with automated contract enforcement:
	- Added canonical enum constants in `lib/planner/contracts.ts`.
	- Added runtime legacy-token guard suite in `tests/contracts/dbV2ContractGuard.test.ts`.
	- Added dedicated CI step (`npm run test:contracts`) in local and GitHub CI flows.
- Validation gate result after kickoff changes:
	- Typecheck: pass
	- Lint: pass
	- Contract Guard: pass
	- Tests: pass (99/99)
	- Build: pass

## 6) Next Phase - Schema-Sync Hardening and Complete Cleanup

Objective:
- Ensure backend and planner flows are fully aligned with DB v2 contract, with no legacy residue and no silent edge-case regressions.

Execution progress:
- Phase 6.1 started and baseline artifacts created:
	- `information/db-v2-contract-matrix.md`
	- `information/cleanup-residuals.md`
- Contract corrections applied in runtime code:
	- `task_source` standardized to `manual | plan`
	- planner settings reads/writes restricted to DB-v2 columns
	- plan snapshots mapped to `settings_snapshot`
- Validation gate result:
	- Lint: pass
	- Build: pass
	- Typecheck: pass
	- Tests: pass (97/97)

Phase 6 completion status:
- Phase 6.1 complete: contract lock + residual inventory done.
- Phase 6.2 complete: action-layer hardening implemented.
	- Shared validators added in `lib/planner/contracts.ts`.
	- Date/session/study-frequency guards standardized across planner/subject/task write paths.
- Phase 6.3 complete: edge-case and negative-path regression tests updated and passing.
- Phase 6.4 complete: residual legacy references removed from active runtime code.

Execution principles:
- Schema-first checks before behavior assumptions.
- Remove dead compatibility shims unless explicitly required.
- Prefer explicit failures over silent fallback for invalid state.
- Validate high-risk paths with focused tests.

### Phase 6.1 - Contract Lock and Inventory
Tasks:
- Build a contract matrix from `information/Current_db_Schema.md` against:
	- `lib/types/db.ts`
	- all planner/schedule/dashboard subject-task actions
	- planner page loaders and data mappers
- Verify enum/value sync for constrained fields:
	- `tasks.task_source` in (`manual`, `plan`)
	- `tasks.session_type` in (`core`, `revision`, `practice`)
	- `topics.study_frequency` in (`daily`, `spaced`)
- Flag all compatibility leftovers and classify:
	- must remove now
	- can keep temporarily with explicit TODO + reason

Deliverables:
- `information/db-v2-contract-matrix.md`
- `information/cleanup-residuals.md`

Exit criteria:
- Every runtime-read/write field is mapped to a real DB v2 column.
- No unresolved unknown-field writes.

### Phase 6.2 - Action-Layer Hardening
Tasks:
- Normalize action-level payload guards for planner-critical writes:
	- reject invalid enum values before DB write
	- reject invalid date windows (`earliest_start` > `deadline`)
	- reject cross-user IDs on all mutating paths
- Enforce planner settings fallback order consistently:
	- `planner_settings` first
	- profile fallback only where explicitly intended
- Standardize commit/reschedule flows so plan tasks are always `task_source = plan`.

Deliverables:
- Consistent validation helpers for planner actions.
- Action contracts updated in docs.

Exit criteria:
- No mutating action can write schema-invalid values.
- No legacy value aliases remain in writes.

### Phase 6.3 - Edge-Case Coverage and Regression Guards
Tasks:
- Add/adjust tests for edge cases:
	- empty topic set
	- all topics archived
	- no off-day capacity window
	- dependency cycle detection
	- mixed manual + plan tasks on same day
	- reoptimize/reschedule with completed tasks preserved
	- keep modes (`future`, `until`, `none`, `merge`) in commit paths
- Add explicit tests for schema-sensitive mappings:
	- `task_source` value handling
	- `plan_snapshot_id` linkage
	- topic merged params reads from `topics`

Deliverables:
- Updated tests under `tests/actions` and `tests/planner`.
- Edge-case checklist in `information/`.

Exit criteria:
- Planner-critical tests pass with DB v2 semantics.
- No known untested high-risk edge case remains.

### Phase 6.4 - Final Residual Cleanup
Tasks:
- Remove dead types/constants/files that only existed for legacy compatibility.
- Remove stale comments that reference removed schema elements.
- Do final repo-wide string sweep for legacy identifiers.

Final must-be-zero list:
- removed planner table aliases
- removed planner flag/version field aliases
- legacy hierarchy runtime references
- execution module references

Deliverables:
- Final cleanup commit with before/after summary.

Exit criteria:
- Zero runtime references to removed concepts.
- Docs and code in sync.

## 7) Original Phases (Historical Sequence)

## Phase 0 - Baseline, Freeze, and Observability
Objective:
- Lock in current behavior so rewrite does not silently regress.

Tasks:
- Capture baseline fixtures (subjects/topics/params/config) and expected outputs.
- Tag current planner flows as "baseline v1" in docs.
- Add temporary comparison harness to evaluate v1 vs v2 outputs.

Deliverables:
- Baseline test fixture pack.
- Behavior checklist (what must remain true after rewrite).

Exit criteria:
- We can run baseline tests repeatedly and get stable expected outputs.

---

## Phase 1 - Database v2 Design
Objective:
- Produce a clean schema blueprint aligned with agreed decisions.

Tasks:
- Define final table set and remove execution tables from v2 design.
- Remove legacy hierarchy fields and constraints.
- Keep JSON-only snapshot model.
- Tighten grants and RLS policies.
- Replace risky RPC patterns with trusted auth-based ownership checks.

Deliverables:
- `schema-v2.sql` (design draft).
- `db-v2-data-map.md` (old -> new field mapping).
- `db-v2-security-checklist.md`.

Exit criteria:
- Schema reviewed and approved.
- Every existing required data field has a migration mapping.
- Security checklist has no unresolved critical items.

---

## Phase 2 - Migration Strategy and Dry Run
Objective:
- Migrate data safely with verifiable integrity.

Tasks:
- Create migration scripts: precheck, transform, postcheck.
- Run migration on local copy/snapshot of production-like data.
- Validate counts, key relations, and planner-critical records.

Deliverables:
- `migrate-v1-to-v2.sql`.
- `validate-v2-migration.sql`.
- Rollback instructions.

Exit criteria:
- Dry run passes with 0 critical data loss.
- Validation report signed off.

---

## Phase 3 - Planner Engine v2 Rewrite
Objective:
- Rebuild scheduling core into small, predictable modules.

Design rules:
- Keep orchestrator small and readable.
- Use pure functions for calculations.
- Keep side effects out of core scheduling logic.
- Keep comments plain-language and edit-focused.

Proposed module split:
- `engine-v2/core.ts` (orchestrator).
- `engine-v2/normalize.ts` (input normalization/defaulting).
- `engine-v2/capacity.ts` (day capacity rules).
- `engine-v2/scheduler.ts` (session placement algorithm).
- `engine-v2/validation.ts` (pre/post checks).

Tasks:
- Define engine input/output contracts.
- Implement deterministic scheduling behavior.
- Add clear inline comments for manual tune points.

Deliverables:
- Engine v2 modules.
- `engine-v2-contract.md`.
- `engine-v2-tuning-guide.md` for simple manual edits.

Exit criteria:
- Engine tests pass.
- Baseline comparisons within accepted variance.
- No unresolved high-severity scheduling bugs.

---

## Phase 4 - Actions and Persistence Layer Rewrite
Objective:
- Simplify server actions and isolate DB calls.

Tasks:
- Replace mixed logic actions with thin validated handlers.
- Centralize planner persistence logic in one service module.
- Keep telemetry as optional wrapper (non-blocking).

Deliverables:
- New planner action flow with clear boundaries.
- `planner-action-contracts.md`.

Exit criteria:
- Actions pass integration tests.
- No direct schema leaks from UI to DB write layer.

---

## Phase 5 - Integration, Dual-Run, and Cutover
Objective:
- Safely switch production write/read paths to v2.

Tasks:
- Run shadow mode (v1 output compared to v2 for same input).
- Resolve deviations using explicit rules.
- Execute staged cutover by feature flag.

Deliverables:
- Cutover checklist.
- Feature flag rollout plan.

Exit criteria:
- Stable shadow run window completed.
- Cutover approved with rollback ready.

---

## Phase 6 - Hardening and Cleanup
Objective:
- Remove legacy codepaths and finalize docs.

Tasks:
- Remove v1 dead code and legacy schema artifacts.
- Finalize operational runbook.
- Finalize non-technical maintainer docs.

Deliverables:
- Clean codebase with v2 as single source of truth.
- `maintenance-quick-edits.md`.

Exit criteria:
- No active references to removed legacy modules.
- Documentation complete and reviewed.

## 8) Documentation Standards (For Non-Technical Editing)
Every new core file must include:
- "What this file does" at top.
- "Safe edits" section (what can be changed manually).
- "Do not edit unless" section for risky areas.
- Examples using real values.

Comment style requirements:
- Use short plain English comments.
- Explain intent, not syntax.
- Mark tuning constants clearly, for example: `// TUNING: change default session length`.

## 9) Quality Gates per Phase
Minimum checks before moving forward:
- Unit tests for pure logic.
- Integration tests for actions + DB.
- Data migration validation checks.
- Security checks (RLS + grants + ownership enforcement).

Release block conditions:
- Any failing migration validation.
- Any cross-user data leak risk.
- Any critical regression in planning behavior.

## 10) Risk Register and Mitigation
Risk: Hidden behavior regressions.
Mitigation: baseline fixtures + shadow comparisons + staged rollout.

Risk: Data loss during migration.
Mitigation: dry runs, backups, row-count/hash validation, rollback plan.

Risk: Over-simplification breaks edge cases.
Mitigation: preserve parity first, optimize second.

Risk: Security gaps in RPC/actions.
Mitigation: least privilege grants, auth.uid ownership checks, security review gate.

## 11) Suggested Execution Order (Updated)
1. Execute Phase 6.1 contract lock.
2. Execute Phase 6.2 action hardening.
3. Execute Phase 6.3 edge-case test coverage.
4. Execute Phase 6.4 final residual cleanup.
5. Run final gate: schema-sync + tests + docs consistency signoff.

## 12) Immediate Next Step
Next step after this update:
- Start the next program phase (post-cleanup) with confidence gates already green.

## 13) Quick Progress (Short)
Done so far:
- DB v2 cutover completed and runtime code aligned to DB v2 contract.
- Legacy concepts removed from active runtime paths: old hierarchy and deprecated execution schema fields.
- Planner/task contract standardized (`task_source = manual | plan`, `plan_snapshot_id`, `settings_snapshot`).
- Phase 6 completed (6.1 to 6.4): contract lock, hardening, edge-case test updates, final residual cleanup.
- Automated contract guard added (`tests/contracts/dbV2ContractGuard.test.ts`) and wired into CI.
- Commit flow hardening added in planner action: keep-mode normalization + session payload validation/sanitization before RPC.
- Commit behavior-invariant tests expanded (invalid payload rejection and runtime normalization cases).
- Planner repository layer completed for planner action DB access (`lib/planner/repository.ts`), including generate, reoptimize, history, commit, and reschedule paths.
- Planning transformation logic extracted into pure modules (`lib/planner/planTransforms.ts`) for unit mapping, title resolution, and dropped-reason analysis.
- Dedicated transform unit tests added (`tests/planner/planTransforms.test.ts`).
- Quality gates are green: typecheck, lint, contract guard, tests, build.

Left to do:
- None for rewrite scope. Remaining work is normal maintenance/new feature development.
