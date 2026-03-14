# Locked Implementation Plan: Strict Commit + Issue Resolution Modal

Date locked: 2026-03-14
Owner: Product + Engineering
Status: Approved for implementation planning baseline

## 1) Objective

Build a small, modern issue-resolution modal that appears as soon as blocking planner problems are detected (generate or commit path), lists problems in a numbered format, shows plain-language fixes, supports inline editing and section jump links, and blocks commit only when critical issues remain.

Core trust rule:
- No incomplete plan commit.
- No partial commit mode.
- User stays in guided issue-resolution flow until critical issues are resolved.

## 2) Locked Decisions From Discussion

These are fixed unless explicitly changed by product owner.

1. Commit button lock behavior:
- Locked only for critical issues.

2. Partial planning option:
- Removed completely.

3. Trigger timing for issue modal:
- Show whichever comes first: generate checkpoint or commit checkpoint.

4. Fix controls in modal:
- Both inline edit controls and jump-to-section actions.

5. Rest-after semantics:
- A topic is considered started after its first scheduled session.
- Do not start a new topic in the same subject until rest_after_days passes.
- Already-started topics in the same subject can continue scheduling.
- Same behavior for all plan types.

6. Study frequency:
- Keep only daily and spaced.
- Remove dense.
- Spaced must be clearly explained to users.

7. Ordering preference:
- Use urgency mix (deadline pressure + remaining work).
- Subject order and topic order remain important constraints/tie-breakers.

8. Min gap between same subject days:
- Auto-managed internally.
- Remove from user controls.

9. Max subjects per day:
- Keep as visible user control.

10. Flexible unlock threshold:
- Managed internally in 60% to 80% range based on workload pressure.

11. Flexibility on zero-capacity days:
- Never allowed on days marked as 0 capacity.

12. Quick start:
- Remove from product flow.

13. Priority feature:
- Remove fully.

14. Tier feature:
- Remove fully.

15. Modal shape and size:
- Center modal popup.
- Roughly 60% to 70% of normal page width/height footprint.

16. Product trust rule:
- First-use experience must not be messy, chaotic, or overloaded.

## 3) Scope

### In scope

- New Plan Issue Resolution Modal (small center popup).
- New issue detection pipeline that classifies issues into critical and warning.
- Strict commit gate for critical issues only.
- Inline edit controls in modal for contested values.
- Jump links from modal to relevant planner sections.
- Removal of partial-commit behavior.
- Removal of priority and tier user features.
- Removal of quick start entry and backend flow.
- Rest-after semantic update.
- Study frequency simplification to daily and spaced.
- Internalized min-subject-gap behavior.
- Internalized adaptive unlock threshold (60 to 80).

### Out of scope for first implementation

- Full visual redesign of all planner pages.
- Large schema deletion migration for deprecated columns in first release.
- New separate route/page for issue handling (must stay modal-based).

## 4) Product Behavior Contract

### 4.1 Checkpoint model

Two checkpoints run Plan Guard:
1. Generate checkpoint.
2. Commit checkpoint.

Rule:
- If critical issues exist at either checkpoint, open modal immediately and block commit.
- If no critical issues and only warnings exist, allow commit and keep warnings visible.

### 4.2 Critical vs warning definitions

Critical issue:
- Prevents building a full valid schedule.
- Must be resolved before commit.

Warning issue:
- Quality or comfort risk, but full schedule still complete.
- Does not block commit.

### 4.3 Commit gate

Commit enabled only when:
- Total expected sessions == scheduled sessions.
- No critical issue remains unresolved.
- No invalid constraint state exists.

## 5) Modal UX Plan (Mini Interface)

### 5.1 Size and placement

- Centered modal overlay.
- Width target: 60% to 70% of planner page width.
- Max width guard for desktop and responsive fallback for mobile.
- Keep compact height with internal scrolling for issue list.

### 5.2 Layout

1. Header:
- Title: Resolve Plan Issues
- Summary chips: Critical count, Warning count, Completion progress.

2. Numbered issue list:
- Each issue rendered as card with number.
- Severity badge.
- Plain-language explanation.
- Contested values snapshot.

3. Per-issue actions:
- Suggested quick-fix buttons.
- Inline editable fields.
- Jump to section button (Phase 2 or Phase 3 or Preview).

4. Footer:
- Re-check plan button.
- Continue/Commit button disabled when critical issues remain.
- Small helper text explaining why commit is blocked.

### 5.3 UX language standards

