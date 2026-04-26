# Quality Roadmap -- 6.0 -> 10.0

**Branch:** dev-v1
**Date:** 2026-04-26
**Baseline:** 6.0 / 10 (audit of post-IMPLEMENTATION_PLAN.md codebase -- all user-facing defects fixed; quality gaps remain)
**Target:** 10.0 / 10 -- production-excellent, documented, tested, maintainable

This document is the execution plan for resolving all 10 core problems identified in the quality audit. Work is grouped into 6 phases by dependency order, risk, and blast radius.

---

## Pre-work Completed (IMPLEMENTATION_PLAN.md)

Before this roadmap, `IMPLEMENTATION_PLAN.md` addressed all user-reported defects and UX issues (commits `5691c5b`, `07a3821`, `4d124c6`). This work is the foundation we build on:

| Deliverable | Status |
|---|---|
| Phase 1: Dashboard uncheck, sidebar full_name, phone +91 pattern, partial-success updateProfile, legacy filter removal | Committed |
| Phase 2: Optimistic UI (useTransition + startTransition, MonthView, subjects-data-table, schedule, AddTaskButton, TutorialWizard preload) | Committed |
| Phase 3.A: Shared module extraction (`app/components/subjects-data-table/shared.tsx` + `helpers.ts`, dead `subjects-data-table.ui.tsx` deleted, -598 lines) | Committed |
| Phase 3.B: Dependency picker bugs fixed (reload on target change, scope-based filtering) | Committed |
| Phase 3.C: Dead code removed (legacy "Others" filters, dead DependencyManagerModal) | Committed |
| DnD on subjects page | Committed |
| Render loop fix (useMemo on displaySubjects/selectedSubject/selectedChapter) | Committed |
| `tsc --noEmit` clean, `eslint` clean, `vitest` 273/273, `next build` green | Verified |

## Status

| Phase | State |
|---|---|
| Phase 1 -- Documentation and Type Safety | Pending |
| Phase 2 -- Testing Foundation | Pending |
| Phase 3 -- State Management Overhaul | Pending |
| Phase 4 -- Component Decomposition | Pending (shared module extracted; forks remain to be decomposed) |
| Phase 5 -- Error Handling and Accessibility | Pending |
| Phase 6 -- Hardening and CI | Pending |

---

## Guiding Principles

1. **Non-breaking.** Existing UI behavior preserved. No layout / UX changes unless fixing a verified defect.
2. **Incremental.** Each phase ships independently and is independently revertible.
3. **Verify at every gate.** `tsc --noEmit`, `next lint`, `vitest`, and `next build` must be clean after every phase.
4. **No feature work.** This is exclusively architectural hygiene. No new features, no UX changes, no DB changes.
5. **One commit per logical change.** Phases are organizational boundaries; commits are the deliverable unit.

---

## Problem-to-Phase Mapping

| # | Core Problem | Severity | Fixed In |
|---|---|---|---|
| 1 | Two monolithic subjects-data-tables (3.5k + 1.8k lines) needing decomposition | 7.5 | Phase 4 |
| 2 | Zero UI tests / 8.3% test ratio | 9.5 | Phase 2 |
| 3 | No JSDoc / no architecture docs | 9.0 | Phase 1 |
| 4 | 57 useState with no useReducer | 8.7 | Phase 3 |
| 5 | 207 unsafe `as` type assertions | 8.3 | Phase 1 |
| 6 | 1,004-line schedule/page.tsx | 7.9 | Phase 3 + Phase 4 |
| 7 | No error monitoring / no global error boundary | 7.5 | Phase 5 |
| 8 | No React.memo despite 60 useMemo/84 useCallback | 7.2 | Phase 3 |
| 9 | Next.js 16 bleeding edge, no rollback plan | 6.5 | Phase 6 |
| 10 | No focus trapping / no :focus-visible styles | 6.0 | Phase 5 |

---

## Phase 1 -- Documentation and Type Safety (+1.1)

**Risk:** Low
**Effort:** Small
**Status:** Pending

**Goal:** Make the codebase legible and eliminate silent type corruption. Lowest risk, highest immediate value. Every engineer who touches this code after us benefits.

