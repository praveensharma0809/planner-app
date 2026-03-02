# ARCHITECTURE.md
## StudyHard — Target Architecture

**Version:** 1.1 (updated post-audit February 28, 2026)  
**Prepared:** February 28, 2026  
**Basis:** PROJECT_SPEC.md v2.0, CURRENT_SYSTEM.md, ALIGNMENT_REPORT.md  
**Approach:** Incremental evolution — no rewrite

---

## 1. Guiding Principles

This document describes the target architecture needed to bring the current system into full alignment with the product specification. The strategy is to evolve the existing codebase incrementally: preserving every working module that does not conflict with the spec, refactoring what needs to change, and adding what is missing. No module is discarded unless it directly contradicts a core product rule.

The three non-negotiable architectural constraints are:
- **Blueprint before generation** — the planning engine is a two-phase pipeline: feasibility analysis produces a blueprint for user review; DB writes happen only after user confirmation.
- **No auto-mutations** — the engine never silently adjusts user data. Every change to the plan requires explicit user action.
- **Past data is sacred** — the system never modifies or deletes tasks whose `scheduled_date` is before today.

---

## 2. What Stays Unchanged

The following modules are correct as implemented. They require no structural changes.

| Module | Location | Reason to Preserve |
|---|---|---|
| Supabase Auth | Supabase-managed | Fully functional; email/password auth matches spec |
| Browser Supabase client | `lib/supabase.ts` | No changes needed |
| Server Supabase client | `lib/supabase/server.ts` | Cookie-based server client is correct pattern |
| Task completion action | `app/actions/plan/completeTask.ts` | Rewritten post-audit: 3-step direct table ops (tasks → subjects → profiles); no RPC |
| `increment_completed_items` RPC | Supabase DB | Retained in DB; **app no longer calls it directly** |
| Core subject schema | `profiles`, `subjects`, `tasks` tables | Core fields are correct; additions are additive, not replacements |
| `is_plan_generated` flag on tasks | DB + type definition | Correct distinction; used by regeneration logic |
| Regeneration preserves past | `generatePlan.ts` (partial) | The guard `scheduled_date >= today` for deletion is exactly right |
| Subject management UI | `app/dashboard/subjects/` | Add/edit/delete with cascade warning is correct |
| Calendar page (base) | `app/dashboard/calendar/` | Monthly view foundation is correct; extended, not replaced |
| Dashboard layout/sidebar | `app/dashboard/layout.tsx` | Navigation structure is fine |

---

## 3. What Needed Refactoring (Post-Audit Status)

The following modules were identified for change. Items marked **✅ DONE** have been fully implemented. Items marked **⬜ PENDING** remain as frontend-only work.

### 3.1 — `generatePlan.ts` ✅ DONE

**Current problem:** Plan generation is a single-pass function that detects overload and immediately either writes tasks or aborts. The `auto` mode silently bumps effective capacity without user knowledge, directly violating Core Rule #2.

**Required change:** Decompose into two distinct operations:
1. `analyzePlan(input) → BlueprintResult` — a pure function that performs full feasibility analysis and returns a structured blueprint. No DB writes. This is Phase 1.
2. `commitPlan(input) → void` — a server action that receives confirmed input, deletes future generated tasks, and inserts new ones. This is Phase 2, triggered only after explicit user confirmation.

The `auto` mode is removed entirely.

---

### 3.2 — `overloadAnalyzer.ts` ✅ DONE

**Current problem:** Computes a single global burn rate (total remaining minutes / days to furthest deadline) and compares it against daily capacity. This is not granular enough for per-subject feasibility analysis as required by the Blueprint Screen.

**Required change:** Extend to produce a `SubjectFeasibility` record for every subject:
- Required minutes/day for that subject given its effective deadline
- Feasibility status: `safe` | `tight` | `at_risk` | `impossible`
- Capacity gap in minutes (0 if safe)
- Suggested adjustment options (extend deadline by N days, reduce items by N, increase daily time by N minutes)

The global burn rate check is retained as a summary output but the per-subject breakdown becomes the primary output.

---