- No technical jargon.
- One-line issue title + one-line impact + fix options.
- Keep text short and decision-focused.

### 5.4 Accessibility

- Keyboard focus trap in modal.
- Escape key close only when no blocking critical issue OR close returns to blocked state with clear message.
- Screen-reader labels on issue controls.

## 6) Issue Engine Plan (Plan Guard)

Create a centralized issue detector that runs after data collection and after schedule simulation.

### 6.1 Pipeline

1. Validate raw config and topic params.
2. Run feasibility analysis.
3. Run scheduling simulation.
4. Run post-schedule integrity checks.
5. Emit IssueList with severity, options, fix suggestions, and affected fields.

### 6.2 Standard issue object

Each issue must include:
- issueId
- severity: critical or warning
- title
- userMessage
- rootCauseValues
- options: list of issue-specific selectable actions
- inlineEdits: editable fields with constraints
- jumpTarget: planner phase/section
- resolverHint: deterministic guidance text

## 7) Initial Issue Catalog (With Independent Options)

Each issue gets its own options set. No global generic options only.

### C1: No usable study days (critical)

Trigger:
- No day slots exist after applying date window and 0-capacity/off-day rules.

Options:
1. Move exam date later (inline date).
2. Increase day capacity defaults (inline minutes).
3. Add custom positive capacity to specific dates.

### C2: Unscheduled sessions remain (critical)

Trigger:
- expectedSessions > scheduledSessions.

Options:
1. Increase weekday minutes.
2. Increase weekend minutes.
3. Increase max subjects per day.
4. Reduce rest_after_days for affected subject/topic.
5. Change affected topic from spaced to daily.
6. Extend exam date by suggested days.

### C3: Topic deadline violation risk (critical)

Trigger:
- Topic cannot fit inside its own deadline window under strict policy.

Options:
1. Extend that topic deadline.
2. Decrease session length for that topic.
3. Increase available minutes in topic date window.

### C4: Session length exceeds any allowed day capacity (critical)

Trigger:
- session_length_minutes > max attainable day capacity for all eligible days.

Options:
1. Reduce session length.
2. Increase max daily capacity.
3. Increase date-specific capacity on eligible days.

### C5: Dependency cycle (critical)

Trigger:
- Graph cycle detected.

Options:
1. Remove dependency edge A -> B.
2. Remove dependency edge B -> C.
3. Jump to dependency editor.

### C6: Rest-after prevents first start of next topic in time (critical)

Trigger:
- New topic start blocked by rest_after window and no valid remaining dates.

Options:
1. Reduce rest_after_days.
2. Extend deadline for blocked topic.
3. Increase available capacity before deadline.

### C7: Spaced mode cannot satisfy full fit (critical)

Trigger:
- Spaced constraint causes unscheduled sessions.

Options:
1. Switch topic to daily.
2. Extend deadline.
3. Increase day capacity.

### W1: High flexibility usage concentration (warning)

Trigger:
- Plan fits, but heavy flex usage on many days.

Options:
1. Increase baseline capacity.
2. Add custom overrides to peak days.

### W2: High daily load volatility (warning)

Trigger:
- Large spread between lightest and busiest day.

Options:
1. Raise max subjects/day.
2. Slightly relax spacing for affected topics.

## 8) Algorithm and Math Changes

### 8.1 Remove priority and tier from planning logic

- Priority removed from UI and scheduler ranking.
- Tier removed from UI and scheduler unlock model.
- Update all ranking and issue text to avoid priority/tier vocabulary.

### 8.2 Ordering model after priority/tier removal

Primary ordering:
- Urgency mix based on remaining sessions and time to deadline.

Tie-breakers and constraints:
1. Dependency validity and topic order constraints inside a subject.
2. Subject order (stable tie-break).
3. Topic order within subject.

### 8.3 Rest-after revised implementation contract

Current target behavior:
- rest_after applies only to opening a new topic in same subject.
- Existing started topics in same subject are allowed to continue.
- Topic is started after first scheduled session.

### 8.4 Study frequency contract

Daily:
- Can schedule on any eligible day.

Spaced:
- Must keep at least one full day gap between sessions of the same topic.
- Example message in UI: If you study this topic on Monday, earliest next session is Wednesday.

### 8.5 Adaptive flexible unlock threshold

Global internal threshold (not user-exposed):
- High pressure: 60%
- Medium pressure: 70%
- Low pressure: 80%

Pressure input can use plan load ratio:
- loadRatio = totalNeededMinutes / totalBaseAvailableMinutes