### 1.A -- JSDoc all exported functions in `lib/`

| File | Lines | What to Document |
|---|---|---|
| `lib/planner/engine.ts` | 822 | `buildDaySlots`, `checkFeasibility`, `schedule`, `generatePlan` -- params, return types, edge cases, algorithm overview |
| `lib/planner/draft.ts` | 606 | `buildDraftPlan`, all exported draft helpers |
| `lib/planner/planTransforms.ts` | 565 | All transform functions, unit builders, metadata generators |
| `lib/planner/repository.ts` | 251 | DB layer functions -- what each reads/writes, transaction boundaries |
| `lib/planner/contracts.ts` | 88 | Validation rules, what each contract enforces |
| `lib/supabase/server.ts` | ~50 | `createServerSupabaseClient` -- params, usage pattern |
| `lib/supabase/supabase.ts` | ~20 | `createBrowserSupabaseClient` -- client vs server distinction |
| `lib/types/db.ts` | ~80 | Table relationships, key constraints |
| `lib/tasks/getTasksForDate.ts` | ~30 | Date normalization, input/output |
| `lib/constants.ts` | ~20 | Each constant's purpose and valid range |

**Approach:** Add a `/** ... */` JSDoc block directly above every `export function` and `export const` in the `lib/` directory. Each block covers: what the function does, each parameter (type + purpose), return value shape, and any side effects (DB writes, revalidatePath calls, etc.).

**Verification:**

- [ ] Every export in `lib/` has a JSDoc block
- [ ] `tsc --noEmit` clean (JSDoc does not affect types)

### 1.B -- Write `ARCHITECTURE.md`

A single-page document covering:

1. **Route Structure** -- `(dashboard)` route group, `proxy.ts` auth guard flow, Server vs Client Components boundary
2. **Data Flow** -- Server Actions as the sole mutation layer, Supabase RLS, `revalidatePath`, optimistic UI pattern (`useOptimistic` + `startTransition`), `refreshInBackground` helper
3. **Scheduling Engine** -- `buildDaySlots` -> `checkFeasibility` -> `schedule` -> `generatePlan` pipeline, how dependencies/off-days/flex capacity interact, plan draft -> commit flow
4. **Component Hierarchy** -- Shared UI primitives, layout shell (AppShell -> Sidebar + Topbar + ContentGrid), page-level components
5. **Testing Strategy** -- vitest for unit/action tests (node env), React Testing Library for component tests (jsdom env), Playwright for E2E smoke tests, mock patterns
6. **Key Decisions** -- Why two `subjects-data-table` forks exist, why `useOptimistic` over `router.refresh()`, why atomic RPC commit over multiple INSERTs

**File:** `ARCHITECTURE.md` at repo root.

### 1.C -- Write `CONTRIBUTING.md`

- Setup instructions (clone, `npm install`, `.env.local` setup)
- Development workflow (`npm run dev`, branch naming)
- Quality gates (`tsc`, `lint`, `vitest`, `next build`)
- Commit conventions (imperative mood, under 50 char subject, body for why)
- PR checklist (typecheck, lint, tests pass, manual QA on mobile+desktop)

**File:** `CONTRIBUTING.md` at repo root.

### 1.D -- Add Zod schemas at action boundaries

**Problem:** 207 `as` type assertions trust Supabase response shapes. A schema migration silently corrupts runtime behavior.

**Step 1:** Install zod:
```
npm install zod
```

**Step 2:** Create `lib/contracts/schemas.ts` with Zod schemas mirroring `lib/types/db.ts`:
- `subjectSchema`, `subjectArraySchema`
- `topicSchema`, `topicArraySchema`
- `taskSchema`, `taskArraySchema`
- `plannerSettingsSchema`
- `profileSchema`
- `offDaySchema`
- `planSnapshotSchema`

**Step 3:** Validate Supabase responses at the action boundary before casting:

| Action File | What to Validate |
|---|---|
| `app/actions/subjects/get.ts` | Subject[], Topic[] responses |
| `app/actions/planner/setup.ts` | Subject[], Topic[], PlannerSettings responses (~10+ sites) |
| `app/actions/dashboard/getSubjectProgress.ts` | SubjectProgress[] response |
| `app/actions/dashboard/getUpcomingDeadlines.ts` | Deadline[] response |
| `app/actions/schedule/getWeekSchedule.ts` | ScheduleTask[] response |

