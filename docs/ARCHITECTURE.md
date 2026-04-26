# Architecture: PrepVeda Study Planner

Next.js 16 (App Router) + Supabase + TypeScript strict-mode study planner with
capacity-aware scheduling.

---

## 1. Route Structure

```
app/
  layout.tsx                     Root: ThemeProvider, ToastProvider, fonts
  page.tsx                       Landing page (unauthenticated)
  auth/                          Login / signup flows

  (dashboard)/                   Route group — all authenticated pages
    layout.tsx                   Wraps children in <AppShell> (Sidebar + Topbar + ContentGrid)
    dashboard/                   Home, subjects CRUD, calendar, settings, plan history
    planner/                     3-step plan wizard (intake → setup → review/commit)
    schedule/                    Weekly calendar with drag-and-drop (dnd-kit)
    onboarding/                  First-run profile setup

  actions/
    dashboard/                   8 action files (streak, snapshot, progress, backlogs...)
    subjects/                    8 action files (CRUD, reorder, archive, chapter tasks)
    planner/                     2 action files (setup, plan generation)
    schedule/                    3 action files (week fetch, import, upsert/delete)
    plan/                        4 action files (complete, uncomplete, reschedule, set-completion)
    onboarding/                  1 action file (completeOnboarding)
```

**Auth guard:** `proxy.ts` (root-level middleware) checks Supabase cookies on
`/dashboard`, `/planner`, `/schedule`, and `/onboarding`. Unauthenticated
visitors are redirected to `/auth/login`. Users without a `profiles` row are
redirected to `/onboarding`. Server Action requests (`POST` + `next-action`
header) are never redirected — the middleware passes them through to avoid
breaking the action protocol.

```
Request Flow:
  Browser ──→ proxy.ts ──→ (authenticated?) ──→ route group layout ──→ page
                  │                                    │
                  └── No: redirect /auth/login         └── AppShell (Sidebar + Topbar + children)
```

---

## 2. Data Flow

### 2.1 Server Actions (sole mutation layer)

All writes go through `"use server"` async functions. No direct client-to-DB
calls exist.

```
Client Component                Server Action                 Supabase (RLS)
  ┌──────────┐    startTransition   ┌──────────────┐    SQL    ┌──────────┐
  │ useOptim │ ──────────────────→  │ "use server" │ ────────→ │ Postgres │
  │ istic()  │                      │ fn()         │           │ + RLS    │
  └──────────┘                      │ revalidate…  │           └──────────┘
                                    └──────────────┘
```

- Each Server Action calls `createServerSupabaseClient()` to get a
  cookie-authenticated client.
- After mutation, actions call `revalidatePath()` on the affected route(s) to
  purge the Next.js full-route cache.

### 2.2 Two Supabase Clients

| Client | File | Usage |
|--------|------|-------|
| Browser | `lib/supabase.ts` | Real-time subscriptions, `onAuthStateChange`, direct reads in client components |
| Server | `lib/supabase/server.ts` | Server Components, Server Actions (reads/writes cookies via `next/headers`) |

### 2.3 Optimistic UI

Client components wrap mutations in `startTransition` and use `useOptimistic`
to immediately reflect changes before the server round-trip completes. This
avoids full-page spinners that `router.refresh()` would produce.

```tsx
// Pattern used across the app
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, newItem]
);

function handleAdd() {
  startTransition(() => {
    addOptimistic(draft);
    addItemAction(draft); // Server Action
  });
}
```

### 2.4 Row-Level Security

All tables are locked down with Supabase RLS policies. Users can only read and
write rows where `user_id = auth.uid()`. The server client authenticates via
the session cookie; the browser client via the anon key + session token.

---

## 3. Scheduling Engine (`lib/planner/`)

### 3.1 Pipeline

```
buildDaySlots() ──→ checkFeasibility() ──→ schedule() ──→ generatePlan()
     │                      │                      │              │
     ▼                      ▼                      ▼              ▼
DaySlot[]           FeasibilityResult       ScheduledSession[]  PlanResult
(per-day caps,      (per-unit status,      (dated sessions     (READY | PARTIAL
flex, off-days)     global gap,            with booking,       | INFEASIBLE |
                    suggestions)           dependencies)       NO_DAYS | NO_UNITS)
```