### 3.3 — `resolveOverload.ts` ✅ DONE

**Current problem:** The file is an empty placeholder. It sits on the critical path between overload detection and plan confirmation.

**Required change:** Implement as a server action that accepts a proposed adjustment (deadline change, item count change, or daily time change for a specific subject) and returns an updated `BlueprintResult`. It does not write to the DB — it recomputes the blueprint from the modified inputs and returns it to the client for display. The conflict resolution loop is driven by the UI calling this action repeatedly until the user is satisfied.

---

### 3.4 — `scheduler.ts` ✅ DONE

**Current problem:** The day-filling loop assumes every day from today to the furthest deadline is available. It does not accept off-days. It does not enforce the two-tier deadline hierarchy (subject deadline must not exceed exam deadline). It supports a capacity-override parameter used only by the now-deprecated `auto` mode.

**Required changes:**
- Accept an `offDays: Set<string>` parameter (ISO date strings); skip those days during distribution.
- Accept `examDeadline: string` from the profile; validate that no task is scheduled beyond this date regardless of subject deadline.
- Enforce that each subject's effective deadline is `min(subject.deadline, examDeadline)`.
- Remove the capacity override parameter; the scheduler always operates on the user's declared `daily_available_minutes` as agreed in the blueprint.

The core sorting logic (mandatory → earliest deadline → urgency score) is retained.

---

### 3.5 — Onboarding Page ⬜ PENDING (Frontend Roadmap Phase 7)

**Current problem:** Only Step 1 (profile setup) is implemented. The flow does not continue into subject setup, constraint configuration, or blueprint preview.

**Required change:** Extend `app/onboarding/page.tsx` into a multi-step wizard:

| Step | Content | Gate |
|---|---|---|
| 1 | Profile (name, goal, exam deadline, daily minutes) | Can skip forward |
| 2 | Subject setup (add subjects with optional detail) | Can skip forward |
| 3 | Constraint configuration (off-days, blocked dates) | Can skip forward |
| 4 | Blueprint preview | Shows feasibility; user adjusts or accepts |
| 5 | Confirmation → plan written → redirect to Dashboard | Auto-proceeds on confirm |

Each step is skippable. Skipping Step 4 proceeds with an unreviewed blueprint and shows a warning. The onboarding state is tracked locally in component state; no separate DB table is required for the wizard position.

---

### 3.6 — Dashboard Page ⬜ PENDING (Frontend Roadmap Phase 4)

**Current problem:** A single component rendering today's task list and a minutes summary. Structurally cannot accommodate the 7-grid layout.

**Required change:** Replace `app/dashboard/page.tsx` with a grid-based layout composed of isolated panel components. Each panel is a standalone component responsible for its own data fetching (via server components or dedicated server actions) and its own empty state.

See Section 6 for the full panel breakdown.

---

### 3.7 — Route Protection ✅ DONE

`middleware.ts` handles all route protection server-side: unauthenticated → `/auth/login`; session but no `profiles` row → `/onboarding`. Client-side `useEffect` auth guards have been removed.

---

### 3.8 — Language Audit ⬜ PENDING (Frontend Roadmap Phase 9)

**Current problem:** UI copy and internal documentation use the word "students" and framing specific to exam prep.

**Required change:** Audit all user-facing strings in page components and replace exam/student-specific language with neutral equivalents: "your plan", "your subjects", "your goal", "daily target".

---

## 4. Schema Changes

All changes are additive. No existing columns are dropped or renamed.

### 4.1 — `off_days` Table (New)

```
off_days
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
  user_id     uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  date        date  NOT NULL
  reason      text  NULLABLE
  created_at  timestamptz DEFAULT now()
  UNIQUE(user_id, date)
```

Used by the scheduler to skip days during task distribution. Managed from the constraint configuration step of onboarding and from the Settings page.

### 4.2 — `profiles` — Additions

| Column | Type | Purpose |
|---|---|---|
| `streak_current` | integer DEFAULT 0 | Running streak counter; updated on task completion |
| `streak_longest` | integer DEFAULT 0 | High-water mark for streak |
| `streak_last_completed_date` | date NULLABLE | Date of most recent completion for streak continuity check |