**Pattern:**
```ts
import { subjectArraySchema } from "@/lib/contracts/schemas"

const rows = await supabase.from("subjects").select("*")
const subjects = subjectArraySchema.parse(rows.data ?? [])
// throws clear ZodError if shape is invalid, instead of silent corruption
```

**Verification:**

- [ ] `as` casts in `app/actions/` drop significantly (only `error as Error` patterns remain)
- [ ] `tsc --noEmit` clean
- [ ] All existing vitest tests still pass

### 1.E -- Playwright decision

Playwright `^1.59.1` is already in devDependencies. Keep it -- Phase 2 wires it. No action needed now.

### Phase 1 Verification (collective)

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] `vitest` clean
- [ ] `next build` clean
- [ ] Manual: `ARCHITECTURE.md` renders correctly
- [ ] Manual: `CONTRIBUTING.md` renders correctly
- [ ] Manual: `grep -c "/\\*\\*" lib/planner/engine.ts` >= number of exports in that file

---

## Phase 2 -- Testing Foundation (+1.0)

**Risk:** Medium
**Effort:** Medium-Large
**Status:** Pending

**Goal:** From 8.3% test coverage (~10 test files / 120 source files) to ~40%. Component tests for critical UI, integration tests for all server actions, E2E smoke for key flows. This is the safety net that makes Phase 3-4 refactors safe.

### 2.A -- Set up React Testing Library

