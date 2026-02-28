# ALIGNMENT_REPORT.md
## StudyHard — Spec vs. Implementation Analysis

**Prepared:** February 28, 2026 (Session 8 update)
**Based on:** PROJECT_SPEC.md v2.0, CURRENT_SYSTEM.md (Session 7), and full codebase review

---

## 1. Where the Implementation Matches the Spec

| Area | Detail |
|---|---|
| Auth system | Supabase Auth with email/password; SSR cookie-based sessions; all protected routes gated by middleware |
| Middleware route protection | `middleware.ts` redirects unauthenticated → login; no profile → onboarding |
| Onboarding (5-step wizard) | Profile → Subjects → Off-Days → Blueprint Preview → Confirm & Generate — all built |
| Subject data model | All core fields: `name`, `total_items`, `avg_duration_minutes`, `deadline`, `priority`, `mandatory` |
| Subject management UI | Full CRUD with health indicators, burn-rate ETA, delete confirmation dialog, color-coded progress |
| Plan generation is user-triggered | "Analyze Plan" → "Commit" — engine never auto-runs |
| Blueprint before generation | Full Blueprint Screen: per-subject feasibility, capacity bar, badges (IMPOSSIBLE/AT RISK/OK), summary stats |
| Overload detection & resolution | `overloadAnalyzer.ts` + `resolveOverload` action + UI panel with adjustment inputs and re-analysis |
| Task distribution | `scheduler.ts` sorts mandatory → earliest deadline → urgency; fills days; enforces `examDeadline`; skips `offDays` |
| `off_days` table | Created in migration 1; scheduler uses it; managed from Settings |
| Regeneration preserves past | `commitPlan` deletes only future generated tasks; never touches past or manual tasks |
| Task completion is binary | `completeTask.ts` sets `completed = true` — no partial states, no undo at MVP |
| Completed tasks stay visible | Remain in place, visually marked (green check + badge) |
| Subject progress counter | Incremented in `completeTask.ts` via direct table update |
| Streak tracking | `completeTask.ts` maintains `streak_current`, `streak_longest`, `streak_last_completed_date` on `profiles` |
| Calendar (week + month) | Week view with navigation, mark complete, inline reschedule, missed indicators. Month view with day expansion and task toggles |
| Custom task creation | `createTask` + `AddTaskForm` with subject picker |
| Dashboard (7+ panels) | Streak, pending today, done today (SVG ring), backlog, weekly strip, plan health (execution score), mini calendar, upcoming deadlines with completion %, today's tasks with mark complete |
| Settings page | Profile editing, off-days management, re-trigger onboarding |
| `is_plan_generated` flag | Correctly distinguishes plan-generated from manual tasks |
| No client-side mutations | All mutations go through server actions; no direct DB calls |
| RLS | All tables have `user_id = auth.uid()` policies; enforced at DB level |
| Neutral language | Full language audit completed — no "student" or exam-specific copy in UI |
| Error boundaries | `error.tsx` on all dashboard routes |
| Loading states | `loading.tsx` skeletons across all major routes |
| Toast notifications | Global ToastProvider in root layout; success/error/info types |
| Keyboard accessibility | Focus-visible styles in global CSS |
| Responsive sidebar | Mobile hamburger drawer, fixed desktop sidebar |
| App branding | Metadata, titles, and copy all say "StudyHard" |
| Test suite | 18 tests passing across 6 files; zero TypeScript errors |

---

## 2. Remaining Gaps

All backend server actions are complete. Remaining work is UI/UX polish and quality.

### 2.1 — Calendar Drag-to-Reschedule
**Spec:** Users can drag tasks between dates.
**Current:** `rescheduleTask` server action works; inline date-picker reschedule works. HTML5 drag-and-drop UI not yet built.

### 2.2 — Dark/Light Theme Toggle
**Spec:** Theme preference support.
**Current:** Not built. Needs CSS variable system + ThemeProvider + settings toggle.

### 2.3 — Empty State Polish
**Spec (Rule 7):** Meaningful empty states with CTAs everywhere.
**Current:** Most pages have basic "No X found" text, but lack illustrated CTAs (e.g., "no tasks → go to planner").

### 2.4 — Expanded Test Coverage
**Current:** 18 tests. Target: 30+ tests covering more server actions and edge cases.

### 2.5 — Subject Subtopics/Chapters (Stretch)
**Spec:** Optional drill-down into subtopics per subject.
**Current:** Not built. Requires schema change (`parent_id` or subtopics table).

---

## 3. Resolved Issues

| # | Issue | Resolution |
|---|---|---|
| 1 | `uuid → "0"` PostgREST schema-cache bug | `completeTask.ts` rewritten with direct table ops |
| 2 | Single-pass generate → write with no preview | `analyzePlanAction` + `commitPlan` split |
| 3 | `resolveOverload.ts` was empty placeholder | Fully implemented with UI panel |
| 4 | `auto` mode silently mutated capacity | Removed; single unified mode |
| 5 | Streak infrastructure missing | Added to profiles; maintained by `completeTask` |
| 6 | `off_days` table missing | Created; scheduler uses it |
| 7 | Client-side auth checks (useEffect flash) | `middleware.ts` handles server-side |
| 8 | Scheduler ignored off-days and exam deadline | Now accepts `offDays` and enforces deadline |
| 9 | Dashboard had no data actions | All 6 actions implemented |
| 10 | Test suite was misaligned | Rewritten; 18 tests passing |
| 11 | Blueprint Screen UI not built | Full planner pipeline with overload panel, preview, summary stats |
| 12 | Onboarding only had Step 1 | Full 5-step wizard complete |
| 13 | Dashboard missing 7-grid layout | All panels built with responsive grid |
| 14 | Language targeted "students" | Full copy audit completed — neutral throughout |
| 15 | Settings page not built | Full settings with profile, off-days, onboarding re-trigger |

---

## 4. Features Not Needed for MVP

| Feature | Notes |
|---|---|
| `qualification` field | Legacy; retained in DB, excluded from all UI |
| `phone` field | Legacy; retained in DB, excluded from all UI |

---

*End of ALIGNMENT_REPORT.md*

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
