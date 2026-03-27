# Planner Engine Input Specification (Phase 1 -> Phase 3)

This document captures every user-provided (or user-controlled) input used by the planner wizard flow, with implementation-aligned defaults, validation rules, and backend usage.

Scope source:
- `app/(dashboard)/planner/PlannerWizardClient.tsx`
- `app/(dashboard)/planner/subjects-data-table.tsx`
- `app/(dashboard)/planner/components/PlanPreview.tsx`
- `app/(dashboard)/planner/components/PlanConfirm.tsx`
- `app/actions/planner/setup.ts`
- `app/actions/planner/plan.ts`
- `lib/planner/draft.ts`
- `lib/planner/engine.ts`

Planner phases:
1. Phase 1: Intake
2. Phase 2: Preview
3. Phase 3: Confirm + Commit

---

## Phase 1: Intake

Phase 1 is split in UI into Step-1 and Step-2.

- Step-1 captures workload structure and chapter-level metadata.
- Step-2 captures global scheduling constraints, day-level overrides, and off-days.

### Phase 1, Step-1: Workload Structure Intake

#### 1) Subject-level information

1. `subject.name` (required)
- What user provides: Subject name.
- Purpose: Defines the top-level grouping for planning and final schedule labels/order.
- Backend use: Persisted to `subjects.name`; used for plan grouping and display.

2. `subject.deadline` (optional, date)
- What user provides: Optional subject deadline.
- Purpose: Acts as a subject-wide fallback deadline for chapters/topics when chapter-level deadline is absent.
- Backend use: Persisted to `subjects.deadline`; used in plan generation fallback chain.

3. Subject ordering (drag-drop reorder)
- What user provides: Relative order of subjects.
- Purpose: Controls subject sequence priority context and deterministic ordering.
- Backend use: Persisted to `subjects.sort_order` via `reorderSubjects` action.

4. Subject archive state (toggle)
- What user provides: Archive/restore decision.
- Purpose: Excludes archived subjects from active planning without deleting all history immediately.
- Backend use: Persisted to `subjects.archived`; active planning filters archived subjects out.

Summary: Subject inputs define planning scope boundaries and high-level deadline context. They directly affect which units are included and how fallback deadlines are resolved.

#### 2) Chapter-level information (chapter == topic in DB)

1. `chapter.name` (required)
- What user provides: Chapter name under a subject.
- Purpose: Defines plannable unit identity (topic_name in engine).
- Backend use: Persisted to `topics.name`.

2. `chapter.earliest_start` (optional, date)
- What user provides: Earliest allowed start date for this chapter.
- Purpose: Prevents scheduling before allowed start window.
- Backend use: Persisted through `topic_params.earliest_start` and used by scheduler feasibility/window checks.

3. `chapter.deadline` (optional, date)
- What user provides: Chapter-level deadline.
- Purpose: Hard upper bound for scheduling this chapter; overrides subject fallback.
- Backend use: Persisted through `topic_params.deadline`; validated against subject deadline.

4. `chapter.rest_after_days` (optional non-negative integer)
- What user provides: Rest gap after scheduling chapter sessions.
- Purpose: Adds spacing pressure and reduces overly dense recurrence.
- Backend use: Persisted to `topic_params.rest_after_days`; used by engine for spacing constraints.

5. Chapter ordering (drag-drop reorder)
- What user provides: Relative order of chapters within subject.
- Purpose: Stable deterministic order and subject-specific sequencing signal.
- Backend use: Persisted to `topics.sort_order`.

6. Chapter archive state (toggle)
- What user provides: Archive/restore chapter.
- Purpose: Temporarily remove chapter from planning.
- Backend use: Persisted to `topics.archived`; filtered out from active topics.

Summary: Chapter inputs define each schedulable unit's allowed window and structure-level position. This is core for feasibility and ordering behavior.

#### 3) Cluster-level information (cluster == subtopic in DB)

1. `cluster.name`
- What user provides: Optional cluster names under chapter.
- Purpose: Organizational grouping for tasks inside chapter.
- Backend use: Persisted to `subtopics.name`; helps workload organization and task assignment.

2. Cluster assignment for tasks
- What user provides: Assign selected tasks to a cluster/unclustered.
- Purpose: Keeps chapter task organization maintainable at scale.
- Backend use: Persisted through task `subtopic_id` updates.

Summary: Cluster data is organizational and does not directly alter scheduling math, but it shapes chapter task hygiene and maintainability.

#### 4) Task-level information (raw workload signal)