**Step 1:** Install dependencies:
```
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 2:** Create `vitest.config.dom.ts`:
```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup-dom.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
```

**Step 3:** Create `tests/setup-dom.ts`:
```ts
import "@testing-library/jest-dom/vitest"
```

**Step 4:** Create `tests/utils/testProviders.tsx` wrapping ThemeProvider + ToastProvider for component tests.

**Files:** `vitest.config.dom.ts`, `tests/setup-dom.ts`, `tests/utils/testProviders.tsx`

### 2.B -- Component tests for UI primitives (fast wins)

| Component | Test File | What to Test |
|---|---|---|
| Button | `tests/components/ui/Button.test.tsx` | Renders variants (primary/secondary/outline/ghost), fires onClick, disabled state prevents click, loading state shows spinner, asChild polymorphism |
| Input | `tests/components/ui/Input.test.tsx` | Renders with label (htmlFor), fires onChange, error state styling, disabled state, placeholder rendering |
| Modal | `tests/components/ui/Modal.test.tsx` | Opens/closes with trigger, Escape closes, overlay click closes, aria-modal=true, renders title + children, body scroll lock |
| Checkbox | `tests/components/ui/Checkbox.test.tsx` | Toggle on click, controlled mode (checked prop), uncontrolled mode (defaultChecked), disabled state, Space key toggles |
| Tabs | `tests/components/ui/Tabs.test.tsx` | Tab switching renders correct panel, aria-selected on active tab, aria roles, keyboard navigation (ArrowRight/ArrowLeft) |
| Badge | `tests/components/ui/Badge.test.tsx` | Variant rendering (success/warning/danger/info/neutral), custom children |
| Progress | `tests/components/ui/Progress.test.tsx` | Percentage rendering (0%, 50%, 100%), aria-valuenow/valuemin/valuemax, zero state, clamped overflow (>100%) |
| Dropdown | `tests/components/ui/Dropdown.test.tsx` | Open/close on trigger click, option selection fires callback, Escape closes, click outside closes, keyboard navigation (ArrowDown/ArrowUp/Enter) |

**Target:** 8 new test files, ~60+ test cases total.

### 2.C -- Integration tests for all untested server actions

Add tests for every action file that has zero coverage:

| Action File | Test File | What to Test |
|---|---|---|
| `app/actions/subjects/add.ts` | `tests/actions/addSubject.test.ts` | Creates subject, validates name (non-empty, max length, "Others" rejected), returns UNAUTHORIZED/ERROR/SUCCESS |
| `app/actions/subjects/update.ts` | `tests/actions/updateSubject.test.ts` | Renames subject, validates name, archived guard (reject if archived) |
| `app/actions/subjects/delete.ts` | `tests/actions/deleteSubject.test.ts` | Soft-deletes, archived guard, returns success |
| `app/actions/subjects/reorder.ts` | `tests/actions/reorderSubjects.test.ts` | Reorders subjects, validates order array (length match, unique IDs) |
| `app/actions/subjects/tasks.ts` | `tests/actions/subjectTasks.test.ts` | Creates/updates tasks, validates params, bulk create, error handling |
| `app/actions/subjects/chapters.ts` | `tests/actions/chapters.test.ts` | CRUD for topics/chapters, validation, archived guard |
| `app/actions/dashboard/updateProfile.ts` | `tests/actions/updateProfile.test.ts` | Partial success (name saves even if email fails), phone validation, error paths |
| `app/actions/plan/uncompleteTask.ts` | `tests/actions/uncompleteTask.test.ts` | Uncompletes task, streak unaffected, revalidation |
| `app/actions/schedule/deleteScheduleTask.ts` | `tests/actions/deleteScheduleTask.test.ts` | Deletes schedule task, validates ownership, error paths |
| `app/actions/schedule/upsertScheduleTask.ts` | `tests/actions/upsertScheduleTask.test.ts` | Insert + update paths, "Others" label guard, date validation |

**Pattern:** Follow `tests/actions/completeTask.test.ts` style -- mock Supabase responses with `vi.fn()`, test all return states (UNAUTHORIZED, ERROR, VALIDATION_ERROR, SUCCESS), verify revalidation calls.

**Target:** 10 new test files, ~80+ test cases total.

### 2.D -- Wire Playwright E2E smoke tests

**Step 1:** Create `playwright.config.ts` at repo root:
```ts
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
})
```

**Step 2:** Create `e2e/smoke.spec.ts` -- 5 critical path smoke tests:

| Test | What It Covers |
|---|---|
| Unauthenticated user redirected to login | Visit `/dashboard` -> redirected to `/auth/login` |
| Login renders login form | Email + password inputs, submit button visible |
| Dashboard renders after login | Subject list, task list, progress bar visible |
| Planner wizard accessible | `/planner` loads, wizard steps rendered |
| Schedule page renders | `/schedule` loads, day columns visible |

**Step 3:** Add `"test:e2e": "playwright test"` to `package.json` scripts.

**Target:** 1 E2E test file, 5 smoke test cases.

### 2.E -- Update CI workflow

Add to `.github/workflows/ci.yml`:
- Run component tests separately: `vitest --config vitest.config.dom.ts`
- Run E2E tests: `npx playwright test` (after build)

### Phase 2 Verification (collective)

- [ ] All new component tests pass: `vitest --config vitest.config.dom.ts`
- [ ] All new action tests pass: `vitest`
- [ ] E2E smoke tests pass: `npx playwright test`
- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] `next build` clean
- [ ] CI workflow passes all gates

---

## Phase 3 -- State Management Overhaul (+0.7)

**Risk:** Medium
**Effort:** Medium
**Status:** Pending

**Goal:** Replace `useState` sprawl with `useReducer` state machines, add `React.memo` to key sub-components, and extract hooks from the 1,004-line schedule page. No visual changes.

### 3.A -- useReducer for the planner subjects-data-table

**Current state:** 57 `useState` calls + `mutationLockRef` hack. State transitions are interdependent (fetching, mutating, filtering, DnD, modals) and coordinated manually.

**Approach:** Create `app/(dashboard)/planner/subjects-data-table.reducer.ts` with a typed reducer:

```ts
type DataTableAction =
  | { type: "BEGIN_FETCH" }
  | { type: "FETCH_SUCCESS"; payload: { subjects: Subject[]; topics: Topic[]; tasks: Task[] } }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "BEGIN_MUTATION" }
  | { type: "MUTATION_SUCCESS" }
  | { type: "MUTATION_ERROR"; error: string }
  | { type: "OPEN_MODAL"; modal: "dependencies" | "archive" | "bulkSeries" | null; payload?: unknown }
  | { type: "CLOSE_MODAL" }
  | { type: "SET_FILTER"; filter: string }
  | { type: "SET_SELECTED_CHAPTER"; chapterId: string | null }
  // ... additional action types as needed