Suggested mapping:
- loadRatio > 0.90 -> 60%
- 0.75 < loadRatio <= 0.90 -> 70%
- loadRatio <= 0.75 -> 80%

### 8.6 Zero-capacity day hard rule

- Flex extension is never applied on user-marked 0-capacity days.
- Day remains fully blocked.

### 8.7 Min subject gap internalization

- Remove user control.
- Keep internal auto-management policy (heuristic) to reduce context switching without blocking fit.

## 9) Simplification Plan for First-Use UX

To reduce overwhelm and keep clarity:

Remove from user-facing controls:
- Priority
- Tier
- Dense frequency
- Min subject gap control
- Complex ordering stack controls

Keep visible controls:
- Subject/topic structure and order
- Estimated effort
- Session length
- Deadline
- Daily or spaced frequency
- Rest-after
- Max subjects per day
- Weekday/weekend capacity
- Day-of-week overrides
- Date-specific overrides

## 10) Quick Start Removal Plan

- Remove quick start entry points from onboarding and planner surfaces.
- Disable backend action path for quick start plan generation.
- Keep strict full-plan path as only commit flow.

## 11) Data and Migration Plan

### 11.1 Release 1 (safe deprecation)

- Stop reading/writing these fields in runtime behavior:
  - priority
  - tier
  - buffer_percentage
  - dense frequency

- Keep columns temporarily for backward compatibility.
- Add migration notes and telemetry for deprecated-field usage.

### 11.2 Release 2 (schema cleanup)

- Remove unused columns after one stable release cycle.
- Backfill defaults and remove stale UI references.

## 12) Implementation Workstreams

### WS-A: Plan Guard and Issue API

Deliverables:
- Shared issue detector service.
- Unified issue list contract.
- Generate and commit checkpoint integration.

### WS-B: Modal UI

Deliverables:
- Center popup issue modal (60% to 70% footprint).
- Numbered issue cards.
- Inline fix controls.
- Jump links to sections.
- Commit lock messaging.

### WS-C: Scheduler and feasibility alignment

Deliverables:
- Strict full-fit contract.
- Rest-after semantic update.
- Spaced behavior enforcement and issue reporting.
- Adaptive threshold internal logic.

### WS-D: Feature removal and simplification

Deliverables:
- Remove priority/tier from UI and logic.
- Remove quick start flow.
- Remove dense mode.
- Internalize min subject gap.

## 13) Test Plan

### Unit tests

1. Issue detector emits correct severity and options per issue type.
2. Rest-after new-start rule (started topics continue).
3. Spaced definition enforcement.
4. Adaptive threshold mapping 60/70/80 by load ratio.
5. Zero-capacity day never uses flex.

### Integration tests

1. Generate path opens modal on critical issues.
2. Commit path re-check opens modal if new critical issues exist.
3. Inline modal edits update plan draft and re-check status.
4. Jump links focus correct phase section.
5. Commit stays blocked while critical count > 0.

### Regression tests

1. No partial plan commit path exists.
2. No quick start entry path exists.
3. Priority and tier controls absent from planner UI.

## 14) Acceptance Criteria

A release is accepted only when all are true:

1. Commit is blocked only for critical issues.
2. Partial commit option is absent.
3. Critical issues show numbered cards with issue-specific options.
4. Users can fix from modal inline and via jump links.
5. No commit allowed while unscheduled sessions remain.
6. Spaced is clearly defined in UI text and respected in scheduling.
7. Rest-after behaves per locked semantics.
8. Flex never applies on 0-capacity days.
9. Priority, tier, and quick start are removed from user flow.
10. Modal remains compact, centered, and non-chaotic.

## 15) Risk Log and Mitigation

Risk 1:
- Removing priority may change existing schedule expectations.
Mitigation:
- Add migration notice and release notes with before/after behavior.

Risk 2:
- Strict full-fit gate may increase initial friction.
Mitigation:
- Strong issue explanations and one-click fixes in modal.

Risk 3:
- Legacy fields still present can cause drift.
Mitigation:
- Runtime deprecation guards and telemetry.

## 16) Phase Breakdown (Execution Plan)

### Phase 1 - Plan Guard Foundation

Goals:
- Introduce a shared issue model (critical/warning).
- Build issue computation from feasibility + sessions + constraints.
- Add strict critical detection utility for commit gating.

Status:
- Implemented in this session.

### Phase 2 - Mini Issue Modal UI

Goals:
- Add centered mini modal (60 to 70 percent footprint).
- Render numbered issue cards with severity and fix text.
- Show issue-specific options and contested values.

