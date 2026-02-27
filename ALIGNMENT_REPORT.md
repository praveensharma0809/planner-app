# ALIGNMENT_REPORT.md
## StudyHard — Spec vs. Implementation Analysis

**Prepared:** February 28, 2026  
**Based on:** PROJECT_SPEC.md v2.0 and CURRENT_SYSTEM.md (reverse-engineered state)

---

## 1. Where the Implementation Already Matches the Spec

| Area | Detail |
|---|---|
| Auth system | Supabase Auth with email/password, protected routes, profile-presence check to gate onboarding |
| Onboarding Step 1 (partial) | Captures full_name, primary_exam, daily_available_minutes, exam_date — correct fields |
| Subject data model (core fields) | name, total_items, avg_duration_minutes, deadline, priority, mandatory — all present in DB |
| Subject management UI | Add, edit, delete with cascade warning on subjects page |
| Plan generation is user-triggered | "Generate Plan" button — engine does not auto-run |
| Overload detection exists | `overloadAnalyzer.ts` computes burn rate vs. capacity |
| Task distribution logic | `scheduler.ts` sorts by mandatory → earliest deadline → urgency score and fills days forward |
| Regeneration preserves past | Future generated tasks are deleted; past tasks (date < today) are never touched |
| Task completion is binary | `completeTask.ts` sets `completed = true` — no partial states |
| Completed tasks are not removed | They remain in place, just marked |
| Subject progress counter | `increment_completed_items` RPC keeps `completed_items` accurate |
| Calendar page exists | Monthly view of tasks with completion toggles |
| Dashboard shows today's tasks | Task list for current date with summary of minutes |
| `is_plan_generated` flag | Distinguishes plan-generated tasks from potential manual ones (schema ready) |

---

## 2. Where Behavior Is Different from the Spec

### 2.1 — Dual Planning Modes vs. Single Unified Mode (Critical)

**Spec:** A single unified planning mode. The engine always surfaces conflicts, enters a refinement loop with the user, and proceeds only after the user confirms. There is no "auto" mode.

**Current:** Two modes — `strict` (abort on overload) and `auto` (silently bumps effective daily capacity to match the burn rate). The `auto` mode performs a hidden mutation to the user's capacity without any user acknowledgment.

**Conflict with spec:** Core Rule #2 states "The system never changes the user's plan without explicit user action." Silent capacity adjustment in `auto` mode violates this directly.

---

### 2.2 — Blueprint Screen Does Not Exist (Critical)

**Spec:** Before any plan is written, the user sees a full Blueprint Screen showing: total workload vs. available time, projected daily load per subject, deadline feasibility (safe / tight / at risk / impossible), overload warnings, capacity gap, and suggested adjustments. No plan is generated without the user confirming this screen.

**Current:** The planner page detects overload and presents a binary choice (strict or auto) with required vs. available minutes. There is no structured blueprint view, no per-subject feasibility breakdown, no suggested adjustments, and no inline editing before generation.

---

### 2.3 — Conflict Resolution Is Not Interactive

**Spec:** When the plan is infeasible, the system enters a loop where the user can adjust deadlines, item counts, daily time, and priorities inline — and the blueprint updates in real time. The loop continues until conflicts are resolved or explicitly acknowledged.

**Current:** `resolveOverload.ts` is an empty placeholder. No inline adjustment is possible. The user can only choose between two static modes.

---

### 2.4 — Language Targets "Students" Not Neutral Users

**Spec:** "Do not label users as 'students' in the UI. Use neutral language — 'you', 'your plan', 'your subjects.'" Users are any person with a high-stakes goal.

**Current:** CURRENT_SYSTEM.md describes the app as "geared toward students preparing for competitive exams." This framing likely surfaces in UI copy.

---

### 2.5 — Onboarding Is Incomplete

**Spec:** Five steps: Profile → Subject Setup → Constraint Configuration → Blueprint Preview → Plan Generated.

**Current:** Only Step 1 (Profile) is meaningfully implemented. Subject setup is handled separately in the subjects page. Steps 3 (Constraint Configuration, including off-days) and 4 (Blueprint Preview) do not exist. The flow does not conclude with plan generation.

---

### 2.6 — Dashboard Is a Single-Purpose Page, Not a 7-Grid Mission Control

**Spec:** The dashboard is the most important screen — a 7-grid layout covering: Today's Mission, Plan Health & Progress, Backlog Alert, Mini Calendar, Weekly Snapshot, Streak Tracker, and Upcoming Deadlines.

**Current:** The dashboard shows today's tasks and a daily minutes summary. Only Grid 1 (Today's Mission) is partially approximated. Grids 2–7 do not exist.

---

## 3. Missing Features Required for MVP

These are features the spec requires at MVP that have no implementation today.