type DataTableState = {
  subjects: Subject[]
  topics: Topic[]
  tasks: Task[]
  loading: boolean
  mutationInFlight: boolean
  error: string | null
  activeModal: string | null
  modalPayload: unknown
  selectedChapterId: string | null
  chapterFilter: string
  // ... additional state fields as needed
}
```

Replace 57 `useState` calls with:
```ts
const [state, dispatch] = useReducer(dataTableReducer, initialState)
```

**Impact:** Eliminates `mutationLockRef`, prevents inconsistent state (e.g., mutation while still fetching), makes state transitions explicit and testable.

### 3.B -- Extract schedule page hooks

**Current state:** 1,004-line `app/(dashboard)/schedule/page.tsx` with 16 `useState`, 11 `useEffect`, and a `DayColumn` sub-component defined at the bottom of the file.

**Extract:**

| New File | Contains |
|---|---|
| `app/(dashboard)/schedule/useWeekNavigation.ts` | `weekStart`, `weekDates`, `navigateToPreviousWeek`, `navigateToNextWeek`, `goToCurrentWeek` |
| `app/(dashboard)/schedule/useScheduleFiltering.ts` | `statusFilter`, `selectedSubjectId`, `filterChips`, `filteredEvents`, `eventsByDay` |
| `app/(dashboard)/schedule/useEventEditing.ts` | `editingEvent`, `openEditor`, `closeEditor`, `handleSave`, optimistic local state |
| `app/(dashboard)/schedule/DayColumn.tsx` | The `DayColumn` component currently at line 934-1003 of page.tsx |

**Impact:** `page.tsx` drops from 1,004 lines to ~300 lines of orchestration. Each hook is testable in isolation.

### 3.C -- Add React.memo to key sub-components

**Targets:** Components that receive props passed through multiple layers with memoized callbacks/values:
- `NavigationColumn` (subjects-data-table, both forks)
- `NavigationItemCard` (subjects-data-table)
- `DraggableTaskRow` (planner subjects-data-table)
- `DraggableNavigationItem` (planner subjects-data-table)
- `DayColumn` (schedule page, after extraction)
- `TaskBlock` (schedule)
- `RowActionButton` (both data-tables)

**Pattern:**
```ts
const DayColumn = React.memo(function DayColumn({ date, events, ... }: Props) {
  // ...
})
```

**Impact:** 84 `useCallback` and 60 `useMemo` investments start paying off. Parent re-renders do not cascade into memoized children.

### Phase 3 Verification (collective)

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] All vitest tests pass (node + jsdom)
- [ ] `next build` clean
- [ ] Manual QA: Planner wizard -- all 3 steps functional, mutations work, no regression on DnD, dependency modal, bulk series
- [ ] Manual QA: Schedule -- drag-and-drop works, filtering works, event editing works, week navigation works
- [ ] Manual QA: Subjects page -- reorder works, CRUD works, drawer opens/closes
- [ ] Manual QA: Mobile + desktop for all affected pages
- [ ] Check: `useState` count in planner subjects-data-table drops significantly (from 57 toward single digits)
- [ ] Check: Line count of `schedule/page.tsx` drops from ~1000 to ~300

---

## Phase 4 -- Component Decomposition (+0.8)

**Risk:** Medium
**Effort:** Medium
**Status:** Partial (shared module exists; forks remain monolithic)

**Pre-work delivered by IMPLEMENTATION_PLAN.md (commit `07a3821`):**
- `app/components/subjects-data-table/shared.tsx` -- byte-identical RowActionButton + ColumnItem extracted from both forks
- `app/components/subjects-data-table/helpers.ts` -- numeric ordering, clamp, pattern builders shared between both pages
- Dead `subjects-data-table.ui.tsx` (356 lines) deleted
- Net -598 lines of duplicated code

**Why a mode-prop unified component was rejected:** The IMPLEMENTATION_PLAN.md diffing pass found that NavigationColumn and NameModal have divergent UX contracts between planner and subjects pages. Forcing them into one component with mode flags would break visible behavior on at least one page. The pragmatic choice was: share what is byte-identical, keep what is genuinely different.

**Goal:** Take the remaining ~3,300-line planner fork and ~1,500-line dashboard fork and decompose each into focused sub-components within their owning files. No visual changes. Make each file readable and maintainable without sacrificing the deliberate UX divergence.

### 4.A -- Decompose the planner subjects-data-table (~3,300 lines)

Extract these internal pieces into sub-files:

| Extract | New File | Lines (est.) |
|---|---|---|
| State reducer + action types | `subjects-data-table.reducer.ts` | ~150 |
| Dependency management (modal + candidate logic) | `subjects-data-table.dependencies.tsx` | ~300 |
| Bulk series editor modal | `subjects-data-table.bulkSeries.tsx` | ~250 |
| Task row + draggable task row | `subjects-data-table.taskRows.tsx` | ~200 |
| Archived chapters modal | `subjects-data-table.archived.tsx` | ~150 |
| Intake import + step-2 calendar logic | `subjects-data-table.intake.tsx` | ~250 |
| NavigationColumn (planner variant) | `subjects-data-table.navigation.tsx` | ~400 |

**Target:** Main file drops from ~3,300 to ~1,200 lines of orchestration. Each sub-file is a focused, testable unit.

### 4.B -- Decompose the dashboard subjects-data-table (~1,500 lines)

| Extract | New File | Lines (est.) |
|---|---|---|
| Task operations (toggle, delete, bulk delete) | `subjects-data-table.tasks.tsx` | ~150 |
| Archived chapters toggle + read-only view | `subjects-data-table.archived.tsx` | ~120 |
| NavigationColumn (subjects variant) | `subjects-data-table.navigation.tsx` | ~300 |

**Target:** Main file drops from ~1,500 to ~600 lines. Sub-files remain in each route group's directory (not forced into shared module -- deliberate UX divergence is preserved).

### 4.C -- Shared module audit

Keep `app/components/subjects-data-table/shared.tsx` and `helpers.ts` as they are. Only add to them if genuinely byte-identical code is found during decomposition. Do NOT force divergent UX into shared abstractions.

### Phase 4 Verification (collective)

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] All vitest tests pass (node + jsdom)
- [ ] `next build` clean
- [ ] Planner `subjects-data-table.tsx` < 1,500 lines (down from ~3,300)
- [ ] Dashboard `subjects-data-table.tsx` < 800 lines (down from ~1,500)
- [ ] Each extracted sub-file is < 400 lines
- [ ] Manual QA: Planner wizard -- all 3 steps, all modals, DnD, dependencies, bulk series, task CRUD, import, archive/restore, plan generation + commit
- [ ] Manual QA: Subjects page -- add/rename/archive/reorder subjects and chapters, DnD, drawer
- [ ] Manual QA: Mobile + desktop for both pages (no regression)
- [ ] Manual: kill network mid-mutation on both pages -- rollback + toast works

---

## Phase 5 -- Error Handling and Accessibility (+0.4)

**Risk:** Low
**Effort:** Small
**Status:** Pending

**Goal:** Add error visibility, focus trapping in modals, and visible focus indicators for keyboard users.

### 5.A -- Add global error boundary

**File:** `app/error.tsx` (create if not already present)

```tsx
"use client"

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div role="alert">
          <h1>Something went wrong</h1>
          <pre>{error.message}</pre>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