1. `task.title` (required)
- What user provides: Atomic work item label.
- Purpose: Human-readable source of study workload and final session title mapping.
- Backend use: Persisted to `tasks.title`; used to synthesize generated session titles.

2. `task.duration_minutes` (required, bounded)
- What user provides: Duration per task.
- Purpose: Primary workload quantity signal; planner derives chapter effort from sum of task minutes.
- Backend use: Persisted to `tasks.duration_minutes`; aggregated into estimated effort for planning.
- Constraints: bounded to `MIN_SESSION_LENGTH_MINUTES..MAX_SESSION_LENGTH_MINUTES` in intake edits.

3. `task.completed` toggle
- What user provides: Mark done/undone.
- Purpose: Controls undone-only imports and remaining workload behavior.
- Backend use: Persisted in `tasks.completed`; import mode may use only undone tasks.

4. Task order (drag-drop reorder)
- What user provides: Relative task sequence.
- Purpose: Stable deterministic ordering and better source-title mapping.
- Backend use: Persisted via `reorderTasks`.

5. Bulk task generation parameters (single or series)
- What user provides: Base name, count, start number, padding, placement, separator.
- Purpose: Fast creation of many structured tasks with predictable names.
- Backend use: Creates multiple `tasks` rows; contributes to chapter effort totals.

Summary: Task durations are the strongest practical signal in intake because chapter estimated effort is auto-derived from these minutes when explicit param is absent.

#### 5) Dependency information (chapter prerequisites)

1. `depends_on` chapter IDs (multi-select)
- What user provides: Selected prerequisite chapters for a target chapter.
- Purpose: Enforces dependency ordering so downstream chapter sessions do not schedule before prerequisites.
- Backend use: Persisted to `topic_params.depends_on`.

2. Dependency target scope
- What user provides: Set dependencies from subject-level picker or chapter-level picker.
- Purpose: UX convenience for editing prerequisite graph.
- Backend use: Same persisted graph in `topic_params.depends_on`.

3. Derived fields saved together with dependencies (if missing)
- System derives while saving dependencies:
  - `estimated_hours` from chapter task minutes (rounded, minimum fallback 1)
  - `deadline`, `earliest_start`, `rest_after_days`, `session_length_minutes`, `max_sessions_per_day`, `study_frequency`
- Purpose: Ensure a complete `topic_params` row exists for dependency target.

Validation during save:
- Dependencies cannot include self.
- Dependencies must reference known current topics.
- Dependency cycles are rejected (`findDependencyCycle`).

Summary: Dependency data defines the DAG constraints for scheduling order. This is critical to avoid invalid plans and impossible sequencing.

#### 6) Intake structure import controls

1. Import mode: `Import All` vs `Import Undone Only`
- What user provides: Chooses snapshot mode.
- Purpose: Decide whether intake should include all plan-source tasks or only remaining undone workload.
- Backend use: Calls `getStructure` with flags (`onlyUndoneTasks`, `dropTopicsWithoutTasks`).

2. Reload saved intake data
- What user provides: Explicit reset/reload action.
- Purpose: Rehydrate UI from persisted backend truth.
- Backend use: Re-fetches structure, topic params, constraints, off-days.

Summary: These controls are not planning constraints themselves, but they define which persisted workload snapshot becomes the active Phase-1 basis.

---

### Phase 1, Step-2: Global Constraint Intake

#### Block-1: Dates, capacities, day overrides, calendar actions

1. `study_start_date` (required)
- What user provides: Planning start date.
- Purpose: Lower bound of scheduling window.
- Backend use: `plan_config.study_start_date`; used by slot generation.

2. `exam_date` (required)
- What user provides: Final global deadline date.
- Purpose: Upper bound of scheduling window (before revision-day subtraction in engine).
- Backend use: `plan_config.exam_date`.

Validation:
- Must satisfy `study_start_date < exam_date`.

3. `weekday_capacity_minutes` (non-negative)
- What user provides: Default weekday available minutes.
- Purpose: Baseline daily capacity for Mon-Fri if no override exists.
- Backend use: `plan_config.weekday_capacity_minutes`.

4. `weekend_capacity_minutes` (non-negative)
- What user provides: Default weekend available minutes.
- Purpose: Baseline daily capacity for Sat/Sun if no override exists.
- Backend use: `plan_config.weekend_capacity_minutes`.

5. `max_daily_minutes` (clamped 30..720)
- What user provides: Hard cap for daily scheduled minutes.
- Purpose: Prevents overload even if defaults/overrides are higher.
- Backend use: `plan_config.max_daily_minutes`; applied in slot builder.