Streak state is maintained as an incremental counter rather than computed ad-hoc across the full tasks history. `completeTask.ts` is extended to update these fields when a completion event is the first completion of the day.

### 4.3 — `subjects` — No Changes at MVP

The flat subject schema is retained for MVP. The `parent_id` self-referential column needed for subtopics is deferred. The spec marks subtopics as "optional, fully flexible depth" — this is a Phase 2 schema change.

### 4.4 — `profiles` — Columns to Retire (Non-Breaking)

`qualification` and `phone` are present in the schema but have no place in the spec. They are not removed at this phase (removing columns is destructive and requires a migration), but they are excluded from all new UI forms. A clean-up migration can drop them in a future release.

---

## 5. Scheduling Engine Architecture

The scheduling engine is a pure-function pipeline. No component of the engine reads from or writes to the database. Data is loaded by the server action layer, passed into the engine, and the result is returned to the caller.

```
┌─────────────────────────────────────────────────────────────┐
│                    Planning Engine (lib/planner/)            │
│                                                              │
│  Input:                                                      │
│    subjects[]        ← from DB (via server action)           │
│    profile           ← from DB (via server action)           │
│    offDays: Set<date> ← from DB (via server action)          │
│                                                              │
│  Phase 1: Feasibility Analysis                               │
│  ┌──────────────────────────────────────────┐               │
│  │  overloadAnalyzer.ts                     │               │
│  │  - Compute effective deadline per subject│               │
│  │    (min(subject.deadline, exam_date))     │               │
│  │  - Compute available study days per      │               │
│  │    subject (calendar days minus off_days)│               │
│  │  - Compute required min/day per subject  │               │
│  │  - Compute total required min/day        │               │
│  │  - Compare against daily_available_min   │               │
│  │  - Emit SubjectFeasibility[] + Summary   │               │
│  └──────────────┬───────────────────────────┘               │
│                 │ BlueprintResult                            │
│                 ▼                                            │
│  Phase 2: Blueprint (returned to UI — no DB write)          │
│  ┌──────────────────────────────────────────┐               │
│  │  BlueprintResult {                       │               │
│  │    subjects: SubjectFeasibility[]        │               │
│  │    totalRequiredMinPerDay: number        │               │
│  │    availableMinPerDay: number            │               │
│  │    capacityGapMinPerDay: number          │               │
│  │    overallStatus: feasible | overloaded  │               │
│  │    suggestions: AdjustmentSuggestion[]   │               │
│  │  }                                       │               │
│  └──────────────┬───────────────────────────┘               │
│                 │ (user reviews; may call resolveOverload    │
│                 │  one or more times with adjustments)       │
│                 ▼                                            │
│  Phase 3: Schedule Generation (after user confirms)         │
│  ┌──────────────────────────────────────────┐               │
│  │  scheduler.ts                            │               │
│  │  - Sort subjects: mandatory first,       │               │
│  │    then earliest effective deadline,     │               │
│  │    then urgency score                    │               │
│  │  - Fill calendar days from today to      │               │
│  │    each subject's effective deadline     │               │
│  │  - Skip off_days                         │               │
│  │  - Respect daily_available_minutes       │               │
│  │    (no override; user already confirmed) │               │
│  │  - Emit ScheduledTask[]                  │               │
│  └──────────────┬───────────────────────────┘               │
│                 │ ScheduledTask[]                            │
└─────────────────│───────────────────────────────────────────┘
                  │
                  ▼
         commitPlan() server action
         - DELETE future generated tasks (scheduled_date >= today, is_plan_generated = true)
         - INSERT ScheduledTask[] with completed = false, is_plan_generated = true
         - Redirect to Dashboard
```

### Key Invariants of the Engine

- The engine is stateless and side-effect free. It can be called multiple times during the conflict resolution loop without any consequence.
- `commitPlan` is the only function that writes to the database. It is called exactly once per user-confirmed generation.
- The engine never produces tasks with `scheduled_date < today`.
- The engine never produces tasks with `scheduled_date > profile.exam_date`.
- If a subject has no deadline set, `profile.exam_date` is its effective deadline. This default is resolved inside the engine, not in the UI.