| # | Feature | Spec Reference |
|---|---|---|
| 1 | **Blueprint Screen** — full feasibility analysis before plan generation | §3 Step 4, §5 Rule 6, §9 |
| 2 | **Inline Conflict Resolution Loop** — adjust deadlines/items/time/priority interactively | §5 Rule 5, §6 |
| 3 | **Off-days / Blocked Dates** — user sets days with no study; scheduler respects them | §3 Step 3, §5 Input, §9 |
| 4 | **Dashboard Grid 2 — Plan Health & Progress** | §4 |
| 5 | **Dashboard Grid 3 — Backlog Alert with Reschedule Banner** | §4, §6, Rule 4 |
| 6 | **Dashboard Grid 4 — Mini Calendar Preview** | §4 |
| 7 | **Dashboard Grid 5 — Weekly Snapshot** | §4 |
| 8 | **Dashboard Grid 6 — Streak Tracker** | §4, §8 |
| 9 | **Dashboard Grid 7 — Upcoming Deadlines** | §4 |
| 10 | **Backlog accumulation & threshold surfacing** — missed tasks counted and flagged | §6, §8 |
| 11 | **Calendar: Drag-to-reschedule** — move individual tasks between dates | §7, §9 |
| 12 | **Calendar: Day Modal / Expanded View** — clicking a day opens detailed task list | §7 |
| 13 | **Calendar: Missed task indicator** — past days with incomplete tasks marked distinctly | §7 |
| 14 | **Manual (non-generated) custom tasks** — user adds tasks outside the plan | §9 |
| 15 | **Final Exam Deadline / Subject Deadline hierarchy** — the two-tier deadline model must be enforced by the engine | §5 Deadline Hierarchy |
| 16 | **Reschedule Suggestion Banner on Dashboard** — when backlog crosses threshold | §4 Grid 3, §6 |
| 17 | **Settings page** — update daily minutes, exam deadline, personal details, re-trigger onboarding | §9 |
| 18 | **Onboarding fully skippable at each step** | §3 |
| 19 | **Subject subtopics / chapters** — optional nested structure under subjects | §3 Step 2 |
| 20 | **Onboarding concludes with plan generation** — flow ends on Dashboard after plan is written | §3 Step 5 |

---

## 4. Features Already Implemented But Not Needed for MVP

| Feature | Where | Notes |
|---|---|---|
| `auto` planning mode | `generatePlan.ts`, planner UI | Spec requires a single unified mode; auto silently mutates capacity, which contradicts Core Rule #2 and the Blueprint-before-generation rule |
| `qualification` field on profiles | `lib/types/db.ts`, onboarding | Not mentioned anywhere in the spec; likely a holdover from an earlier design |
| `phone` field on profiles | `lib/types/db.ts`, onboarding | Not mentioned in the spec |

---

## 5. Architectural Risks

### Risk 1 — `resolveOverload.ts` Is an Empty Placeholder on a Critical Path
The inline conflict resolution loop is one of the three defining behaviors of this product (alongside the blueprint screen and backlog visibility). The file exists but contains nothing. This is the highest-risk gap because it touches the planner UI, the scheduler, and the blueprint screen — all of which need to be coordinated.

---

### Risk 2 — No Off-Days Data Model
The scheduler currently fills days from today forward without any concept of blocked dates. There is no table, column, or structure in the DB for off-days. Adding this will require a schema change and a non-trivial update to `scheduler.ts`. The scheduler's current day-filling loop assumes every day is available.

---

### Risk 3 — Dashboard Architecture Does Not Scale to the 7-Grid Layout
The current dashboard is a single page component rendering one list. The spec requires a responsive 7-grid layout. Retrofitting this into the existing `page.tsx` risks producing a large, unmanageable component. A grid-based layout with isolated sub-components per panel is likely needed.

---

### Risk 4 — Subject Deadline vs. Final Exam Deadline Hierarchy Is Partially Enforced
The DB has `deadline` on subjects and `exam_date` on profiles, but the scheduler does not explicitly enforce the rule that subject deadlines must fall on or before the final exam deadline. Invalid configurations (subject deadline > exam_date) can currently be saved silently.

---

### Risk 5 — No Backlog Tracking Infrastructure
The spec treats the backlog (missed tasks volume and threshold detection) as a first-class feature with a dashboard panel and a reschedule trigger. The current data model has no aggregated backlog count, no threshold configuration, and no mechanism to compute "total missed task-minutes." This needs to be surfaced either via a DB query on demand or a maintained counter — a decision that affects the dashboard's data-fetching strategy.

---

### Risk 6 — Client-Side Auth Checks via `useEffect`
Protected pages check authentication in `useEffect` hooks on the client. This produces a flash of unprotected content before the redirect fires and is inconsistent with the spec's "no silent failures" principle. Middleware-based or server-component auth checking would be more reliable — notably, a `middleware.ts` file already exists in the project root but its current behavior is unverified.

---

### Risk 7 — Flat Subject Model Cannot Support Subtopics
The `subjects` table is a flat structure. The spec calls for optional subtopics and chapters with "flexible depth." Implementing this requires either a self-referential `parent_id` column on subjects or a separate `subtopics` table. This is a schema-level change that affects the subject management UI, scheduler input, and progress calculations.

---

### Risk 8 — Streak Calculation Has No Data Foundation
The spec's Streak Tracker (Grid 6) requires knowing whether at least one task was completed on every scheduled day going back continuously. The current data model has no daily-completion-summary table or derived column. Streak calculation would need to be computed from the tasks table on every dashboard load, or maintained as a running counter in the profiles table. For large task histories, an ad-hoc query approach may become slow.

---

*End of ALIGNMENT_REPORT.md*