6. `day_of_week_capacity[0..6]` (nullable minutes)
- What user provides: Optional per-weekday override for Sun..Sat.
- Purpose: Replace weekday/weekend defaults by day index.
- Backend use: `plan_config.day_of_week_capacity`; blank means fall back.

7. `custom_day_capacity[date] = minutes`
- What user provides: Date-specific capacity overrides via calendar selection.
- Purpose: Precise exceptions (holidays, special availability, etc.).
- Backend use: `plan_config.custom_day_capacity`; highest precedence in slot building.

8. Off-day list: `off_days[]` with optional `reason`
- What user provides: Dates that should be excluded from planning.
- Purpose: Hard remove days from available slots.
- Backend use: persisted in `off_days` table; consumed in plan generation/scheduling.

Summary: Block-1 defines the calendar window and minute budget model. It determines whether enough slots exist before the planner even orders sessions.

#### Block-2: Flexibility and focus constraints

1. `flexibility_minutes` (0..120 in UI, non-negative persisted)
- What user provides: Daily overflow allowance over base capacity.
- Purpose: Adds optional flex headroom to recover near-overload plans.
- Backend use: `plan_config.flexibility_minutes`; affects `flexCapacity`.

2. `max_active_subjects` (0..12 in UI, non-negative persisted)
- What user provides: Cap on concurrent subjects per day (`0` means no cap).
- Purpose: Limits context switching and controls cognitive spread.
- Backend use: `plan_config.max_active_subjects`; used by scheduler ranking/filtering logic.

3. Save Step-2 constraints action
- What user provides: Explicit save command.
- Purpose: Persists current constraint draft before preview generation.
- Backend use: `savePlanConfig` upsert into `plan_config`.

Summary: Block-2 tunes how tightly/loosely the plan can be packed and how broad each day can be across subjects.

---

### Phase 1 Data Normalization, Defaults, and Derived Inputs

These values are part of what planner uses after intake, even when not manually edited in Step-2 UI:

1. Derived chapter estimated effort (`topic_params.estimated_hours`)
- Source: sum of chapter task durations, converted minutes -> hours (rounded), fallback minimum.
- Purpose: canonical effort value expected by planner topic params model.

2. Default chapter planning params (if not explicitly set)
- `priority = 3`
- `session_length_minutes = 60`
- `rest_after_days = 0`
- `max_sessions_per_day = 0`
- `study_frequency = daily`
- `tier = 0`
- Purpose: stable planner behavior without requiring user to tune every chapter.

3. Default global planning params if config missing
- `plan_order = balanced`
- `final_revision_days = 0`
- `buffer_percentage = 0`
- `plan_order_stack = [urgency, subject_order, deadline]`
- `max_topics_per_subject_per_day = 1`
- `min_subject_gap_days = 0`
- `subject_ordering = {}`
- `flexible_threshold = {}`
- Purpose: preserve deterministic engine contract while keeping intake UX minimal.

Summary: Intake combines explicit user fields and deterministic derived defaults to produce a complete planner input payload.

---

## Phase 2: Preview

Phase 2 does not collect broad profile-like setup fields. It captures tactical plan edits and optimization intent.

### 1) Session-level manual adjustments

1. Move session to another date (drag/drop)
- User action: drag a generated session onto a different day.
- Stored in preview state: changes `scheduled_date`; marks session `is_pinned = true`.
- Purpose: lock important placements before re-optimization.

2. Pin/unpin generated sessions
- User action: toggle `pin` on a non-manual session.
- Stored in preview state: `is_pinned` boolean.
- Purpose: tells re-optimizer what must remain fixed.

3. Swap two sessions
- User action: select swap source then target.
- Stored in preview state: both sessions change dates, both pinned.
- Purpose: fast balancing without full regenerate.

4. Remove session from preview
- User action: remove a session card.
- Stored in preview state only.
- Purpose: manual pruning before commit.

Summary: These inputs let users convert auto-generated schedule into an intent-aware draft by explicitly fixing or altering placements.

### 2) Manual session insertion

When adding manual session in a day:

1. `date`
- User provides: target day.
- Purpose: explicit placement.

2. `subjectId`
- User provides: subject selection.
- Purpose: ownership and grouping in schedule.

3. `topicId`
- User provides: topic selection.
- Purpose: ties manual session into topic tracking context.

4. `durationMinutes` (min 15 in UI)
- User provides: time for manual block.
- Purpose: reserve real capacity in that day.