---

## 6. Module and Service Boundaries

```
┌──────────────────────────────────────────────────────────────────┐
│  UI Layer  (app/)                                                 │
│                                                                   │
│  /auth/         Login, Signup — Supabase client SDK               │
│  /onboarding/   Multi-step wizard — calls analyzePlan (read),     │
│                 commitPlan (write) only after Step 4 confirm      │
│  /dashboard/    7-panel grid — each panel is a server component   │
│                 fetching its own data slice                       │
│  /dashboard/subjects/  Subject CRUD — direct Supabase queries    │
│  /dashboard/calendar/  Full calendar — click → day modal,        │
│                        drag → reschedule action                  │
│  /planner/      Blueprint + conflict resolution flow —            │
│                 calls analyzePlan iteratively, commitPlan once    │
└──────────────────────────────┬───────────────────────────────────┘
                               │ Server Actions / RSC fetch
┌──────────────────────────────▼───────────────────────────────────┐
│  Server Action Layer  (app/actions/)                              │
│                                                                   │
│  plan/analyzePlan.ts     Load data → run engine Phase 1+2        │
│                          → return BlueprintResult (no DB write)  │
│  plan/resolveOverload.ts Accept adjustment → recompute blueprint  │
│                          → return updated BlueprintResult        │
│  plan/commitPlan.ts      Accept confirmed input → run Phase 3    │
│                          → delete + insert tasks                 │
  plan/completeTask.ts    Mark task done → direct table ops:      
│                          UPDATE tasks, UPDATE subjects,           
│                          UPDATE profiles streak fields           
│  plan/rescheduleTask.ts  (New) Move task to new date             │
│                          → update scheduled_date on task row     │
│  dashboard/              Dedicated data-fetch actions per panel:  │
│    getBacklog.ts         Tasks with scheduled_date < today,      │
│                          completed = false                       │
│    getStreak.ts          Read streak fields from profiles        │
│    getWeeklySnapshot.ts  Aggregate tasks for current week        │
│    getUpcomingDeadlines.ts Subjects sorted by deadline proximity │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Supabase client (server)
┌──────────────────────────▼───────────────────────────────────────┐
│  Planning Engine  (lib/planner/)                                  │
│                                                                   │
│  overloadAnalyzer.ts   Pure function — in: subjects + profile    │
│                        + offDays → out: BlueprintResult          │
│  scheduler.ts          Pure function — in: subjects + constraints │
│                        → out: ScheduledTask[]                    │
│  generatePlan.ts       Removed or repurposed as a thin           │
│                        orchestrator; logic moves into the two    │
│                        server actions above                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  Data Layer  (Supabase)                                           │
│                                                                   │
│  Tables: profiles, subjects, tasks, off_days                     │
│  Auth: Supabase Auth (email/password)                            │
│  RPC: increment_completed_items                                  │
│  Row-Level Security enforced on all tables                       │
└──────────────────────────────────────────────────────────────────┘
```

### Boundary Rules

- UI components never query Supabase directly. All data access goes through server actions or RSC data fetchers.
- The planning engine (`lib/planner/`) has no knowledge of Supabase. It receives plain objects and returns plain objects.
- Server actions are the only layer that reads from and writes to the database.
- Client components that need interactivity (completion toggles, drag handles) call server actions via Next.js's `useTransition` / `startTransition` pattern.

---

## 7. State Transitions

### 7.1 — Task Completion

```
Task: { completed: false }
  │
  │  User clicks complete toggle
  ▼
completeTask(taskId) server action
  │
  ├─ tasks: set completed = true
  ├─ subjects: increment_completed_items RPC
  └─ profiles: update streak fields
       - If streak_last_completed_date = yesterday → streak_current += 1
       - If streak_last_completed_date = today     → no change (already counted)
       - Otherwise                                 → streak_current = 1
       - If streak_current > streak_longest        → streak_longest = streak_current
       - Set streak_last_completed_date = today

Task: { completed: true }  ← permanent; no undo at MVP
```