Status:
- Implemented in this session.

### Phase 3 - Flow Integration and Strict Commit Lock

Goals:
- Trigger issue window at generate/continue/commit checkpoints.
- Block commit when critical issues exist.
- Add inline edits + jump actions from modal.
- Add re-check action from modal.

Status:
- Implemented in this session.

### Phase 4 - Algorithm Alignment Updates

Goals:
- Update rest_after semantics to "block new topic start only".
- Remove dense frequency and keep daily/spaced with explicit definition.
- Internalize adaptive flexible unlock threshold (60/70/80).
- Remove min subject gap user control (auto-manage).

Status:
- Completed.

### Phase 5 - Feature Simplification Cleanup

Goals:
- Remove priority from UI and scheduling logic.
- Remove tier from UI and scheduling logic.
- Remove quick start flow from product path.
- Remove buffer_percentage runtime usage.

Status:
- Completed.

### Phase 6 - Test Expansion and Regression Hardening

Goals:
- Add targeted tests for issue detector and modal gating.
- Add tests for strict full-fit commit lock.
- Add tests for new algorithm semantics from Phase 4 and Phase 5.

Status:
- Completed.

### Phase 7 - Release Hardening

Goals:
- End-to-end UX pass.
- Accessibility and copy pass for issue window.
- Final release checklist.

Status:
- Completed.

## 17) Implementation Progress Log (Session Context)

Last updated: 2026-03-14

Completed this session:

1. Added shared issue engine:
- File: lib/planner/planIssues.ts
- Includes:
  - PlanIssue types and severity model.
  - Critical/warning issue builder from feasibility/sessions/constraints.
  - Issue-specific options and inline editable field metadata.
  - hasCriticalIssues helper.

2. Added mini issue modal component:
- File: app/(dashboard)/planner/components/PlanIssueModal.tsx
- Includes:
  - Centered popup UI with numbered issue list.
  - Severity badges and contested values display.
  - Inline edits for constraints.
  - Per-issue action buttons.
  - Re-check and close controls.

3. Integrated modal + issue flow in planner page:
- File: app/(dashboard)/planner/page.tsx
- Includes:
  - Planner issue state and recomputation helpers.
  - Modal open triggers for generate, continue, and commit checkpoints.
  - Action handling for jump, numeric delta, and date delta options.
  - Re-check pipeline from modal.
  - Strict critical blocker behavior before entering commit and before commit call.

4. Updated commit phase UX for lock state:
- File: app/(dashboard)/planner/components/PlanConfirm.tsx
- Includes:
  - Commit blocked banner with reason.
  - "Open Issue Window" action.
  - Commit button disabled when critical issues exist.

Validation completed this session:
- npm run typecheck: passed.
- Targeted tests passed:
  - tests/planner/analyzePlan.test.ts
  - tests/planner/scheduler.test.ts
  - tests/actions/commitPlan.test.ts

Completed in continuation (remaining phases):

5. Algorithm alignment updates (Phase 4):
- Scheduler now applies rest-after only when opening a new topic.
- Study frequency behavior reduced to daily/spaced (legacy dense treated as daily compatibility input).
- Flexible-sequential unlock threshold is internalized and adaptive (60/70/80 by load ratio).
- User-facing min-subject-gap control removed; internal gap heuristic retained.

6. Feature simplification cleanup (Phase 5):
- Priority and tier removed from active planner UX and ranking behavior.
- Runtime paths normalize persisted values to compatibility defaults (priority neutral, tier neutral).
- Quick-start entry path removed from onboarding and backend action removed.
- Buffer percentage no longer reduces runtime capacity in feasibility.

7. Test expansion and regression hardening (Phase 6):
- Added/updated scheduler tests for:
  - Rest-after new-start-only continuation behavior.
  - Adaptive flexible threshold behavior across load bands.
  - Legacy dense/tier compatibility handling.
  - Priority criterion compatibility no-op behavior.

8. Release hardening (Phase 7):
- Full validation pass completed:
  - npm run typecheck: passed
  - npm run lint: passed
  - npm run test: passed (94/94)
  - npm run build: passed
- Planner lock/issue flow remains green with the simplified engine behavior.

## 18) Next Implementation Start Point

All locked phases are completed.

Recommended next session scope (optional):

1. Monitor planner telemetry for friction introduced by stricter simplification defaults.
2. Plan a separate schema-cleanup release for deprecated compatibility columns after stabilization.