- **`buildDaySlots`** (`engine.ts:186`): Computes available capacity per day from
  constraints (weekday/weekend caps, per-day-over-week caps, custom day
  overrides, off-days, flexibility allowance, exam-minus-revision window).
- **`checkFeasibility`** (`engine.ts:284`): For each `PlannableUnit`, computes
  sessions needed vs. available minutes in its deadline window. Classifies as
  `safe` / `tight` / `at_risk` / `impossible`. Generates suggestions
  (increase capacity, extend deadline, reduce effort).
- **`schedule`** (`engine.ts:502`): Greedy placement algorithm with:
  - Dependency resolution (circular dep detection, `depends_on` chains)
  - Subject-level ordering and gap enforcement (`min_subject_gap_days`)
  - Topic-level sequencing (sequential / flexible_sequential / parallel)
  - Per-topic `max_sessions_per_day` caps
  - Oversized-session detection (longer than any day's capacity)
  - In-progress topic prioritization
  - Subject cap per day (`max_active_subjects`, 60% per-subject ceiling on
    multi-subject days)
  - Overflow pass for topics whose predecessors just completed
  - Reserved slot deduction (pre-booked manual tasks)
- **`generatePlan`** (`engine.ts:945`): Orchestrator. Runs feasibility check,
  then schedule. Returns `PlanResult` discriminated union.

### 3.2 Atomic Commit

Plan commit uses `commit_plan_atomic_v2`, a Supabase RPC function that
**deletes pending plan tasks, inserts new schedule rows, and writes a
`plan_snapshots` metadata row in a single database transaction**. This
prevents partial commits (e.g., new schedule rows inserted but old plan tasks
not yet purged) that would corrupt the schedule view.

### 3.3 Supporting Modules

| Module | Role |
|--------|------|
| `contracts.ts` | Const enums (`SESSION_TYPES`, `STUDY_FREQUENCIES`, `TASK_TYPES`), normalization functions, `isISODate`, `validateDateWindow`, canonical-intake detection |
| `draft.ts` | `inferSessionLengthMinutes` (task-driven + configured fallback), `buildPlanIssues` (diagnostic pipeline producing structured issues with fix-it buttons), `findDependencyCycle` |
| `planTransforms.ts` | Converts raw DB rows → `PlannableUnit[]`, session→task mappers, reoptimization unit builders, dropped-reason diagnostics |
| `repository.ts` | Thin Supabase query wrappers (fetch topics, subjects, planner settings, snapshots, pending tasks, etc.) — all parameterized by user ID |

---

## 4. Component Hierarchy

```
RootLayout
  ToastProvider
    ThemeProvider
      AppShell (dashboard layout)
        ├── Sidebar (nav links, brand)
        ├── Topbar (dynamic, context-aware title/actions)
        │     └── ScheduleTopbarContext (date navigation context for schedule page)
        └── ContentGrid
              ├── PageHeader
              ├── StatsRow
              └── SectionCard
                    └── Page-level components
```

### 4.1 Shared UI Primitives (`app/components/ui/`)

`Button`, `Card`, `Badge`, `Progress`, `Input`, `Checkbox`, `Tabs`,
`Dropdown`, `Modal` — 9 presentational primitives, consistently styled.

### 4.2 Task Layer (`app/components/tasks/`)

`AddTaskButton` — unified task creation modal (handles both subject-linked
and standalone tasks, validates dates, sets sort order).

### 4.3 Onboarding (`app/components/onboarding/`)

`TutorialWizard` + `FlowTutorialButton` — multistep first-run experience.

### 4.4 Subjects Data-Table Two Forks

`planner/subjects-data-table.tsx` (~3477 lines) and
`dashboard/subjects/subjects-data-table.tsx` (~1817 lines) are intentionally
separate. The planner fork needs a NavigationColumn (step-based wizard
navigation embedded in the table), a NameModal with planner-specific validation
and dependency UI, and topic parameter editing inline. The dashboard fork needs
simpler subject management (archive, reorder, add task, progress). Merging
them with mode flags proved unmaintainable because the NavigationColumn and
NameModal UX diverge too far. Shared code is extracted into:

- `app/components/subjects-data-table/shared.tsx` — `RowActionButton`,
  `ColumnItem` (reusable cell primitives)
- `app/components/subjects-data-table/helpers.ts` — numeric formatting,
  ordering utilities

### 4.5 Key Page Components

| Page | Files | Notes |
|------|-------|-------|
| Dashboard | `dashboard/page.tsx`, `DashboardTaskActions.tsx`, `RescheduleMissedButton.tsx`, `PlanHistory.tsx` | Task overview, streak, missed-task recovery |
| Subjects | `dashboard/subjects/page.tsx`, `subjects-data-table.tsx`, `SubjectDrawer.tsx` | Full subject CRUD with data table |
| Calendar | `dashboard/calendar/page.tsx`, `MonthView.tsx`, `DayColumn.tsx`, `TaskBlock.tsx` | Monthly and daily views |
| Planner | `planner/page.tsx`, `PlannerWizardClient.tsx`, `subjects-data-table.tsx` (step 1), `subjects-data-table.step2.tsx` (step 2), `PlanPreview.tsx`, `PlanConfirm.tsx`, `PlanIssueModal.tsx` | 3-step wizard |
| Schedule | `schedule/page.tsx` (~1004 lines), `schedule-page.cards.tsx`, `schedule-page.modal.tsx` | dnd-kit sortable weekly view |
| Settings | `dashboard/settings/page.tsx`, `SettingsForm.tsx` | Profile, study preferences |

---

## 5. Key Architectural Decisions

### 5.1 Why Two `subjects-data-table` Forks

The planner and dashboard pages need fundamentally different UX in the
NavigationColumn (wizard step navigation embedded in the table vs. none) and
the NameModal (planner param editing + dependency UI vs. simple rename). Mode
flags bloated into a ~5000-line component with tangled conditional rendering.
Two forks with shared primitives (`shared.tsx`, `helpers.ts`) is cleaner.

### 5.2 Why `useOptimistic` over `router.refresh()`

`router.refresh()` re-renders the full server component tree, causing a flash
and spinner. `useOptimistic` + `startTransition` gives **instant** UI feedback
while the Server Action runs, with automatic rollback if the action fails.

### 5.3 Why Atomic RPC Commit

`commit_plan_atomic_v2` wraps plan persistence in a single Postgres
transaction. Without it, a failure mid-commit could leave deleted old tasks
without new tasks inserted, breaking the schedule view. Atomicity is
non-negotiable for plan writes.

### 5.4 Why `strict: true` + 207 `as` Casts

The codebase uses `strict: true` but has many `as` casts on Supabase response
shapes because `@supabase/supabase-js` returns generic `PostgrestResponse`
types. Phase 1.D is addressing this with Zod runtime validation to eliminate
unsafe casts while keeping TypeScript strictness.

### 5.5 Capacity-Aware Scheduling (not just time-blocking)

Unlike calendar apps that just slot fixed events, the planner computes per-day
capacity from constraints, models dependencies between topics, respects
sequencing modes (sequential/flexible/parallel), and warns when load is
infeasible — with structured suggestions (extend deadline, reduce effort,
increase capacity) that the user can apply inline.

---

## 6. Testing Strategy

| Layer | Tool | Config | Status |
|-------|------|--------|--------|
| Unit / Server Action tests | vitest (node) | `vitest.config.ts` | Active |
| Component tests | vitest + RTL (jsdom) | `vitest.config.dom.ts` | Phase 2 |
| E2E smoke tests | Playwright | — | Phase 2 |

**Mocks:**
- `vitest.setup.ts` mocks `next/cache` (`revalidatePath`, `revalidateTag`) so
  Server Actions can be unit-tested outside the Next.js request context.
- Supabase client stubs use `vi.fn()` for repository-layer isolation.

---

## 7. Tech Stack Summary

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16.1 (App Router) |
| Language | TypeScript 5.9, strict mode |
| Database | Supabase (Postgres + RLS + `@supabase/ssr`) |
| Auth | Supabase Auth (cookie-based session) |
| Styling | Tailwind CSS 4, Geist fonts, CSS custom properties (`lib/design-tokens.ts`) |
| Drag & Drop | `@dnd-kit/core` + `sortable` + `utilities` |
| Validation | Zod 4 (runtime), TypeScript (compile-time) |
| Test | vitest, React Testing Library, Playwright |
| Lint | ESLint 9 + `eslint-config-next` |
