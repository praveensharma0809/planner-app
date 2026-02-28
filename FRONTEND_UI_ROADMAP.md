# Frontend UI Roadmap

**Updated:** February 28, 2026 (Session 7)
**Status key:** ✅ Complete | 🔄 In Progress | ⬜ Not Started

## Scope & Constraints
- All backend server actions are complete — no changes to `lib/planner/*`, migrations, or server action logic needed.
- Frontend must call existing server actions only; no direct client DB queries.
- Work in small, shippable phases (2–4 hours each).

---

## Phase 1: Planner Analyze → Confirm ✅ Complete
**Server Actions:** ✅ `analyzePlanAction`, ✅ `commitPlan` — both complete.
**UI Status:** Full planner page built with analyze → overload resolution → preview → commit pipeline.
- `/planner/page.tsx` — CTA, analysis result, status badges, commit button, toast on success/error.
- Summary stats grid (tasks, days, avg min/day, last date) shown before schedule preview.
- Loading/disabled states on all buttons.

## Phase 2: Overload Assistance ✅ Complete
**Server Actions:** ✅ `resolveOverload` — complete.
**UI Status:** Polished overload panel with capacity bar, quick-fix suggestions, per-subject status badges (IMPOSSIBLE/AT RISK/OK), action hints, and adjustment inputs for re-analysis.

## Phase 3: Task Preview & Commit Summary ✅ Complete
**Server Actions:** ✅ `analyzePlanAction` (preview), ✅ `commitPlan` — both complete.
**UI Status:** Preview grid shows per-day task buckets with subject name, duration, and count. 4-card summary stats bar (total tasks, schedule days, avg min/day, last scheduled date). Commit button at top and bottom of preview.

## Phase 4: Dashboard Essentials ✅ Complete
**Server Actions:** All 6 dashboard actions complete (`getStreak`, `getWeeklySnapshot`, `getUpcomingDeadlines`, `getBacklog`, `getSubjectProgress`, `getMonthTaskCounts`).
**UI Status:** Full dashboard with: streak card, pending today, done today (SVG completion ring), backlog card, weekly strip, plan health with execution score, mini monthly calendar, upcoming deadlines with completion % bars, today's tasks with mark-complete, backlog section, backlog reschedule banner (≥5 tasks).

## Phase 5: Calendar View (Week/Month) ✅ Complete
**Server Actions:** ✅ `getWeeklySnapshot`, ✅ `getMonthTasks`, ✅ `rescheduleTask`, ✅ `completeTask`, ✅ `createTask`.
**UI Status:** Week view with prev/next/today navigation, per-day task cards, mark complete, inline reschedule, missed task indicators, week stats. Month view (`MonthView.tsx`) with interactive day expansion, task completion toggles, month stats. Toggle between views via links. AddTaskForm for custom task creation.
- **Remaining:** Drag-to-reschedule UI (HTML5 drag-and-drop between day cells).

## Phase 6: Subjects & Deadlines Overview ✅ Complete
**Server Actions:** ✅ `getUpcomingDeadlines`, ✅ `addSubject`, ✅ `updateSubject`, ✅ `deleteSubject`.
**UI Status:** Full CRUD with `SubjectCard` (health indicators, color-coded progress bars, days-left badges, estimated finish date via burn rate, delete confirmation dialog, toast feedback) and `AddSubjectForm`. Health statuses: on_track / behind / at_risk / overdue.

## Phase 7: Onboarding UX (5-Step Wizard) ✅ Complete
**Server Actions:** All needed actions exist.
**UI Status:** Full 5-step wizard: Profile → Subjects → Off-Days → Blueprint Preview → Confirm & Generate. Each step navigable. Subject deadline defaults to goal deadline. Onboarding re-triggerable from Settings.

## Phase 8: Settings Page ✅ Complete
**Server Actions:** ✅ `updateProfile`, ✅ `addOffDay`, ✅ `deleteOffDay`, ✅ `getOffDays`.
**UI Status:** `SettingsForm` (profile fields with neutral language) + `OffDaysManager` (add/remove off-days with reason, past days dimmed) + re-trigger onboarding link.

## Phase 9: Polish & Accessibility 🔄 In Progress
**UI Status:**
- ✅ Loading skeletons for Dashboard, Calendar, Subjects, Settings
- ✅ Error boundary (`error.tsx`) for 4 routes
- ✅ Focus-visible keyboard styles (global CSS)
- ✅ Responsive sidebar (mobile hamburger drawer)
- ✅ Toast notification system (global provider)
- ✅ Language audit (neutral tone — no exam/student terms)
- ✅ App metadata & branding
- ✅ Auth pages polish (branded, loading states, toast errors, cross-links)
- ⬜ Drag-to-reschedule
- ⬜ Dark/light theme toggle
- ⬜ Empty state polish (meaningful CTAs everywhere)
- ⬜ Full responsive audit of inner page content
- ⬜ Expanded test coverage (currently 18 tests)