5. `note` (optional)
- User provides: label suffix.
- Purpose: human meaning for custom entry.

Resulting preview session flags:
- `is_manual = true`
- `is_pinned = true`

Summary: Manual sessions are hard user commitments inserted into the schedule and preserved during re-optimization.

### 3) Re-optimization intent

1. `reservedSessions` payload to re-optimizer
- User action: click `Re-optimize Free Sessions`.
- Payload content: all pinned + manual sessions.
- Purpose: rebuild only free/non-reserved portion around user-fixed constraints.

2. Continue to Phase 3 action
- User action: `Continue to Confirm`.
- Gate: blocked in parent when critical issues remain.
- Purpose: marks preview as accepted draft for commit decision.

Summary: Phase 2 records user intent around what is non-negotiable and asks the planner to adapt remaining schedule accordingly.

---

## Phase 3: Confirm + Commit

Phase 3 captures final commit policy and optional snapshot labeling.

### 1) Previous-plan handling mode (`keepMode`)

User selects one of:
1. `until` - keep previous tasks until new plan start date.
2. `future` - replace future generated tasks (default).
3. `merge` - keep previous and add new plan tasks.
4. `none` - delete all previous generated tasks.

Purpose:
- Defines how existing generated tasks are reconciled with the new plan version.

Backend use:
- Sent to `commitPlan(..., keepMode, ...)` and forwarded to `commit_plan_atomic` RPC as `p_keep_mode`.

Summary: `keepMode` is the core business decision for version transition strategy in commit.

### 2) Snapshot summary (`summary`, optional)

1. `summary` text (optional, max 120 chars in UI)
- User provides: custom label for this commit.
- Purpose: plan history readability and future comparison context.
- Backend use: passed to RPC as `p_snapshot_summary` (fallback auto text if empty).

Summary: Summary is metadata for history/audit clarity, not scheduling behavior.

### 3) Commit trigger

1. Commit button action
- User action: confirms commit.
- Preconditions: non-empty sessions and no critical blockers.
- Backend use: sends final preview `sessions[]`, selected `keepMode`, and `summary`.

2. New plan start date derivation (from sessions)
- Not user-entered directly; computed from earliest session date in committed schedule.
- Purpose: needed by `until` semantics and plan replacement logic.

Summary: Final commit combines user-chosen replacement policy with approved schedule payload.

---

## Cross-Phase Data Contract (What Backend Must Expect)

For backend recreation, treat planner wizard inputs as three layers:

1. Intake layer (Phase 1)
- Structure graph: subjects -> chapters(topics) -> clusters(subtopics) -> tasks.
- Constraint config: global date/capacity + day/date overrides + off-days.
- Chapter params: deadlines/start/dependencies/spacing/session shape.

2. Preview layer (Phase 2)
- Mutable candidate schedule with pinned/manual annotations.
- User-made tactical edits that must survive re-optimization when marked reserved.

3. Commit layer (Phase 3)
- Reconciliation policy (`keepMode`) + optional human summary + final schedule payload.

---

## Quick Minimal Payload Checklist (Backend Rewrite)

If rebuilding backend endpoints, at minimum capture and validate:

1. Structure entities
- subject: `id, name, deadline, sort_order, archived`
- chapter/topic: `id, subject_id, name, sort_order, archived`
- cluster/subtopic: `id, topic_id, name, sort_order`
- task: `id, topic_id, subtopic_id, title, completed, duration_minutes, sort_order`

2. Topic params
- `topic_id, estimated_hours, deadline, earliest_start, depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency`

3. Global constraints
- `study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes, day_of_week_capacity, custom_day_capacity, flexibility_minutes, max_daily_minutes, max_active_subjects`
- plus runtime defaults for: `plan_order`, `plan_order_stack`, `final_revision_days`, `buffer_percentage`, `max_topics_per_subject_per_day`, `min_subject_gap_days`, `subject_ordering`, `flexible_threshold`

4. Off-days
- list of `date` + optional `reason`

5. Preview schedule mutation contract
- each session supports: `scheduled_date, duration_minutes, is_pinned, is_manual, session_type, priority, session_number, total_sessions`

6. Commit contract
- `sessions[]`, `keepMode`, optional `summary`

---

## Notes for parity

1. Current intake captures many high-value planning signals from structure + durations + dates + capacities. The code intentionally auto-derives several planner params instead of asking users to fill every field manually.
2. If backend is recreated, preserve both explicit user fields and current derivation/default rules, otherwise generated plan behavior will drift even when UI inputs look the same.