```

### 5.B -- Add structured error logging

**File:** `lib/ops/logger.ts`

Create a logger with `error`/`warn`/`info` levels. Format as structured JSON in production, pretty-print in development. Wire into every catch block in server actions:

```ts
} catch (error) {
  logger.error("updateProfile", error)
  return { status: "ERROR", message: error instanceof Error ? error.message : "Unexpected error" }
}
```

### 5.C -- Add focus trapping to modals and drawers

**Files:** `app/components/ui/Modal.tsx`, `SubjectDrawer.tsx` (both planner and dashboard variants)

Add a `useEffect` that:
1. On mount: saves the previously focused element, focuses the first focusable element inside the modal
2. On Tab: cycles focus between first and last focusable elements (trap)
3. On unmount: restores focus to the previously focused element

### 5.D -- Add `:focus-visible` styles to `globals.css`

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

:focus:not(:focus-visible) {
  outline: none;
}
```

Ensure sidebar nav items, buttons, inputs, DnD handles, filter chips, and tab controls all receive visible focus rings on keyboard navigation.

### Phase 5 Verification (collective)

- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] `vitest` clean
- [ ] `next build` clean
- [ ] Manual: Throw an error in a page -- global error boundary catches it instead of a blank screen
- [ ] Manual: Open modal -- Tab stays inside modal, Escape closes, focus returns to trigger
- [ ] Manual: Open sidebar / drawer -- same focus trapping behavior
- [ ] Manual: Tab through every page -- focus ring visible on every interactive element