Completed tasks are never hidden from the UI. They are visually distinguished (strike-through or check state) and remain on the Dashboard and Calendar in place.

### 7.2 — Missed Task (Falling Behind)

No state change occurs on the task itself when a scheduled date passes without completion. A missed task is defined implicitly by the query:

```
scheduled_date < today  AND  completed = false
```

This query drives the Backlog Alert panel (Dashboard Grid 3). No separate status column is needed. When the backlog volume (sum of `duration_minutes` for missed tasks) exceeds a configurable threshold, the Reschedule Suggestion Banner is surfaced.

The threshold is a constant defined in the application layer (not stored in the DB at MVP). It can be introduced as a user preference in a later phase.

### 7.3 — Plan Regeneration

```
User initiates regeneration (from Dashboard or /planner)
  │
  ▼
analyzePlan() called
  → Load: profile, subjects, off_days from DB
  → Run: overloadAnalyzer (Phase 1 + Phase 2)
  → Return: BlueprintResult to UI (no DB write)
  │
  ▼
Blueprint Screen displayed
  │
  ├─ User makes adjustments?
  │     → resolveOverload(adjustment) called
  │     → Returns updated BlueprintResult
  │     → Loop until user confirms
  │
  └─ User confirms blueprint
        │
        ▼
        commitPlan() called
          → DELETE: tasks WHERE user_id = ? AND is_plan_generated = true AND scheduled_date >= today
          → INSERT: ScheduledTask[] from scheduler
          → Redirect to Dashboard
```

Past tasks (`scheduled_date < today`) are never touched by this flow, regardless of their completion state. Manually created tasks (`is_plan_generated = false`) are also excluded from the delete step.

### 7.4 — Individual Task Reschedule (Calendar Drag)

```
User drags task to new date on Calendar
  │
  ▼
rescheduleTask(taskId, newDate) server action
  → UPDATE tasks SET scheduled_date = newDate WHERE id = taskId AND user_id = ?
  → If newDate is in the past (before today), reject with error
  → No conflict resolution performed automatically
  → If destination day total duration > daily_available_minutes,
    return a warning to the UI (move is still committed)
```

This is a direct, non-engine operation. The planning engine is not involved. The calendar reflects the change immediately.

### 7.5 — Subject Deadline / Data Edit

When a user edits a subject's deadline, item count, or priority:
- The change is persisted to the `subjects` table immediately.
- The current plan in the `tasks` table is **not** automatically updated.
- The Dashboard's Plan Health panel will reflect the new data on next render (since it computes health from subjects + tasks dynamically).
- A recalculation banner may appear prompting the user to regenerate, but regeneration remains voluntary and user-triggered.

---

## 8. Dashboard Panel Architecture

The dashboard is composed of 7 independent panel components, each a React Server Component fetching its own slice of data. This prevents a single failing query from breaking the entire dashboard, and allows panels to be added or removed without touching each other.

| Panel | Component | Data Source | Key Query |
|---|---|---|---|
| Grid 1 — Today's Mission | `TodayMissionPanel` | `tasks` | `scheduled_date = today, user_id` |
| Grid 2 — Plan Health & Progress | `PlanHealthPanel` | `subjects` | All subjects; compute health client-side from fields |
| Grid 3 — Backlog Alert | `BacklogPanel` | `tasks` | `scheduled_date < today, completed = false` |
| Grid 4 — Mini Calendar | `MiniCalendarPanel` | `tasks` | Count per date for current month |
| Grid 5 — Weekly Snapshot | `WeeklySnapshotPanel` | `tasks` | `scheduled_date` in current week |
| Grid 6 — Streak Tracker | `StreakPanel` | `profiles` | `streak_current`, `streak_longest` |
| Grid 7 — Upcoming Deadlines | `UpcomingDeadlinesPanel` | `subjects` | All subjects, sorted by deadline |

Each panel has a defined empty state. No panel renders a blank box. The grid is CSS-based (CSS Grid or Tailwind grid utilities) and reflows at defined breakpoints.