---

## Phase 6 -- Hardening and CI (+0.4)

**Risk:** Low
**Effort:** Small
**Status:** Pending

**Goal:** Pin dependencies, add version-matrix CI, bundle size budgets, and final cleanup.

### 6.A -- Pin Next.js version

- Pin `next` to exact version in `package.json` (replace `^16.1.6` with `16.1.6`)
- Document the "bleeding edge" risk in `README.md`: "This project uses Next.js 16 -- if you encounter issues, file an issue with full reproduction steps"
- Add a `package.json` `engines` field to enforce `Node.js >= 18`

### 6.B -- Version-matrix CI

Add to `.github/workflows/ci.yml` a matrix build step:
- Node.js: `[18, 20, 22]`
- Run `tsc --noEmit`, `next lint`, `vitest`, `next build` on all versions

### 6.C -- Bundle size budget

Add a `scripts/check-bundle-size.mjs` that:
1. Runs `next build`
2. Reads `.next/static/chunks/` sizes
3. Fails if any route's total JS exceeds a budget (e.g., `/planner` < 500KB gzipped, `/schedule` < 300KB gzipped)
4. Reports the top 5 largest chunks

Add to CI as a quality gate.

### 6.D -- Final cleanup

- Remove artifact files (`_p*.md`, temp scripts)
- Remove `artifacts/` if it is crawl documentation, not app assets -- or move it to `docs/`
- Verify `.gitignore` covers all generated files (`.next`, `.next-dev`, `node_modules`, `playwright-report`)
- Run `npm audit` and fix any critical/high advisories
- Run `npm outdated` and document any intentional version holds

### Phase 6 Verification (collective)

- [ ] `npm audit` reports no critical or high advisories
- [ ] `tsc --noEmit` clean
- [ ] `next lint` clean
- [ ] `vitest` clean (node + jsdom)
- [ ] E2E smoke tests pass
- [ ] CI passes on all Node.js versions
- [ ] Bundle size script passes (under budget)
- [ ] `next build` clean

---

## Summary: Phases at a Glance

| Phase | Risk | Effort | Bump | Key Deliverable |
|---|---|---|---|---|
| 1 -- Docs and Types | Low | Small | +1.1 | JSDoc, ARCHITECTURE.md, CONTRIBUTING.md, Zod schemas |
| 2 -- Testing | Medium | Medium-Large | +1.0 | 19 new test files, Playwright E2E smoke, CI updates |
| 3 -- State Management | Medium | Medium | +0.7 | useReducer, schedule hook extraction, React.memo |
| 4 -- Component Decomposition | Medium | Medium | +0.8 | Decompose 2 monolithic files into focused sub-files (<400 lines each) |
| 5 -- Error and A11y | Low | Small | +0.4 | Global error boundary, logger, focus trapping, :focus-visible |
| 6 -- Hardening | Low | Small | +0.4 | Pinned deps, version-matrix CI, bundle budget, npm audit |
| **Total** | -- | -- | **+4.4** | **6.0 -> 10.0+** |

---

## Approval Gate

This plan is in **read-only/proposal state**. Reply with one of:

- **EXECUTE ALL** -- proceed sequentially through all 6 phases; pause between phases for review.
- **EXECUTE PHASE 1** -- proceed with Phase 1 only.
- **REVISE** -- name the items you want changed and a revised plan will be produced.