---

## 9. Performance Considerations

### 9.1 — Planning Engine Is Synchronous and In-Process

The scheduling engine operates on in-memory data. For a typical user (10–20 subjects, a plan spanning 3–12 months), the number of generated tasks is in the hundreds, not tens of thousands. The engine completing in under 100ms is expected. No background job queue or worker thread is needed at MVP.

If subject count or planning horizon grows in future phases (multiple concurrent exam profiles), the engine can be moved to a Supabase Edge Function without changing its interface.

### 9.2 — Dashboard Data Fetching

Seven panels making seven separate database queries per dashboard load is acceptable at MVP volumes. Supabase connection pooling (via PgBouncer) handles this. If dashboard load time degrades, the mitigation path is:
1. Combine Grid 1 + Grid 3 into a single query (both are task queries for the current user).
2. Combine Grid 2 + Grid 7 into a single `subjects` load.
3. Introduce a React cache boundary to deduplicate identical queries within the same render pass.

No premature consolidation is recommended until a real performance problem is observed.

### 9.3 — Backlog Query

The backlog is derived from a table scan with a compound WHERE clause (`user_id`, `completed = false`, `scheduled_date < today`). This is fast with an index on `(user_id, scheduled_date, completed)`. This index should be confirmed or added explicitly when the `off_days` migration is run.

### 9.4 — Streak Calculation

Streak fields (`streak_current`, `streak_longest`, `streak_last_completed_date`) are maintained as incremental counters on the `profiles` row. They are updated at task-completion time in `completeTask.ts`. This avoids a full table scan of the tasks history on every dashboard load. The trade-off is that the counter can become stale if a task completion is undone (not supported at MVP) or if data is manually corrected. A repair function can recompute streak from the tasks table if correction is ever needed.

### 9.5 — Calendar Rendering

The full calendar loads one month of tasks at a time. Month navigation triggers a fresh query, not a full-page reload (client-side navigation with state). For months with many tasks (100+), the day-modal approach (only loading full task detail on click) limits the initial data volume.

### 9.6 — Row-Level Security

All Supabase tables enforce RLS with `user_id = auth.uid()`. This prevents cross-user data leaks and removes the need for application-layer user-scoping in most queries. Server actions must use the server Supabase client (cookie-based) to ensure the RLS context is correctly established.

---

## 10. Incremental Delivery Sequence

The following sequence is designed to keep the application working at every step. No phase leaves the system in a broken state.

| Phase | Work | Risk |
|---|---|---|
| **P1 — Middleware Auth** ✅ | `middleware.ts` route protection implemented; unauthenticated → login; no profile → onboarding | Complete |
| **P2 — Schema Additions** ✅ | `off_days` table; streak columns on `profiles`; `profiles → auth.users` FK; 3 migrations applied | Complete |
| **P3 — Engine Refactor** ✅ | `overloadAnalyzer.ts` extended; `scheduler.ts` accepts `offDays` + enforces `examDeadline`; `auto` mode removed | Complete |
| **P4 — Blueprint Pipeline** ✅ | `analyzePlanAction` (no DB write) + `commitPlan` + `resolveOverload` all implemented; `/planner` wired | Complete |
| **P5 — Onboarding Expansion** ⬜ | Extend onboarding to 5 steps; integrate Blueprint Screen as Step 4 | Frontend Roadmap Phase 7 |
| **P6 — Dashboard Expansion** ⬜ | Rebuild dashboard page as 7-panel grid; implement panel components | Frontend Roadmap Phase 4 |
| **P7 — Calendar Expansion** 🔄 | `rescheduleTask` action done; Mark Complete works; drag-to-reschedule UI not yet built | Frontend Roadmap Phase 5 |
| **P8 — Settings Page** ⬜ | Add settings page for profile fields, exam deadline, off-days management | Frontend Roadmap Phase 8 |
| **P9 — Language Audit** ⬜ | Sweep all UI strings; replace student/exam-specific language | Frontend Roadmap Phase 9 |

---

*End of ARCHITECTURE.md*
