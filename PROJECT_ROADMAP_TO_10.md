# PrepVeda — Roadmap from 5.0 → 10.0

> **Companion document to `PROJECT_AUDIT.md`.**
> This file converts every weakness identified in the audit in `PROJECT_AUDIT.md`, plus a deep core-feature inspection (Subjects, Planner, Schedule, Calendar), into an executable, parallelisable plan with explicit model recommendations per cluster and phase.
>
> **Reading order**:
> 1. § A: Core feature deep-dives (Subjects / Planner / Schedule / Calendar) with concrete bug list.
> 2. § B: Cross-cutting findings & modernisation opportunities.
> 3. § C: Cluster overview & dependency graph.
> 4. § D: Detailed cluster plans (15 clusters, A–O).
> 5. § E: Phase plan (5 phases, weekly cadence).
> 6. § F: Model selection guide.
> 7. § G: UI/design escalation policy (what I'll do vs. what you must do).
>
> **Conventions**:
> - 🔴 = blocker / data-loss / broken on first run.
> - 🟠 = serious bug / UX failure.
> - 🟢 = polish / quality.
> - File references are GitHub-style: `path/to/file.ts:lineNumber`.

---

# § A — Core Feature Deep-Dive

## A1. Schedule (`app/(dashboard)/schedule/`)

The schedule page is **the most bug-dense surface in the app**. The user's drag-and-drop complaint is real, and it has *more* causes than the user realised.

### 🔴 SCHED-1 — Server explicitly rejects past dates (root cause of "can't drag to past date")

`app/actions/plan/rescheduleTask.ts:33`

```ts
if (!newDate || !isISODate(newDate) || newDate < todayIso) {
  return { status: "INVALID_DATE" }
}
```

The week grid happily renders previous weeks (you have a `handleGoPrevWeek`), and the client-side check at `app/(dashboard)/schedule/page.tsx:464` uses *today* as the cutoff for cross-day moves. So:
- Drag onto a past date in the current week → **client toast "You cannot move tasks to a past date."** and silent rollback. (Line 465.)
- Drag in a previous week (which the UI exposes via prev-week button) → client check passes if the target is "today or later relative to today", but the *server* rejects with `INVALID_DATE`, the optimistic update rolls back, and the user sees an unexplained snap-back.

This is a **product decision masquerading as validation**. There are valid use cases for backdating ("I actually did this last Tuesday, mark it complete on its real date"). The fix is to either:

- **(A)** Allow backdating but block past-date *and not yet completed* tasks (the actual concern), or
- **(B)** Allow backdating only in calendar/month view with an explicit "Backdate" affordance, or
- **(C)** Keep the rule but **make the UI honest**: grey-out past columns, show a "past dates locked" tooltip, and disable the drop target server-side AND client-side AND visually.

The current state is the worst of all three.

### 🔴 SCHED-2 — Column header / "corner date indicator" is not a droppable

`app/(dashboard)/schedule/page.tsx:737-751`

```tsx
{DAY_LABELS.map((label, index) => (
  <div key={label} className="flex flex-col items-center gap-0.5 py-2 ...">
    <span className="font-semibold">{label}</span>
    <span className="text-[11px]">{formatDayDateLabel(weekDates[index])}</span>
  </div>
))}
```

The day-of-week + date block at the top of each column **looks like it should be a drop target** — that's the natural mental model ("I drag the task to *Friday the 8th*"). It is not. Only `DayColumn` itself (`useDroppable({ id: 'day-${day}' })`) registers as droppable, and its hit-area is the body of the column, *not* the header strip. Dropping on the header lands on the underlying `<section>` border — `event.over` is `null` — and `handleDragEnd` returns silently at line 442.

This precisely matches the user's complaint about "corner date indicators" not working.

### 🔴 SCHED-3 — Same-day reorder is not persisted

`page.tsx:479-488` updates `dayOrderMap` for same-day reorders, but the only persistence layer is `localStorage` (via `useDayOrder`). On another device, or after clearing site data, the user's manual ordering is gone. There is no `sort_order` UPDATE on tasks for in-day reordering.

### 🟠 SCHED-4 — `pointerY` insertion logic uses the wrong event

`page.tsx:492-509`

```ts
const pointerY = event.activatorEvent && "clientY" in event.activatorEvent
  ? Number(event.activatorEvent.clientY)
  : null
```

`activatorEvent` is the **original pointerdown** that *started* the drag. `event.activatorEvent.clientY` is therefore the pointer position at the *start* of the drag, not the drop point. Insertion index is computed from the start position → cards get inserted at the wrong place when you cross-day-drop into an empty area.

The correct value is the latest pointer position from `event.delta` plus the start position, or DnD-Kit's `event.over.rect` and `event.collisions`.

### 🟠 SCHED-5 — `dayOrderMap` localStorage write per render

`useDayOrder.ts:22-29` writes the entire week's order to localStorage on every change. With 30 weeks of history that's a 60-100 KB JSON write on every drag. Scaled across many users, eventually:
- Storage quota exceeds (mobile Safari is 5–10 MB).
- No cleanup of orderings for weeks the user no longer cares about.

### 🟠 SCHED-6 — Mobile drag is technically supported, practically broken

`page.tsx:660` — `useSensor(PointerSensor, { activationConstraint: { distance: 4 } })`.

A 4-pixel activation distance on touch means **any vertical scroll inside a column initiates a drag**. There is no `delay`-based touch sensor, no `TouchSensor` configured, no long-press affordance. On mobile users drag by accident and rage-tap to escape.

### 🟠 SCHED-7 — Reschedule action ignores `sort_order` and topic time-window when manually placed

`rescheduleTask.ts:97` only updates `scheduled_date`. It does **not**:
- Update `sort_order` to put the task at the bottom of the new day.
- Re-validate that the move keeps the topic's session ordering monotonic (session #3 of a topic now scheduled before session #2 because of the drop).
- Block dropping a planner-generated task onto a day that already has the same topic at its `max_sessions_per_day` cap.

### 🟠 SCHED-8 — `event.over` resolution is brittle for empty columns

`page.tsx:450-453`:

```ts
const dayMatch = /^day-(\d+)$/.exec(dropTarget)
const targetEvent = dayMatch ? null : eventById.get(dropTarget)
const targetDay = dayMatch ? Number(dayMatch[1]) : targetEvent?.day
```

If `event.over.id` is something else entirely (a future drop zone, a malformed id, a stale id during HMR), `targetDay` is `undefined` and the function returns silently. This is fragile — a typo in a future droppable id causes silent failures with no log.

### 🟢 SCHED-9 — "No tasks for this day" empty drop placeholder is too tall

`DayColumn.tsx:51` — `min-h-[180px]` empty state. Stacks 7 of these on mobile = 1260 px of "No tasks for this day" before the user finds anything.

### 🟢 SCHED-10 — `useScheduleTopbar` couples page state to a global context

The schedule page sets ~12 callbacks into a global context (`page.tsx:391-428`) so that the Topbar can render schedule-specific controls. Two consequences: tight coupling (Topbar can't be deduced from route alone), and effect-dependency churn (every state change in the schedule page triggers a Topbar re-render).

### Fix design (proposed)

```
Phase 1 (this week):
  • Make column headers droppable → wrap header in `useDroppable({ id: 'day-${day}-header' })` and
    treat in handleDragEnd identically to the column body.
  • Replace `event.activatorEvent.clientY` with the correct drop pointer
    (use DnD-Kit's `event.over.rect`/`event.collisions` instead).
  • Persist same-day reorder via a new `reorderTasksOnDate` server action that
    updates `sort_order`.
  • Add a TouchSensor with `delay: 250, tolerance: 5` so accidental scrolls
    don't drag.
  • Decide policy for past dates: my recommendation is allow backdating
    (with a small "Backdate" tooltip) — reflect that policy in
    `rescheduleTask.ts:33` AND in the column's hover state.
  • Cap `useDayOrder` localStorage to last 12 weeks; expire older.
```

---

## A2. Calendar (`app/(dashboard)/dashboard/calendar/`)

`MonthView.tsx` is **666 lines**. The bulk of the issues are in the date math.

### 🔴 CAL-1 — Date display lies in non-UTC timezones

`MonthView.tsx:58-64`

```ts
function formatFullDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "UTC",
  })
}
```

The rest of the app uses `getTodayLocalDate()` which is *local time*. So a task scheduled `2026-05-04` (saved in DB as `date '2026-05-04'`) is parsed as midnight UTC, then formatted "as UTC". For a user in IST (+5:30), that displays correctly *only* because we forced `timeZone: "UTC"`. But the rest of the app shows local dates. **Result**: in some surfaces a task is "May 4", in others (calendar) it's also "May 4" — fine — but **this is now the only place in the codebase using UTC as the formatting basis**. Any future inconsistency (e.g., comparing to `getTodayLocalDate()` to highlight "today") will fail.

The fix is to standardise: pass dates through one helper that always renders in the user's effective timezone, store user timezone in `profiles.timezone`, default to `Intl.DateTimeFormat().resolvedOptions().timeZone` server-side.

### 🟠 CAL-2 — `taskRows` overrides parent `tasks`, killing in-flight optimistic updates

`MonthView.tsx:100-102`:

```ts
useEffect(() => { setTaskRows(tasks); }, [tasks])
```

Whenever the parent passes new `tasks` (e.g., after a `router.refresh()`), all unsubmitted optimistic edits in `taskRows` are wiped. If the user is mid-action when revalidation completes, the UI flickers backwards.

### 🟠 CAL-3 — Reschedule from calendar uses the same broken `rescheduleTask`

The calendar's "move task" path goes through the same server action with the past-date rejection. Calendar shows past months → user clicks "move to" past day → fails. Same root cause as SCHED-1.

### 🟠 CAL-4 — Day click model = open a modal that's also a route

`MonthView` opens a per-day `<Modal>` rather than navigating to `/dashboard/calendar/[date]`. That kills:
- shareable URLs ("send me your May 4 plan")
- back-button behaviour
- direct-deep-link from notifications (when you ship them)

### 🟠 CAL-5 — Subject colours are positional (`subjects.indexOf(s) % 8`)

`MonthView.tsx:104-110`. Adding a new subject reshuffles every other subject's colour. Users build mental colour ↔ subject associations. We're throwing them away on every CRUD.

### 🟢 CAL-6 — Calendar shows up to N tasks per cell, the rest are "+X more"

The "+X more" affordance is inside the modal, but the cell itself doesn't have a hint about *which* days are busy weeks. A tiny capacity-bar or load colour heatmap would communicate weekly load at a glance.

### Fix design (proposed)

- Replace `formatFullDate` with a single `formatLocalDate(iso, userTz)` helper used everywhere.
- Add `profiles.timezone text not null default 'UTC'`.
- Persist subject → colour assignment in DB (or hash the subject ID to a stable palette index).
- Promote day-modal to a route (`/dashboard/calendar/[YYYY-MM-DD]`).
- Heatmap colour cell intensity by `total_minutes_that_day / capacity_that_day`.

---

## A3. Subjects (`app/(dashboard)/dashboard/subjects/` and `app/(dashboard)/planner/subjects-data-table.tsx`)

This is the area with the most *organisational* debt — two 2,770-line / 1,440-line forks of the same data table — and several small workflow bugs.

### 🔴 SUBJ-1 — Two divergent forks of the same component

Already covered in audit §2.2c. Until this is fixed, every Subjects-area bug must be triaged twice.

### 🟠 SUBJ-2 — Archived subjects can collide with new subjects on rename

`subjects` has a partial unique index `(user_id, lower(name)) where archived = false`. So "Math" archived + "Math" active is allowed. **But** `addSubject` returns "A subject with this name already exists" if you try to re-create "Math" while another *active* "Math" already exists, and the user has **no UI to find and unarchive the old one** without going to the archive view (which exists but isn't featured).

### 🟠 SUBJ-3 — Bulk task creator ships with no preview

`tasks.ts:230` (`bulkCreateSubjectTasks`). The user types `count=50, base="Lecture", separator="-", placement="suffix", numberPadding=2` and clicks Create. They **don't** see the rendered names ("Lecture-01", "Lecture-02", …) before commit. Some users will produce 50 wrong-named rows and have to delete them.

### 🟠 SUBJ-4 — Reorder is N round-trips with no transaction

`tasks.ts:604-615` (`reorderTasks`), and the same pattern in `reorderChapters.ts` and `reorderSubjects.ts`. Audit §3.1 BUG 3.

### 🟠 SUBJ-5 — "Others" reservation is bypassable

`lib/constants.ts:isReservedSubjectName` uses lowercase substring/equality without Unicode NFC normalisation. "Оthers" (Cyrillic O) bypasses the constraint, and "OTHERS" hits a case path that depends on whether the SQL constraint or the TS check fires first.

### 🟠 SUBJ-6 — Topic dependency UI is inside a 2,770-line component

The dependency graph editing happens inside `app/(dashboard)/planner/subjects-data-table.tsx` and `subjects-data-table.dependencies.tsx`. There's no graph visualisation, just a dropdown of "depends on which topic" per row. With 30 topics the user can't see the dependency chain.

### 🟢 SUBJ-7 — No "duplicate subject" / "import from previous exam"

A user prepping for both UPSC Prelims and Mains has 60-80% subject overlap. They have to retype everything.

### Fix design (proposed)

- Adopt `@tanstack/react-table` headless. One config, two consumers.
- Bulk-creator preview pane (live render of the first 5 / last 2 / total count).
- Bulk reorder via single SQL: `UPDATE topic_tasks SET sort_order = data.sort_order FROM (VALUES (uuid, int), …) AS data(id, sort_order) WHERE topic_tasks.id = data.id`.
- NFC-normalise + Unicode confusables block list (`unicode-confusables` npm package) for reserved names.
- Visual dependency DAG (`reactflow` or `dagre-d3`) inside the planner step.
- "Duplicate subject" action that copies subject + topics + topic_tasks (without dates) into a new subject.

---

## A4. Planner (`app/(dashboard)/planner/`, `lib/planner/engine.ts`, `app/actions/planner/`)

The planner is the differentiator and the place most of the interesting bugs live.

### 🔴 PL-1 — "Deterministic constraint solver" is a greedy heuristic

Audit §3.1 BUG 4. Marketing copy needs to change OR the algorithm needs replacing.

### 🔴 PL-2 — Capacity is silently scaled

`lib/planner/engine.ts:815-829`. When a user's total estimated minutes exceeds their declared base capacity AND they haven't set explicit `flexibility_minutes`, the engine *auto-increases each day's capacity* to fit. The user is never told. They configured "60 min weekday" → got "82 min weekday" without consent.

### 🔴 PL-3 — Wizard state in localStorage with no expiry

`app/(dashboard)/planner/wizard-state.ts`. A user who started step 2 yesterday on phone, then opens laptop today, gets two divergent draft states with no merge. Closing tab in incognito loses everything mid-draft.

### 🟠 PL-4 — Plan generation re-fetches all inputs every click

`generatePlanAction` in `plan.ts:505` re-runs `getPlannerSettings + getSubjectsForUser + getTopicsForUser + getTopicParamsForUser + getOpenManualTasksByTopic` on **every click**. No input hash, no cache. Heavy users with 200+ topics see 1.5–3 s per generate.

### 🟠 PL-5 — "Fix it" suggestions don't apply atomically

The PlanIssueModal offers structured fixes ("Increase daily capacity by 47 min"). Clicking applies the change, but if the user clicks two fixes back-to-back, both fire concurrent server actions; the second often clobbers the first.

### 🟠 PL-6 — `keep_mode='until'` and `keep_mode='future'` are identical

`commit_plan_atomic_v2`, lines 520–531 of the migration. Two distinct UI options collapse to the same delete logic. The Step-3 Confirm screen presents both as if they differ.

### 🟠 PL-7 — No "what's changed" diff between plans

After commit, the user sees a flat list of new tasks. They don't see "5 sessions moved later, 2 new revision sessions added, 3 dropped". This is a missed opportunity for the most differentiated insight in the app.

### 🟠 PL-8 — Step-2 capacity inputs lack defaults

The setup form has no recommended values, no slider for "I have ~2 hours/day, weekends similar". Users either over-allocate (and miss days) or under-allocate (and trip feasibility).

### 🟠 PL-9 — Dropping sessions returns `PARTIAL` but no actionable repair

`engine.ts:generatePlan` returns `{ status: "PARTIAL", droppedSessions }`. The UI (`PlanPreview.tsx`) shows the count and a `buildDroppedReasons` list, but the only repair path is to **return to step 2 and increase capacity manually**. There's no "auto-fix this many sessions for me" button.

### 🟢 PL-10 — `flexibility_minutes` is exposed without explanation

A typical user has no idea what "flexibility minutes" means or what range to set. No info icon, no "Recommended: 30" hint.

### 🟢 PL-11 — The wizard auto-saves only on phase advance

If the user adjusts a topic's `estimated_hours` in step 1 and the network blips on save, the wizard advances anyway and the data is lost.

### Fix design (proposed)

- Rewrite `engine.ts` with deterministic iteration (sort all maps/sets explicitly) **OR** swap in a CP-SAT solver via wasm (`Glpk.js` or a small custom OR-Tools wasm build).
- Surface "we scaled your capacity by X%" as a visible banner with an "Undo / Lock my capacity" affordance.
- Move wizard state to `planner_drafts` DB table (one row per user) — survives device switches.
- Cache the `generatePlanAction` *input* by hash; reuse last result if inputs unchanged.
- Serialise PlanIssueModal fix-it actions with a queue.
- Implement plan diff: `diffPlans(prevSnapshot.schedule_json, nextSchedule)` returning `{ moved, added, removed, unchanged }` and render in the Confirm screen.
- Drop the redundant `keep_mode` option.
- Add "Recommended: 90 min weekday / 180 min weekend" defaults from a quick onboarding question.

---

## A4b. Add-Task Modal — Focus-Stealing Bug (cross-cutting, high-impact)

User-reported: typing in the **Title** field of the Add Task modal (Overview "Quick add for today", Calendar add-task, and most other surfaces) causes focus to jump to the close (X) button after every keystroke. The Schedule page's "Add Event" modal does **not** have this bug.

### Where it shows up
- `app/(dashboard)/dashboard/page.tsx:315` — "Quick add for today" via `<AddTaskButton>`.
- `app/(dashboard)/dashboard/calendar/MonthView.tsx` — calendar quick-add via `<AddTaskButton>`.
- Anywhere `<AddTaskButton>` is used (it's the unified task-create entry point — see `app/components/tasks/AddTaskButton.tsx`).
- **Schedule page is unaffected** because it uses a separate ad-hoc modal (`app/(dashboard)/schedule/schedule-page.modal.tsx`) that does not share `app/components/ui/Modal.tsx` and never calls `.focus()` programmatically.

### 🔴 ATM-1 — Root cause: shared `Modal` re-runs its initial-focus block on every parent render

The bug is in **`app/components/ui/Modal.tsx`**, not in `AddTaskButton`. The chain:

1. **`AddTaskButton.tsx:124-127`** passes an inline arrow function as `onClose`:
   ```tsx
   <Modal
     onClose={() => { if (saving) return; setOpen(false) }}
   ```
   This creates a *new function reference* on every render of `AddTaskButton`.

2. Inside **`Modal.tsx:60-65`**, `handleKey` is `useCallback(…, [onClose])` — so `handleKey` becomes a new reference whenever `onClose` is.

3. The main `useEffect` at **`Modal.tsx:67-93`** has `[open, handleKey, trapFocus]` in its dep array, so it re-runs on every parent render after the first.

4. Each re-run reaches lines 81–86:
   ```ts
   requestAnimationFrame(() => {
     const focusable = getFocusableElements(panelRef.current)
     if (focusable.length > 0) focusable[0].focus()
   })
   ```

5. `getFocusableElements` returns DOM-order focusables. The **first focusable element is the close (X) button in the modal header** at `Modal.tsx:133-143` — it precedes the body content in DOM order.

6. Net effect per keystroke: `setTitle` → `AddTaskButton` re-renders → fresh inline `onClose` → fresh `handleKey` → effect re-runs → focus snaps to the X. The user sees one character land in the input, then focus disappears.

### Why Schedule's `AddEventModal` is immune

`schedule-page.modal.tsx` is a separate portal-rendered component that does **not** use `Modal`. Its lone effect (lines 50-62) only registers an Escape-key listener and sets `document.body.style.overflow`. It never calls `.focus()` anywhere. Even if its effect re-ran, no focus would be stolen. Additionally, its parent passes a stable `useCallback`-wrapped `onClose` (`page.tsx:213-216`).

### Fix design (three layers, applied in `Modal.tsx`)

These are layered: each one alone would close the bug, but doing all three is the correct fix because each one defends against a different recurrence vector.

**Layer 1 — One-shot initial focus.**
Initial focus should fire exactly once per `false → true` open transition. Use a ref:

```tsx
const hasInitiallyFocusedRef = useRef(false)

useEffect(() => {
  if (!open) {
    hasInitiallyFocusedRef.current = false
    // …existing close handling
    return
  }

  // …existing event-listener registration

  if (!hasInitiallyFocusedRef.current) {
    hasInitiallyFocusedRef.current = true
    requestAnimationFrame(() => {
      // …focus block
    })
  }

  return () => { /* unchanged */ }
}, [open])  // ← only depend on open
```

**Layer 2 — Move `onClose` and key handlers behind a ref.**
The effect must not re-run when `onClose` changes. Stash live `onClose` in a ref that the keydown handler reads:

```tsx
const onCloseRef = useRef(onClose)
useEffect(() => { onCloseRef.current = onClose }, [onClose])

const handleKey = useCallback((e: KeyboardEvent) => {
  if (e.key === "Escape") onCloseRef.current()
}, [])  // ← stable forever
```

This pattern eliminates the entire class of "modal effect refires on parent re-render" bugs.

**Layer 3 — Don't focus the close button. Prefer the first form control or an explicit `initialFocusRef`.**
Two changes:

(a) Add an optional `initialFocusRef?: React.RefObject<HTMLElement>` prop to `Modal`. When set, focus that element on open instead of `focusable[0]`.

(b) When no `initialFocusRef` is provided, the autodetection should **skip the header close button** and prefer the first focusable inside the body. A simple `data-modal-close="true"` attribute on the X button + `:not([data-modal-close="true"])` filter does the job:

```tsx
const focusable = getFocusableElements(panelRef.current)
  .filter((el) => el.dataset.modalClose !== "true")
```

After Layer 3, `<input autoFocus />` inside the modal body just works without competition.

### Test acceptance

- Type "ABCDE" continuously into the Title field — all 5 characters land, focus stays in the input.
- Open the modal with keyboard (`Tab` to the trigger button → `Enter`) — focus lands on the Title input, not on the close button.
- `Tab` from the Title input cycles through Subject → Date → Duration → Create Task → close (X) → back to Title (focus trap intact).
- Same checks pass on Overview, Calendar, and any other `AddTaskButton` consumer.
- Schedule's `AddEventModal` continues to work as before (no regression — different component).
- Snapshot E2E test: 10 keystrokes in the Title field → final value === "ABCDEFGHIJ".

### Bonus: hardening to prevent recurrence

- Lint rule: forbid passing inline arrow functions as `onClose`/`onSubmit`/`onChange` to components annotated with `// @stable-handlers`. Custom ESLint rule, ~30 LOC.
- Storybook story: "Modal — input focus does not steal" with a Playwright interaction test.
- Codemod: scan all consumers of `Modal` for inline arrow `onClose` props; auto-wrap in `useCallback`.

---

## A5. Onboarding & First-Run

Already covered in audit §6, but adding two items that surfaced on a re-read:

### 🔴 ON-1 — `completeOnboarding` writes a non-existent column

(See audit §3.1 BUG 1.)

### 🔴 ON-2 — "Founder message" cross-page state via localStorage

`app/auth/signup/page.tsx:37` — `localStorage.setItem("showFounderMessage", "true")`. On signup. The `GlobalFounderMessage` component (`AppShell.tsx:14-17`) reads it. But:
- This breaks in incognito (no localStorage write blocked, but storage cleared on close).
- It triggers on every login if the user clears it via the toast but the localStorage key remains "true" elsewhere.
- A returning user who already saw it might see it again on a new device.

### 🟠 ON-3 — Email confirmation flow is unbranded and breaks the funnel

After signup, Supabase sends a default confirmation email. The user clicks the link and lands on a Supabase-themed redirect, *not* a PrepVeda welcome screen. We then route them back to `/auth/login` from where they're navigated to `/onboarding` only on next attempt. Three context-switches before they see your product again.

### Fix design (proposed)

- Configure Supabase's email templates with PrepVeda branding.
- After confirmation, redirect to `/auth/welcome` which auto-redirects to `/onboarding`.
- Replace localStorage signal with a `profiles.welcomed_at timestamptz` column.
- Add `email_verified_at` to gate access to dashboard until verified, but make the gate UX a friendly "Almost there — confirm your email" page, not a hard lockout.

---

# § B — Cross-Cutting Findings

These don't belong to any one feature; they affect everything.

### 🔴 CC-1 — Timezone is not a first-class concept

`getTodayLocalDate()` is the user's browser local. Server actions run in the deployment region's local time. **There is no `profiles.timezone`**. Every "today", "missed task", "streak", "earliest_start", "deadline" comparison silently mixes the two. Users in IST who plan at 11:30 PM see their task move to "tomorrow" the moment they cross midnight UTC. Streak comparisons can fire 5 hours early or 12 hours late depending on user/server geography.

### 🔴 CC-2 — Server actions don't use Zod for *inputs*

Audit §4.2. Add input schemas at every action boundary. Without this, "we have Zod" is a half-truth.

### 🟠 CC-3 — Optimistic UI is claimed widely, used in 5 files

Audit §13 reflects this. `useOptimistic` is used in `AddTaskButton`, `MonthView`, `DashboardTaskActions`, `RescheduleMissedButton`, and one subjects-data-table. Most other interactions use `setState` + `setIsBusy` + manual rollback. Inconsistent. Pick one pattern and apply it everywhere.

### 🟠 CC-4 — `revalidatePath` carpet bombing → SSR cache effectively disabled

Audit §2.2f. 89 calls across 18 files, often invalidating 4–5 routes per mutation. Switch to `revalidateTag` with tagged fetches.

### 🟠 CC-5 — No user-visible audit trail

A user can't see "what changed" in their plan / subjects / settings over time. We have `plan_snapshots` for plans, but no equivalent for everything else.

### 🟠 CC-6 — No notifications, no streaks-as-feature, no retention loop

A planner without daily nudges is a journal. We have all the data; no delivery layer.

### 🟢 CC-7 — Mixed styling systems

Audit §5.2 — Tailwind utilities + 2,462-line custom global CSS + inline `style={{ background: 'var(--…)' }}` everywhere. Pick one.

---

# § C — Cluster Overview & Dependency Graph

I'm splitting the work into **15 clusters** that can largely be parallelised. Where one cluster *blocks* another, the dependency arrow shows it.

```
                ┌────────────────────────┐
                │  CLUSTER A: TRIAGE      │  ← do first, blocks nothing
                │  (broken first-run,     │
                │   middleware, errors)   │
                └────────────┬────────────┘
                             │
   ┌─────────────────────────┼─────────────────────────────┐
   │                         │                             │
   ▼                         ▼                             ▼
┌───────────┐         ┌───────────┐              ┌────────────────┐
│ B: DB &   │         │ C: SERVER │              │ D: PLANNER      │
│  RPC      │◀───────▶│  ACTIONS  │              │  ENGINE         │
│           │         │  + AUTH   │              │                 │
└─────┬─────┘         └─────┬─────┘              └────────┬───────┘
      │                     │                             │
      ▼                     ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ E: UI / DESIGN SYSTEM         F: MOBILE-FIRST     G: ONBOARDING │
│ (TanStack table, tokens,      (responsive,         (interactive │
│  global CSS shrink)            touch DnD)           60s flow)   │
└─────────┬───────────────────────────┬──────────────────┬───────┘
          │                           │                  │
          ▼                           ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  H: PERFORMANCE        I: OBSERVABILITY      J: TESTING & QUALITY │
│     (image, bundle,       (Sentry, Pino,        (E2E, axe, fuzz, │
│      edge, real-time)      ops_events sink)      coverage gates) │
└─────────┬─────────────────────────┬─────────────────────┬───────┘
          │                         │                     │
          ▼                         ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  K: PRODUCT FEATURES   L: A11Y & i18n      M: DOCS & DEVEX        │
│   (notifications,       (jsx-a11y, ARIA,    (sync, Storybook,    │
│    streaks, .ics,        skip-link, NFC)     ADRs, runbook)      │
│    real-time, Stripe)                                             │
└─────────────────────────────────────┬────────────────────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │ N: SCHEDULE FIX PACK    │  ← cross-cluster
                          │   (DnD, header drop,    │     focused fix
                          │   touch sensor, etc.)   │
                          └────────────────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │ O: TIMEZONE PROJECT     │  ← cross-cluster
                          │   (profiles.timezone,   │     focused fix
                          │   single helper)        │
                          └────────────────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │ P: MODAL FOCUS FIX PACK │  ← runs in parallel
                          │   (Add-Task focus bug,  │     with Cluster A
                          │   onClose ref pattern,  │     during Phase 0
                          │   initialFocusRef API)  │
                          └────────────────────────┘
```

The **A → B/C/D** triage gate is non-negotiable — fixing the broken onboarding + middleware fail-open + raw-error leak before anything else stops the bleeding. From there, B/C/D can run in parallel as the foundation tracks. E/F/G build on those. H/I/J are continuous improvements that ride along. K/L/M are feature/quality verticals that come after the core is stable. N and O are tightly-scoped "fix packs" that span clusters and deliver a clean release.

---

# § D — Detailed Cluster Plans

## CLUSTER A — Triage (Days 1–3)

**Goal**: stop the bleeding. Every item here is either user-blocking or a security risk.

| # | Task | Files | Model |
|---|---|---|---|
| A.1 | Drop `onboarding_completed` from upsert | `app/actions/onboarding/completeOnboarding.ts:25-32` | Sonnet 4.6 |
| A.2 | `proxy.ts` profile-fetch error → redirect, not pass-through | `proxy.ts:84-94` | Sonnet 4.6 |
| A.3 | Generic message in `app/error.tsx`, log raw to logger | `app/error.tsx` | Sonnet 4.6 |
| A.4 | Add per-route-group `error.tsx` files with friendly copy | `app/(dashboard)/error.tsx`, `app/auth/error.tsx`, `app/onboarding/error.tsx` | Sonnet 4.6 |
| A.5 | Set CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy in `next.config.ts` | `next.config.ts` | Opus 4.7 (security nuance) |
| A.6 | Cap toast queue at 3, replace older with newer | `app/components/Toast.tsx` | Sonnet 4.6 |
| A.7 | Replace marketing "AI / deterministic" copy with honest language | `app/landingpage/page.tsx` | GLM-5.1 (copywriting) |
| A.8 | Remove `localStorage.setItem("showFounderMessage")` post-signup; replace with `profiles.welcomed_at` | `app/auth/signup/page.tsx`, `app/components/FounderMessageModal.tsx`, new migration | Sonnet 4.6 |
| A.9 | Stop `app/error.tsx` rendering `error.message` to user | `app/error.tsx:28-42` | Opus 4.6 Fast |
| **A.10** | **Fix Add-Task focus-stealing bug — apply all three layers in `Modal.tsx` (one-shot focus, onClose ref, skip close button)** | **`app/components/ui/Modal.tsx`, `app/components/tasks/AddTaskButton.tsx`** | **Opus 4.7** |
| A.11 | Add `data-modal-close="true"` attribute to all Modal close buttons; expose `initialFocusRef` prop | `app/components/ui/Modal.tsx`, all consumers | Sonnet 4.6 |
| A.12 | Codemod sweep: wrap inline `onClose={() => …}` in `useCallback` across all `<Modal>` consumers | `app/**/*.tsx` | Kimi K2.6 (cross-file) |

**Acceptance**: a brand-new account can complete onboarding without errors; raw stack traces never reach the UI; `curl -I /` shows CSP header; **typing 10 characters into the Add-Task title input lands all 10, focus never leaves the input**; `Tab` order inside the modal is body-first.

**Recommended model for cluster lead**: **Opus 4.7** for A.5 (security), Sonnet 4.6 for the rest.

---

## CLUSTER B — Database & RPC (Week 1–2)

**Goal**: schema parity with code, atomic bulk operations, canonical commit hash, soft delete, audit log.

| # | Task | Notes | Model |
|---|---|---|---|
| B.1 | Migration `0004_profiles_timezone.sql` adding `timezone text not null default 'UTC'` | Required for Cluster O | Sonnet 4.6 |
| B.2 | Migration `0005_planner_drafts.sql` — persist wizard draft per user | Replaces localStorage state | Sonnet 4.6 |
| B.3 | Migration `0006_audit_log.sql` — generic `audit_events(actor uuid, entity_kind text, entity_id uuid, action text, before jsonb, after jsonb, created_at)` | Cross-cuts | Opus 4.7 |
| B.4 | Migration `0007_soft_delete.sql` — `deleted_at timestamptz` on subjects/topics/tasks; update RLS | Avoids data loss | Opus 4.7 |
| B.5 | Migration `0008_subject_color.sql` — `subjects.color text` to stop positional palette | Calendar fix CAL-5 | DeepSeek V4 Pro |
| B.6 | Rewrite `commit_plan_atomic_v2_wrapper` — canonical hash from explicit fields, not `p_tasks::text` | Audit BUG 2 | Opus 4.7 (SQL nuance) |
| B.7 | Drop redundant `keep_mode='future'` branch (or actually differentiate it) | PL-6 | DeepSeek V4 Pro |
| B.8 | New RPC `bulk_reorder(table text, ids uuid[])` for atomic reorder | Audit BUG 3, SUBJ-4 | DeepSeek V4 Pro |
| B.9 | New RPC `unarchive_subject(id uuid)` clearing `deleted_at` and resolving name collisions | SUBJ-2 | DeepSeek V4 Pro |
| B.10 | New RPC `duplicate_subject(source uuid)` — clones subject + topics + topic_tasks, no dates | SUBJ-7 | DeepSeek V4 Pro |
| B.11 | Refactor `commit_plan_atomic_v2` to validate the JSONB array **once** (CTE), not 5× | Perf | Opus 4.7 |
| B.12 | Tighten `ops_events_owner_insert` policy — disallow null user_id from authenticated context | Audit §3.1 BUG 5 | Sonnet 4.6 |
| B.13 | Cron job: archive `plan_snapshots` older than 90 days to cold storage | Storage growth | DeepSeek V4 Pro |
| B.14 | Sync `lib/contracts/schemas.ts:plannerSettingsSchema` with actual SQL columns | Schema drift | Sonnet 4.6 |
| B.15 | Generate Supabase types via `supabase gen types typescript` and replace 207 `as` casts | Type safety | Kimi K2.6 (long context for sweeping refactor) |

**Acceptance**: CI runs migrations forwards on a clean DB; backwards-compat tests show Zod schemas match actual rows; a single click reorders 100 items via one RPC call.

**Recommended model for cluster lead**: **Opus 4.7** for B.3, B.6, B.11; **DeepSeek V4 Pro** for the more boilerplate SQL/RPC tasks; **Kimi K2.6** for B.15 (cross-file sweep).

---

## CLUSTER C — Server Actions & Auth (Week 1–3)

**Goal**: one auth pattern, Zod-validated inputs, rate limiting, real password reset.

| # | Task | Files | Model |
|---|---|---|---|
| C.1 | `withAuth(handler)` HOF that handles `getUser`, error mapping, telemetry | new `lib/server/withAuth.ts` | Opus 4.7 |
| C.2 | Rewrite all 27 actions to use `withAuth` and Zod input schemas | `app/actions/**/*.ts` | Sonnet 4.6 (mechanical) |
| C.3 | `mapPostgresError(e)` → user-safe code+copy; remove all raw error returns | new `lib/server/mapErrors.ts` | Sonnet 4.6 |
| C.4 | Move login/signup to Server Actions; kill browser-side `signInWithPassword` | `app/auth/login/page.tsx`, new `app/actions/auth/*.ts` | Opus 4.7 |
| C.5 | Password reset flow (request, verify, reset) | new `app/auth/reset/`, `app/actions/auth/resetPassword.ts` | Opus 4.7 |
| C.6 | Email change flow | new `app/dashboard/settings/account/`, action | Sonnet 4.6 |
| C.7 | Account deletion + GDPR export endpoint | new actions, RLS policies | Opus 4.7 |
| C.8 | Per-user rate limiter via `pg_advisory_xact_lock` or Upstash | new `lib/server/rateLimit.ts` | Opus 4.7 |
| C.9 | Replace `revalidatePath` carpet-bombing with tagged `revalidateTag` model | All actions, all reads | Opus 4.7 |
| C.10 | Stronger password policy (zxcvbn meter, min 10 chars, breached-password check via HIBP API) | signup/reset pages | Sonnet 4.6 |

**Acceptance**: one boilerplate-free action; cold curl with no cookie returns clean errors; password reset works end-to-end; rate limit holds at 30 mutations/min/user.

**Recommended model for cluster lead**: **Opus 4.7** for C.1, C.4, C.5, C.7, C.8, C.9 (architecture decisions); **Sonnet 4.6** for the per-file refactor pass.

---

## CLUSTER D — Planner Engine (Week 2–6)

**Goal**: deterministic, transparent, optionally optimal.

| # | Task | Files | Model |
|---|---|---|---|
| D.1 | Audit `engine.ts` for all `Map`/`Set` iterations; sort explicitly before iterating | `lib/planner/engine.ts` | Opus 4.7 |
| D.2 | Remove dead code (`isTopicSpacingOK`, `_loadRatio` param) | `engine.ts:842, 589` | Opus 4.6 Fast |
| D.3 | Make capacity-scaling user-visible; add `capacityScalingApplied` to `PlanResult` | `engine.ts:815-829`, `PlanPreview.tsx` | Opus 4.7 |
| D.4 | Property-based fuzz tests for the scheduler (`fast-check`) | new `tests/planner/scheduler.fuzz.test.ts` | DeepSeek V4 Pro |
| D.5 | Implement `diffPlans(prev, next)` returning `{ moved, added, removed, unchanged }` | new `lib/planner/diff.ts` | Opus 4.7 |
| D.6 | Plan-diff renderer in Confirm step | `PlanConfirm.tsx` | Sonnet 4.6 |
| D.7 | Spike: replace greedy with `Glpk.js` (GLPK wasm) ILP formulation | new branch `dev-v2-ilp` | Opus 4.7 |
| D.8 | Cache `generatePlanAction` result by input hash | `app/actions/planner/plan.ts` | Sonnet 4.6 |
| D.9 | Auto-fix: if `PARTIAL`, propose minimal capacity bump that converges | `engine.ts`, `PlanIssueModal.tsx` | Opus 4.7 |
| D.10 | "Recommended defaults" for capacity inputs from a 3-question wizard | `wizard-state.ts`, new step | Sonnet 4.6 |
| D.11 | Visual dependency DAG (`reactflow`) for topic dependencies | new `app/(dashboard)/planner/DependencyGraph.tsx` | Sonnet 4.6 |

**Acceptance**: same input twice → byte-identical plan; capacity scaling shown to user; 1k-fuzz seeds pass; plan diff visible.

**Recommended model for cluster lead**: **Opus 4.7** for D.1/D.3/D.5/D.7/D.9 (algorithmic); **DeepSeek V4 Pro** for D.4 (fuzz); **Sonnet 4.6** for the rest.

---

## CLUSTER E — UI / Design System (Week 2–8)

**This cluster contains the work where I'll consult with you before doing major changes** (see §G).

| # | Task | Files | Model | Escalate to user? |
|---|---|---|---|---|
| E.1 | Inventory current components, document tokens, identify clashes | new `docs/DESIGN_SYSTEM.md` | Opus 4.7 | No |
| E.2 | Replace inline `style={{ background: 'var(--…)' }}` with utility classes / token props | All `.tsx` files | Sonnet 4.6 | No (mechanical) |
| E.3 | Shrink `globals.css` from 2,462 → ~600 lines (move to per-component CSS modules or Tailwind components layer) | `app/globals.css` | Kimi K2.6 (long context) | **Yes, present plan first** |
| E.4 | Replace 2,770-line `subjects-data-table.tsx` (planner) with `@tanstack/react-table` consumer (~300 lines) | `app/(dashboard)/planner/subjects-data-table.tsx` and forks | Kimi K2.6 | **Yes, present plan first** |
| E.5 | Same for `dashboard/subjects/subjects-data-table.tsx` | Same | Kimi K2.6 | Yes |
| E.6 | Adopt `class-variance-authority` for variant components (Button, Badge, Tabs) | `app/components/ui/*` | Sonnet 4.6 | No |
| E.7 | Toast: add "undo" affordance, queue cap, dedupe | `app/components/Toast.tsx` | Sonnet 4.6 | No |
| E.8 | Sidebar: collapsible groups, command palette (cmd-k) | `app/components/layout/Sidebar.tsx` | Opus 4.6 Fast | No |
| E.9 | Storybook scaffolding for `app/components/ui/*` | new `.storybook/` | Sonnet 4.6 | No |
| E.10 | Visual regression (Chromatic) wired into CI | `.github/workflows/visual.yml` | DeepSeek V4 Pro | No |

**Recommended model for cluster lead**: **Opus 4.7** for E.1; **Kimi K2.6** for E.3/E.4/E.5 (huge files); **Sonnet 4.6** for E.2/E.6/E.7/E.9.

---

## CLUSTER F — Mobile-First (Week 3–6)

**Goal**: real responsive UX, not desktop-with-shrink.

| # | Task | Files | Model |
|---|---|---|---|
| F.1 | Replace 7-column schedule grid with **vertical agenda** on viewport <768 px | `app/(dashboard)/schedule/page.tsx` | Opus 4.7 |
| F.2 | Subject table → card list on mobile | both subjects-data-table forks | Sonnet 4.6 |
| F.3 | Calendar month view → horizontal-scroll week strip + selected-day list on mobile | `MonthView.tsx` | Opus 4.7 |
| F.4 | Replace DnD-Kit with **long-press** activation for mobile schedule | new `useTouchSensor` config | Sonnet 4.6 |
| F.5 | Bottom-tab navigation on mobile (Today, Schedule, Subjects, More) | new `app/components/layout/MobileNav.tsx` | Sonnet 4.6 |
| F.6 | Audit landing/auth/onboarding for mobile-broken `hidden lg:block` patterns | landingpage, auth/* | Opus 4.6 Fast |
| F.7 | PWA manifest + install prompt | `app/manifest.ts`, `next.config.ts` | DeepSeek V4 Pro |
| F.8 | Service worker for offline read of today's tasks | new `public/sw.js` or Workbox | Opus 4.7 |

**Recommended model for cluster lead**: **Opus 4.7** for F.1/F.3/F.8 (architecture); **Sonnet 4.6** for the per-screen rewrites.

---

## CLUSTER G — Onboarding & First-Run (Week 1–4)

**Goal**: <60 s from signup to first plan committed.

| # | Task | Files | Model |
|---|---|---|---|
| G.1 | Replace 6-slide carousel with interactive 3-step inline onboarding | `app/components/onboarding/TutorialWizard.tsx` (delete) → new flow inside `/dashboard/subjects` | Opus 4.7 |
| G.2 | Sample-data scaffolding: a "Try with sample data" button in the empty Subjects view | new `app/actions/onboarding/seedSample.ts` | Sonnet 4.6 |
| G.3 | First-time tooltips inside Schedule, Calendar, Planner using `floating-ui` | new `lib/onboarding/tour.ts` | Sonnet 4.6 |
| G.4 | Branded email confirm flow (custom Supabase template + `/auth/welcome`) | Supabase config + `app/auth/welcome/page.tsx` | GLM-5.1 (copy) |
| G.5 | "Why this is taking so long?" microcopy on slow paths | various | GLM-5.1 |
| G.6 | Streak / first-task celebration moment | new component | Sonnet 4.6 |
| G.7 | Drop ~9 MB of onboarding PNGs from preload; lazy-load only the active flow | `TutorialWizard.tsx:469`, `next.config.ts` images | Opus 4.6 Fast |

**Recommended model for cluster lead**: **Opus 4.7** for G.1 (UX architecture); **Sonnet 4.6** for the implementation; **GLM-5.1** for copy.

---

## CLUSTER H — Performance & Scalability (Week 3–8)

| # | Task | Notes | Model |
|---|---|---|---|
| H.1 | Push profile claim into JWT `app_metadata.has_profile`; drop middleware DB read | `proxy.ts`, hook on profile insert | Opus 4.7 |
| H.2 | Tag-based caching: `unstable_cache + revalidateTag` per user | All reads | Opus 4.7 |
| H.3 | Image pipeline: AVIF/WebP variants, `next/image` priority hierarchy, responsive `sizes` | `next.config.ts`, all `<Image>` usages | DeepSeek V4 Pro |
| H.4 | Bundle size budget enforcement (fail CI on regression) | `scripts/check-bundle-size.mjs`, CI | DeepSeek V4 Pro |
| H.5 | Code-split heavy routes (`subjects-data-table` via `dynamic(() => …)`) | imports | Sonnet 4.6 |
| H.6 | Replace 4-state hooks in `schedule/page.tsx` with one reducer | `app/(dashboard)/schedule/page.tsx` | Kimi K2.6 |
| H.7 | Edge runtime for read-only Server Components (where Supabase SSR allows) | `runtime: 'edge'` exports | Opus 4.7 |
| H.8 | React Query (or `swr`) for client-side data freshness in schedule/calendar | wrap `useEffect`-based fetches | Sonnet 4.6 |
| H.9 | Debounce reorder client → server | `useDayOrder.ts`, subjects reorder UI | Sonnet 4.6 |
| H.10 | Lighthouse CI gating on PR (perf/a11y/seo) | `.github/workflows/lighthouse.yml` | DeepSeek V4 Pro |

**Recommended model for cluster lead**: **Opus 4.7** for H.1/H.2/H.7 (architecture); **DeepSeek V4 Pro** for H.3/H.4/H.10 (DevOps); **Sonnet 4.6** for the rest.

---

## CLUSTER I — Observability & Ops (Week 2–5)

| # | Task | Notes | Model |
|---|---|---|---|
| I.1 | Sentry integration (frontend + Server Actions) with release tracking | `sentry.client.config.ts`, `sentry.server.config.ts` | Opus 4.7 |
| I.2 | Replace ad-hoc `logger.ts` with `pino` structured logger; pipe to a sink | `lib/ops/logger.ts` | Sonnet 4.6 |
| I.3 | `ops_events` → BI sink (Supabase → Logflare or Datadog) | new edge function or webhook | DeepSeek V4 Pro |
| I.4 | `/api/health` and `/api/ready` endpoints | new | DeepSeek V4 Pro |
| I.5 | Status page (statuspage.io or homemade route) | new `app/status/page.tsx` | DeepSeek V4 Flash |
| I.6 | Backup verification — weekly automated restore-test against a sandbox DB | new `.github/workflows/restore-test.yml` | Opus 4.7 |
| I.7 | Runbook for top-5 incidents (DB outage, RLS misfire, planner stuck, mass commit failure, auth incident) | new `docs/RUNBOOK.md` | GLM-5.1 |
| I.8 | Synthetic monitoring: Playwright check every 5 min in CI on critical path | new `.github/workflows/synthetic.yml` | DeepSeek V4 Pro |

**Recommended model for cluster lead**: **Opus 4.7** for I.1/I.6 (architecture); **DeepSeek V4 Pro** for the DevOps pipeline tasks; **GLM-5.1** for runbook narrative.

---

## CLUSTER J — Testing & Quality Gates (Week 2–6)

| # | Task | Notes | Model |
|---|---|---|---|
| J.1 | Real E2E flow: signup → onboarding → first subject → first chapter → 3 tasks → step-1 → step-2 → step-3 → commit → schedule visible | new `e2e/critical-path.spec.ts` | Opus 4.7 |
| J.2 | E2E for plan-edit flow: complete a task, drag a task, mark missed, reschedule | new `e2e/schedule.spec.ts` | Sonnet 4.6 |
| J.3 | DB integration tests via Testcontainers (Postgres + RLS) | new `tests/db/*.test.ts` | Opus 4.7 |
| J.4 | Property-based tests for engine (already in D.4) | — | DeepSeek V4 Pro |
| J.5 | A11y tests via `@axe-core/playwright` on all 7 main routes | extend e2e | Sonnet 4.6 |
| J.6 | Visual regression (Chromatic, already in E.10) | — | DeepSeek V4 Pro |
| J.7 | Coverage threshold ≥85% on `lib/`, ≥70% on `app/actions/` (vitest config) | `vitest.config.ts` | Sonnet 4.6 |
| J.8 | k6 load test: 1k concurrent users, 95p < 300 ms on dashboard | new `tests/load/*.js` | DeepSeek V4 Pro |
| J.9 | Mutation tests via Stryker (every 2 weeks in CI) | `.github/workflows/stryker.yml` | DeepSeek V4 Flash |
| J.10 | CI fail on `console.log` left in code | eslint rule | DeepSeek V4 Flash |

**Recommended model for cluster lead**: **Opus 4.7** for J.1/J.3 (test architecture); **DeepSeek V4 Pro** for J.4/J.6/J.8 (infra-y testing); **Sonnet 4.6** for J.2/J.5/J.7.

---

## CLUSTER K — Product Features (Week 5–12)

This is where the audit's 4.0 Product/CXO score gets repaired.

| # | Task | Notes | Model |
|---|---|---|---|
| K.1 | Email reminders (deadline approaching, daily nudge, streak warning) via Resend / Supabase Functions | new edge functions, `notifications` table, scheduling | Opus 4.7 |
| K.2 | In-app notifications centre + read state | new component, table | Sonnet 4.6 |
| K.3 | Web push notifications (PWA-aware) | `public/sw.js`, VAPID keys | Opus 4.7 |
| K.4 | `.ics` calendar export per subject and full schedule | new `app/api/calendar/[token]/route.ts` | DeepSeek V4 Pro |
| K.5 | Streak features: freeze (1×/week), share streak card, restore streak via grace day | new actions, RPC, UI | Sonnet 4.6 |
| K.6 | Multi-goal support (Prelims + Mains + GATE simultaneously) — namespace per `goal_id` | schema migration, all queries | Opus 4.7 |
| K.7 | Real-time updates: `supabase.channel('tasks')` so two open tabs stay in sync | new `lib/realtime/*.ts` | Opus 4.7 |
| K.8 | Sharable plan link (`/share/:hash` read-only view) | new route, RLS policy | Sonnet 4.6 |
| K.9 | Stripe billing (Free / Pro tiers, paywall on multi-goal & .ics) | new actions, webhooks | Opus 4.7 |
| K.10 | Account deletion + data export (PDF + JSON) | new actions | Sonnet 4.6 |
| K.11 | Pomodoro timer integration on the schedule page | new component | MiniMax M2.7 |
| K.12 | Google Calendar two-way sync (later, premium-tier) | OAuth + webhook | Opus 4.7 |

**Recommended model for cluster lead**: **Opus 4.7** for K.1/K.3/K.6/K.7/K.9/K.12 (system design); **Sonnet 4.6** for the smaller features.

---

## CLUSTER L — Accessibility & i18n (Week 4–8)

| # | Task | Notes | Model |
|---|---|---|---|
| L.1 | Install `eslint-plugin-jsx-a11y`, fix all errors | `eslint.config.mjs` | Sonnet 4.6 |
| L.2 | Audit all icons; add `aria-label` or `aria-hidden` consistently | All `<svg>` | Opus 4.6 Fast |
| L.3 | Skip-link, route-change focus management | `app/components/layout/AppShell.tsx` | Sonnet 4.6 |
| L.4 | Reduce motion respect for landing page carousels | `app/landingpage/page.tsx` | Sonnet 4.6 |
| L.5 | NFC-normalise + Unicode confusables block list | `lib/constants.ts:isReservedSubjectName` | DeepSeek V4 Pro |
| L.6 | i18n scaffold via `next-intl`; extract all strings | new `messages/en.json`, all components | Kimi K2.6 (long context) |
| L.7 | Hindi + English locales as v1 (PrepVeda's market) | new `messages/hi.json` | GLM-5.1 |
| L.8 | RTL prep (CSS logical properties) | `globals.css`, components | Sonnet 4.6 |

**Recommended model for cluster lead**: **Sonnet 4.6** for L.1/L.3/L.4/L.8; **Opus 4.6 Fast** for L.2; **Kimi K2.6** for L.6 (huge sweep); **GLM-5.1** for L.7 translations.

---

## CLUSTER M — Documentation & Dev Experience (Week 1–ongoing)

| # | Task | Model |
|---|---|---|
| M.1 | Sync `docs/ARCHITECTURE.md` to actual code (audit shows drift) | GLM-5.1 |
| M.2 | New `docs/RUNBOOK.md` (already in I.7) | GLM-5.1 |
| M.3 | New `docs/ADR/0001-…` Architecture Decision Records for: TanStack table, JWT-claim-based auth, ILP solver | Opus 4.7 |
| M.4 | Storybook (already in E.9) | — |
| M.5 | Auto-generated API docs from JSDoc → `docs/api/` | DeepSeek V4 Flash |
| M.6 | Dev onboarding script: `npm run dev:bootstrap` seeds local DB with sample data | DeepSeek V4 Pro |
| M.7 | Pre-commit hooks (`husky` + `lint-staged`): ESLint, Prettier, typecheck on changed files | DeepSeek V4 Flash |
| M.8 | Dependabot weekly + auto-merge for minor dev deps | `.github/dependabot.yml` | DeepSeek V4 Flash |

**Recommended model for cluster lead**: **GLM-5.1** for narrative docs; **DeepSeek V4 Pro/Flash** for tooling.

---

## CLUSTER N — Schedule Fix Pack (Week 2)

A focused, time-boxed sprint that closes the user's specific complaint plus all the related schedule bugs.

| # | Task | Files | Model |
|---|---|---|---|
| N.1 | Make `(day-of-week + date)` header strip droppable | `page.tsx:737-751` | Sonnet 4.6 |
| N.2 | Decide past-date policy (recommend allow with affordance), apply to `rescheduleTask.ts:33` | `rescheduleTask.ts`, `page.tsx:464` | Opus 4.7 |
| N.3 | Persist same-day reorder to DB via new `reorderTasksOnDate` server action | new action + page wiring | Sonnet 4.6 |
| N.4 | Replace `event.activatorEvent.clientY` with proper drop-pointer math | `page.tsx:492-509` | Opus 4.7 |
| N.5 | Add `TouchSensor` with `delay: 250, tolerance: 5`; remove 4-px PointerSensor for touch | `page.tsx:660` | Sonnet 4.6 |
| N.6 | Cap `useDayOrder` to last 12 weeks; expire older | `useDayOrder.ts` | Sonnet 4.6 |
| N.7 | Validate cross-topic placement on reschedule (max-sessions-per-day, ordering) | `rescheduleTask.ts` | Opus 4.7 |
| N.8 | Visually grey-out columns where drop is not allowed | `DayColumn.tsx` | Sonnet 4.6 |
| N.9 | E2E test for every scenario: same-day reorder, cross-day move, past-date attempt, mobile long-press, header drop | `e2e/schedule.spec.ts` | Sonnet 4.6 |

**Acceptance**: drag works on mouse, touch, and keyboard; column header is a valid target; past-date policy is consistent across UI and server; ordering survives device switches.

**Recommended model for cluster lead**: **Opus 4.7** (this is the user's marquee bug; depth matters).

---

## CLUSTER P — Modal Focus Fix Pack (Days 1–3, in parallel with Cluster A)

**Goal**: kill the Add-Task focus-stealing bug at its root and prevent the entire class of "modal re-runs effects on parent render" issues. Small, focused, urgent — runs concurrently with Cluster A triage and shares the same release.

### Why this is its own pack

The bug spans three concerns: (1) a generic `Modal` component used by many surfaces, (2) every consumer that passes inline `onClose` arrows, (3) implicit DOM-order assumptions about which element receives initial focus. Treating it as a single named pack guarantees we close all three rather than patching one consumer at a time.

| # | Task | Files | Model |
|---|---|---|---|
| P.1 | Layer 1 — one-shot initial focus via `hasInitiallyFocusedRef` | `app/components/ui/Modal.tsx:67-93` | Opus 4.7 |
| P.2 | Layer 2 — move `onClose` to a ref; reduce effect deps to `[open]`; stable `handleKey` / `trapFocus` | `app/components/ui/Modal.tsx:60-93` | Opus 4.7 |
| P.3 | Layer 3a — add `data-modal-close="true"` to header X button | `app/components/ui/Modal.tsx:133-143` | Sonnet 4.6 |
| P.4 | Layer 3b — `getFocusableElements` skips `[data-modal-close="true"]` | `app/components/ui/Modal.tsx:26-28` | Sonnet 4.6 |
| P.5 | Layer 3c — accept optional `initialFocusRef?: RefObject<HTMLElement>` prop | `Modal.tsx`, type signature | Sonnet 4.6 |
| P.6 | Wire `AddTaskButton` to use `initialFocusRef` pointing at the title input; remove `autoFocus` (avoid double-focus) | `app/components/tasks/AddTaskButton.tsx:136-148` | Sonnet 4.6 |
| P.7 | Codemod: wrap every inline `onClose={() => …}` (and `onSubmit`, `onChange` on shared modal-like primitives) in `useCallback` across all consumers | `app/**/*.tsx` | Kimi K2.6 (cross-file sweep) |
| P.8 | Audit other components with the same pattern: `Dropdown`, `Tabs`, `FounderMessageModal`, `PlanIssueModal`, `SubjectDrawer` | `app/components/ui/Dropdown.tsx`, `app/components/ui/Tabs.tsx`, `app/components/FounderMessageModal.tsx`, `app/(dashboard)/planner/components/PlanIssueModal.tsx`, `app/(dashboard)/planner/SubjectDrawer.tsx` | Opus 4.7 |
| P.9 | E2E test: type 10 chars in Add-Task title → final value matches; tab order is correct; same on Calendar quick-add | new `e2e/add-task-focus.spec.ts` | Sonnet 4.6 |
| P.10 | Component test: keystroke loop on Modal-wrapped form retains focus | new `tests/components/ui/Modal.focus.test.tsx` | Sonnet 4.6 |
| P.11 | Lint rule (custom ESLint plugin) preventing inline arrow handlers on `<Modal>` going forward | new `eslint-rules/no-inline-modal-handlers.js` | DeepSeek V4 Pro |
| P.12 | Storybook entry: "Modal — focus stability under re-render" with a Playwright interaction test | `.storybook/` | Sonnet 4.6 |

### Acceptance criteria

- ✅ Typing "ABCDE" into the Add Task title input lands all 5 characters; focus stays in the input throughout.
- ✅ Opening the modal via keyboard (Tab → Enter) lands focus on the Title input, not the X button.
- ✅ `Tab` cycles Title → Subject → Date → Duration → Create → X → Title (trap intact, body-first).
- ✅ Schedule's "Add Event" modal still works (no regression — separate component, but P.8 audits any siblings).
- ✅ E2E and component tests in P.9/P.10 are green in CI.
- ✅ Lint rule from P.11 catches future inline-arrow regressions on PRs.

### Phase 0 inclusion

Cluster P is added to **Phase 0 (Triage)** alongside Cluster A. Phase 0 is no longer "A only" — it is **"A + P"**, and the Phase 0 DoD now includes "Add Task input focus is stable across all consumers".

**Recommended model for cluster lead**: **Opus 4.7** (the two architectural fixes in P.1/P.2/P.8 require depth; the rest is mechanical).

---

## CLUSTER O — Timezone Project (Week 3)

A focused sprint that makes timezone a first-class concept everywhere.

| # | Task | Notes | Model |
|---|---|---|---|
| O.1 | Migration: `profiles.timezone text not null default 'UTC'` | B.1 | Sonnet 4.6 |
| O.2 | New `lib/dates/userTimezone.ts` — single source for "what is today for this user" | new file | Opus 4.7 |
| O.3 | Replace all `getTodayLocalDate()` callers with the timezone-aware helper | grep + sweep | Kimi K2.6 (cross-file) |
| O.4 | Onboarding step: detect TZ from `Intl.DateTimeFormat().resolvedOptions().timeZone`, ask to confirm | `/onboarding` flow | Sonnet 4.6 |
| O.5 | Settings: change timezone | `dashboard/settings` | Sonnet 4.6 |
| O.6 | Streak comparison uses user's local "today", not server's | `dashboard/getStreak.ts` | Opus 4.7 |
| O.7 | All deadline / earliest_start checks use user TZ | engine, repository | Opus 4.7 |

**Acceptance**: a user in `Asia/Kolkata` and a user in `America/Los_Angeles` get correct "today" / "missed" / "streak" / "deadline" semantics simultaneously.

**Recommended model for cluster lead**: **Opus 4.7**.

---

# § E — Phase Plan

A weekly cadence. Each phase has a clear definition of done. Clusters run in parallel; phases gate releases.

## Phase 0 — Triage Release (Days 1–3)
**Clusters: A + P (in parallel).**
**DoD**: First-run onboarding works; raw errors gone; CSP set; toast queue capped; honest marketing copy; **Add-Task modal input focus is stable across Overview, Calendar, and every other AddTaskButton surface — typing 10 characters lands all 10**; sibling modal components (`PlanIssueModal`, `FounderMessageModal`, `SubjectDrawer`) audited for the same focus-stealing pattern.
**Composite score after**: 5.0 → **6.0**

## Phase 1 — Foundation Release (Weeks 1–3)
**Clusters: B, C, G, M (in parallel).**
**DoD**: All actions Zod-validated and `withAuth`-wrapped; password reset works; profile draft state in DB; sample-data flow live; first-run path is interactive (not slideshow); migrations 0004–0008 applied.
**Composite score after**: 6.0 → **7.0**

## Phase 2 — Core-Feature Release (Weeks 2–6)
**Clusters: D, E, F, N, O (in parallel).**
**DoD**: Schedule fix pack landed (DnD, headers droppable, mobile long-press, past-date policy applied consistently, ordering persisted); subjects table unified on TanStack; mobile schedule = vertical agenda; planner shows capacity-scaling banner; plan diff visible; timezone first-class.
**Composite score after**: 7.0 → **8.5**

## Phase 3 — Quality Release (Weeks 4–8)
**Clusters: H, I, J, L (in parallel, on top of Phase 2).**
**DoD**: Sentry live; coverage gates passing; Lighthouse CI green; a11y errors eliminated; bundle budget enforced; load test 95p<300 ms; visual regression in CI; i18n scaffold (en + hi).
**Composite score after**: 8.5 → **9.3**

## Phase 4 — Product Release (Weeks 6–12)
**Cluster: K.**
**DoD**: Email reminders, in-app notifications, .ics export, real-time, streak features, sharable plan link, account deletion + GDPR export, multi-goal support, Stripe billing.
**Composite score after**: 9.3 → **9.8**

## Phase 5 — Polish Release (Weeks 10–14)
**Cross-cluster polish, performance tuning, design-system pass, premium polish.**
- Web push notifications.
- Pomodoro integration.
- Service worker for offline today's-tasks read.
- Google Calendar sync (premium tier).
- Storybook published, ADRs published, runbook live.
**Composite score after**: 9.8 → **10.0** ✅

---

# § F — Model Selection Guide

You listed Opus 4.7, Sonnet 4.6, Opus 4.6 (Fast), plus the OpenCode Go / OpenCode Zen lineup. Here's how I'd actually use them given the work in this plan.

| Model | Best at | Use for |
|---|---|---|
| **Opus 4.7** | Deep reasoning, security, architecture, cross-file judgment | Cluster A.5 (CSP), B.3/B.6/B.11, C.1/C.4/C.5/C.7/C.8/C.9, D.1/D.3/D.5/D.7/D.9, E.1, F.1/F.3/F.8, G.1, H.1/H.2/H.7, I.1/I.6, J.1/J.3, K.1/K.3/K.6/K.7/K.9/K.12, M.3, N.2/N.4/N.7, O.2/O.6/O.7 — i.e., anywhere a wrong decision compounds |
| **Sonnet 4.6** | Reliable mid-complexity implementation, mechanical refactors, component work | Most of the per-file passes in B, C, E, F, G; Toast/UI work; standard component implementation |
| **Opus 4.6 (Fast)** | Quick polish iterations, code review, copy-edits in code | A.6 (toast cap polish), A.9, D.2 (dead code removal), G.7, L.2 — short, well-scoped tasks where output speed matters more than depth |
| **Kimi K2.6 (3× limits)** | Huge-context refactors of single 2,000+-line files, codebase-wide sweeps | E.3, E.4, E.5 (data table forks), B.15 (replace all `as` casts), H.6 (schedule reducer), L.6 (i18n extraction), O.3 (TZ helper sweep) — anywhere context length is the binding constraint |
| **DeepSeek V4 Pro** | Algorithmic / DevOps / SQL polish; strong reasoning | B.5, B.7, B.8, B.9, B.10, B.13 (RPC/SQL); D.4 (fuzz); E.10 (Chromatic CI); H.3, H.4, H.10 (image pipeline / bundle / Lighthouse); I.3, I.4, I.8 (BI sink, health, synthetic); J.4, J.6, J.8 (testing infra); K.4 (.ics); L.5 (Unicode); M.6 (bootstrap); — workhorse for "smart but not Opus" tasks |
| **DeepSeek V4 Flash** | Fast boilerplate, simple CI scripts, comment cleanups | I.5 (status page); J.9, J.10 (Stryker, eslint rule); M.5, M.7, M.8 (docs gen, husky, dependabot) — high-volume low-risk |
| **MiniMax M2.7** (and 2.5) | General coding, smaller features | K.11 (Pomodoro) — discrete component-y additions |
| **MiMo V2 Pro / V2.5 Pro** | Reasonable coding fallback | If Sonnet 4.6 is busy, swap in for Sonnet-tier work |
| **Qwen3.6 Plus / 3.5 Plus** | Tests, simple component implementations | J.2 (E2E), J.5 (a11y) where Sonnet is overkill |
| **GLM-5.1 / GLM-5** | Documentation, copy, narrative | A.7 (marketing), G.4, G.5 (microcopy), I.7 (runbook), L.7 (Hindi translations), M.1, M.2 (docs sync) |
| **MiniMax M2.5 Free** | Quick polish / one-shot tweaks | UI polish, last-mile copy, free-quota tasks |

### Practical heuristics
1. **Anything that touches RLS, auth, billing, or the planner engine → Opus 4.7.** Wrong here = lost users / data.
2. **Anything that's a per-file refactor → Sonnet 4.6.** Predictable, fast, well-scoped.
3. **Anything spanning 5+ files or a single >1,500-line file → Kimi K2.6.** Context wins.
4. **Anything DevOps / CI / SQL polish → DeepSeek V4 Pro.** Strong reasoning, lower cost than Opus.
5. **Anything narrative (docs, copy, runbooks, translations) → GLM-5.1.** Wins on tone.
6. **Anything fast-iterative (small UI polish, code review, dead-code) → Opus 4.6 Fast.**

---

# § G — UI/Design Escalation Policy

You said: minor UI fixes are mine, but major design-system rework should come back to you for direction. Here's how I'll classify in practice.

### I'll do directly (no escalation)
- Alignment, spacing, padding, hover states, focus rings, micro-animations.
- Replacing `style={{ background: 'var(--…)' }}` with utility classes.
- Toast queue cap, "undo" affordance.
- Empty-state illustrations and microcopy.
- Adding tooltips / info icons.
- Fixing accessibility issues (aria-label, focus management).
- Mobile layout fixes for individual pages.

### I'll bring to you first (escalation)
- **E.3** — Shrinking `globals.css` from 2,462 → ~600 lines. This is a system-level decision: do we go pure Tailwind, CSS Modules per component, or `panda-css`? You should pick.
- **E.4 / E.5** — Replacing the 2,770-line subjects-data-table forks with TanStack Table. Material UX consequence; I'll prepare a side-by-side mock first.
- **F.1** — Schedule mobile vertical agenda. Big interaction redesign; I'll wireframe two options first.
- **F.5** — Bottom-tab nav on mobile. Information architecture change.
- **G.1** — Replacing the 6-slide carousel onboarding. Brand-defining moment.
- **A.7** — Marketing copy honesty pass. Brand voice — your call.
- **K.9** — Stripe pricing & paywall design. Business model.
- **K.6** — Multi-goal data model. Product scope.
- Any change to the **brand colour palette**, **logo**, **typography choice**, or the **landing-page layout** itself.

### My escalation format

When I bring a design decision to you, I'll send:
1. **Status quo** — what currently exists, with file references.
2. **2–3 alternatives** — each with pros, cons, effort, and risk.
3. **My recommendation** — the one I'd pick, with reasoning.
4. **Asked of you** — explicit single-question form ("Pick A, B, or C; or describe option D").

This way you decide direction in <60 seconds per item.

---

# § H — Acceptance Criteria for "10/10"

The composite score reaches **10/10** when *all* of the following are true:

| Dimension | Target |
|---|---|
| **Engineering quality** | All hotspot files <600 lines; zero `as` casts in app code; coverage ≥85% on `lib/`, ≥70% on `app/actions/`. |
| **Architecture** | One auth pattern; one cache pattern; one styling system; no fork of any component. |
| **Database & backend** | All RPCs validated once; canonical commit hashes; soft delete + audit log live; `profiles.timezone` populated; bulk reorder atomic. |
| **Scalability** | Middleware DB-free; bundle budget enforced; image pipeline shipping AVIF; edge runtime where safe; load test 95p<300 ms; real-time subscriptions wired. |
| **Security** | CSP + headers set; passwords ≥10 chars + breach check; rate limiting active; raw Postgres errors invisible; account deletion works. |
| **UI/UX visual** | Storybook live; tokens unified; `globals.css` <600 lines; Chromatic green. |
| **First-time UX** | <60 s from signup to first plan committed; sample-data path works; in-app contextual help; branded email confirmation. |
| **Mobile** | Vertical-agenda schedule; card-list subjects; bottom-tab nav; long-press DnD; PWA installable; offline today's-tasks. |
| **Reliability** | Zero P0/P1 from §A; Sentry live; backups verified by automated restore-tests; **Add-Task modal focus stable across all surfaces**; lint rule prevents inline-handler regressions on `<Modal>`. |
| **Observability** | Sentry, Pino, BI sink, health endpoints, status page, runbook all live. |
| **Testing** | Critical-path E2E green; a11y axe green; visual regression green; fuzz tests for engine; Lighthouse CI green; mutation tests above threshold. |
| **Documentation** | Architecture, runbook, ADRs, Storybook all up to date. Drift checked weekly in CI. |
| **Product** | Notifications, .ics, streaks, sharable plans, multi-goal, billing, account deletion, GDPR export, real-time. |

### Composite score progression (target)
- After Phase 0 (Day 3): **6.0**
- After Phase 1 (Week 3): **7.0**
- After Phase 2 (Week 6): **8.5**
- After Phase 3 (Week 8): **9.3**
- After Phase 4 (Week 12): **9.8**
- After Phase 5 (Week 14): **10.0** ✅

---

# § I — Modernisation Opportunities (Beyond the Obvious)

You asked about modern tools / advanced integrations. Here are the bets I'd take if I were in your seat.

### High-leverage, low-risk
- **TanStack Table** for both data-table forks. Single source of truth. **Already in plan (E.4/E.5).**
- **TanStack Query** for client-side data freshness, removing every `useEffect` data-fetch. **Already in plan (H.8).**
- **Zod-to-Postgres codegen** (`@neondatabase/serverless`-style) so schema and Zod can't drift. **Plan: B.15.**
- **`next-safe-action`** for Server Actions with built-in Zod input validation, error mapping, and middleware. **Replaces my custom `withAuth` HOF (C.1).**
- **`drizzle-orm`** as a thin replacement for raw `supabase.from('…').select(…)` calls. Type-safe SQL with migration generation. Worth a spike.
- **`shadcn/ui`** for the UI component layer (instead of hand-rolling 9 primitives). Drop-in replacement for `app/components/ui/*`.
- **`cmdk`** for a command palette (cmd-k navigation). 30-line install, big UX win.
- **`floating-ui`** for tooltips, popovers, contextual help (replaces ad-hoc dropdowns). **Plan: G.3.**
- **`zustand`** for the small amount of cross-component state where context is overkill (e.g. drag-state, toast queue).

### Medium-leverage, medium-risk
- **Replace greedy scheduler with `Glpk.js` or `OR-Tools wasm`.** Real ILP. Feasible at scale of 200 topics × 365 days. **Plan: D.7.**
- **Supabase Realtime** for instant cross-tab sync. **Plan: K.7.**
- **Vercel Edge Functions** for read-only Server Components. **Plan: H.7.**
- **Resend** (or AWS SES) for transactional email + a small templating system. **Plan: K.1.**
- **Upstash Redis** for rate-limiting and ephemeral caching. **Plan: C.8.**
- **Trigger.dev / Inngest** for background jobs (deadline reminders, snapshot cleanup, weekly digest). Cleaner than cron.
- **PostHog** (self-hosted) for product analytics — heatmaps, funnels, feature flags in one box.

### High-leverage, high-risk (consider for v2)
- **AI-assisted intake**: a "describe your exam in a sentence" textarea that LLM-extracts subjects and chapters. Real differentiator vs. competitors. Requires moderation, latency budget, fallback UX.
- **Vector embeddings of topic content** for "you should also study X" recommendations across users (privacy-preserving via differential privacy or strict consent).
- **CRDT-backed offline sync** (`y-supabase` or `Automerge`) for true offline + multi-device editing. Major undertaking but eliminates the localStorage / cross-device problem permanently.
- **Native iOS / Android app** via Expo — the user surface (today list, mark complete, push) is 80/20.

### What I'd avoid right now
- **Full SSR-streaming redesign** (React Server Components with Suspense everywhere). Too disruptive while the foundation is shaky.
- **GraphQL layer.** Supabase + Server Actions is enough; GraphQL adds tooling weight without payoff at this scale.
- **Self-hosting Postgres.** Supabase managed is a strict win until you're at 100k MAU+.
- **Nx / Turborepo / monorepo split.** No second app, no shared package — premature.

---

# § J — Working Together

Here's how I propose we run this for fastest velocity.

1. **You approve the cluster ordering** in §C. If you want a different gate (say, K before J), say so.
2. **You make the escalation decisions in §G** — I'll send each one as a single message in my escalation format. Default to A/B/C choices so you can answer in seconds.
3. **For each cluster, I'll open a draft task list with concrete file paths** (not the high-level table here). You review, I execute.
4. **Each phase ends with a re-audit** against `PROJECT_AUDIT.md`'s scoring rubric. We track regressions live.
5. **Model assignment is a default, not a contract.** If a particular task feels stuck on the recommended model, I'll switch and tell you why.

Let me know which cluster you want to kick off first, and I'll prepare the exact concrete task list for it.

---

# § K — Execution Roadmap (Chronological, with Model Assignments)

This is the **single source of truth for what gets done next**. Each row is a self-contained, executable unit with: sequence number, cluster ref, task ID, file targets, recommended model, dependency, status, and the session it lands in. Update this section at the end of every session — see §M.

### Status legend

| Symbol | Meaning |
|---|---|
| ⬜ TODO | Not started |
| 🟦 IN PROGRESS | Started this session, not yet shipped |
| ✅ DONE | Landed in the named session, verified |
| 🟧 BLOCKED | Waiting on user decision / external dep |
| 🟥 REGRESSED | Was DONE, regressed since |

### Execution principles

1. **Parallel where possible, gated where required.** Phase 0 must finish before Phase 1 starts. Within a phase, clusters listed under the same phase run concurrently — pick whichever has free capacity / matching model.
2. **One model per task is a default.** If a task is stuck on its recommended model, switch and note why in the session log.
3. **No skipping triage.** Phase 0 (A + P) blocks every other surface. Until first-run works and modal focus is stable, nothing else ships.
4. **Migrations never auto-apply.** Per `MEMORY.md`: write SQL to `supabase/migrations/<version>_<name>.sql`, then stop and wait for the user to apply manually. Tasks that produce migrations are marked 🟧 BLOCKED-on-user once the SQL is written.
5. **UI escalation per §G.** Tasks marked **[ESCALATE]** must surface 2–3 alternatives to the user before I touch code.

---

## Phase 0 — Triage Release (Days 1–3) · Score 5.0 → 6.0

**Run order: A and P concurrently; both must finish before Phase 1 starts.**

| Seq | Cluster | Task | File(s) | Model | Depends on | Status | Session |
|---|---|---|---|---|---|---|---|
| 1 | P | P.1 — One-shot initial focus (`hasInitiallyFocusedRef`) | `app/components/ui/Modal.tsx` | Opus 4.7 | — | ✅ DONE | S1 |
| 2 | P | P.2 — `onCloseRef` pattern + stable `handleKey`/`trapFocus`; effect deps reduce to `[open]` | `app/components/ui/Modal.tsx` | Opus 4.7 | P.1 | ✅ DONE | S1 |
| 3 | P | P.3 — `data-modal-close="true"` on header X button | `app/components/ui/Modal.tsx` | Sonnet 4.6 | P.2 | ✅ DONE | S1 |
| 4 | P | P.4 — `getFocusableElements` skips `[data-modal-close="true"]` | `app/components/ui/Modal.tsx` | Sonnet 4.6 | P.3 | ✅ DONE | S1 |
| 5 | P | P.5 — `initialFocusRef?: RefObject<HTMLElement \| null>` prop on `Modal` | `app/components/ui/Modal.tsx` | Sonnet 4.6 | P.2 | ✅ DONE | S1 |
| 6 | P | P.6 — `AddTaskButton` wires `titleInputRef` via `initialFocusRef`; remove `autoFocus` | `app/components/tasks/AddTaskButton.tsx` | Sonnet 4.6 | P.5 | ✅ DONE | S1 |
| 7 | A | A.1 — Drop `onboarding_completed` from upsert | `app/actions/onboarding/completeOnboarding.ts:25-32` | Sonnet 4.6 | — | ✅ DONE | S2 |
| 8 | A | A.9 — Stop `app/error.tsx` rendering `error.message` | `app/error.tsx:28-42` | Sonnet 4.6 | — | ✅ DONE | S2 |
| 9 | A | A.3 — Generic copy in `app/error.tsx`, log raw to logger | `app/error.tsx` | Sonnet 4.6 | A.9 | ✅ DONE | S2 |
| 10 | A | A.4 — Per-route-group `error.tsx` files | `app/auth/error.tsx`, `app/onboarding/error.tsx` | Sonnet 4.6 | A.3 | ✅ DONE | S2 |
| 11 | A | A.2 — `proxy.ts` profile-fetch error → redirect, not pass-through | `proxy.ts:84-94` | Sonnet 4.6 | — | ✅ DONE | S2 |
| 12 | A | A.5 — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy | `next.config.ts` | Opus 4.7 | — | ✅ DONE | S2 |
| 13 | A | A.6 — Cap toast queue at 3 | `app/components/Toast.tsx` | Sonnet 4.6 | — | ✅ DONE | S2 |
| 14 | A | A.7 — Honest marketing copy pass | `app/landingpage/page.tsx` | GLM-5.1 | — | ✅ DONE | S2 |
| 15 | A | A.8 — Replace `localStorage.showFounderMessage` with `profiles.welcomed_at` (migration applied) | `app/auth/signup/page.tsx`, `app/components/FounderMessageModal.tsx`, `supabase/migrations/0004_add_welcomed_at_to_profiles.sql`, `app/actions/user/markWelcomed.ts`, `app/(dashboard)/layout.tsx`, `app/components/layout/AppShell.tsx` | Sonnet 4.6 | — | ✅ DONE | S2 |
| 16 | A | A.10 — (covered by P.1–P.6 above) | — | — | P done | ✅ DONE | S1 |
| 17 | A | A.11 — `initialFocusRef` wired on all remaining Modal consumers; `Input.tsx` → `forwardRef` | `app/components/ui/Input.tsx`, `app/components/subjects-data-table/shared.tsx`, `app/(dashboard)/planner/subjects-data-table.taskComposer.tsx`, `app/(dashboard)/planner/subjects-data-table.modals.tsx`, `app/(dashboard)/planner/subjects-data-table.dependencies.tsx`, `app/(dashboard)/dashboard/subjects/subjects-data-table.taskComposer.tsx` | Kimi K2.6 | P done | ✅ DONE | S2 |
| 18 | A | A.12 — Codemod sweep (dead imports, console.logs, stale refs, 53 error.message leaks) | `app/actions/**/*.ts` (27 files), `lib/ops/telemetry.ts` | Kimi K2.6 | P.2 | ✅ DONE | S2 |
| 19 | P | P.7 — Codemod sweep (overlaps A.12 — executed once, counted both) | see A.12 | Kimi K2.6 | P.2 | ✅ DONE | S2 |
| 20 | P | P.8 — Audit + permanent fix: `PlanIssueModal` migrated to shared `<Modal>`; both `SubjectDrawer`s consolidated into `app/components/subjects/SubjectDrawer.tsx` using shared `<Modal>` + `initialFocusRef`; old files deleted. `Tabs` not vulnerable; `Dropdown` deferred to Cluster F (a11y polish only) | `app/(dashboard)/planner/components/PlanIssueModal.tsx`, `app/components/subjects/SubjectDrawer.tsx` (new), `app/(dashboard)/planner/subjects-data-table.tsx`, `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx`; deleted `app/(dashboard)/planner/SubjectDrawer.tsx` + `app/(dashboard)/dashboard/subjects/SubjectDrawer.tsx` | Opus 4.7 | P.6 | ✅ DONE | S2 |
| 21 | P | P.9 — E2E test: 10-keystroke focus retention on Add-Task title (Overview + Calendar) | new `e2e/add-task-focus.spec.ts` | Sonnet 4.6 | P.6 | ✅ DONE | S2 |
| 22 | P | P.10 — Component test for Modal focus stability under re-render (6 tests, all green) | new `tests/components/ui/Modal.focus.test.tsx` | Sonnet 4.6 | P.6 | ✅ DONE | S2 |
| 23 | P | P.11 — ESLint rule enforcing `initialFocusRef` on `<Modal>` | `eslint-rules/require-modal-initial-focus-ref.js`, `eslint.config.mjs` | DeepSeek V4 Pro | P.2 | ✅ DONE | S2 |
| 24 | P | P.12 — Storybook: "Modal — focus stability under re-render" | `.storybook/` | Sonnet 4.6 | E.9 (storybook scaffold) | 🟧 BLOCKED on E.9 | — |

**Phase 0 DoD**: Brand-new account completes onboarding without errors; raw stack traces never reach UI; `curl -I /` shows CSP; toast queue capped; honest landing copy; **Add-Task focus stable across all surfaces (✅ landed in S1)**; sibling modals audited (P.8); E2E + component tests green.

---

## Phase 1 — Foundation Release (Weeks 1–3) · Score 6.0 → 7.0

**Run order: B + C + G + M concurrently. M is continuous from here on.**

### Cluster B — Database & RPC

| Seq | Task | Model | Depends | Status |
|---|---|---|---|---|
| B.1 | Migration `0005_profiles_timezone.sql` | DeepSeek V4 Pro | — | 🟧 will block-on-apply |
| B.2 | Migration `0006_planner_drafts.sql` | DeepSeek V4 Pro | — | 🟧 will block-on-apply |
| B.3 | Migration `0007_audit_log.sql` | DeepSeek V4 Pro | — | 🟧 will block-on-apply |
| B.4 | Migration `0008_soft_delete.sql` | DeepSeek V4 Pro | — | 🟧 will block-on-apply |
| B.5 | Migration `0009_subject_color.sql` | DeepSeek V4 Pro | — | 🟧 will block-on-apply |
| B.6 | Rewrite `commit_plan_atomic_v2_wrapper` canonical hash | Opus 4.7 ⭐ | — | ⬜ TODO |
| B.7 | Drop redundant `keep_mode='future'` branch | DeepSeek V4 Pro | B.6 | ⬜ TODO |
| B.8 | RPC `bulk_reorder` | DeepSeek V4 Pro | — | ⬜ TODO |
| B.9 | RPC `unarchive_subject` | DeepSeek V4 Pro | B.4 applied | ⬜ TODO |
| B.10 | RPC `duplicate_subject` | DeepSeek V4 Pro | — | ⬜ TODO |
| B.11 | Refactor `commit_plan_atomic_v2` (single CTE validation) | Opus 4.7 ⭐ | B.6 | ⬜ TODO |
| B.12 | Tighten `ops_events_owner_insert` RLS policy | DeepSeek V4 Pro | — | ⬜ TODO |
| B.13 | Cron: archive `plan_snapshots` >90 d | DeepSeek V4 Pro | — | ⬜ TODO |
| B.14 | Sync `lib/contracts/schemas.ts:plannerSettingsSchema` with SQL | Qwen3.6 Plus | — | ⬜ TODO |
| B.15 | Generate Supabase types; replace 207 `as` casts | Kimi K2.6 | — | ⬜ TODO |

### Cluster C — Server Actions & Auth

| Seq | Task | Model | Depends | Status |
|---|---|---|---|---|
| C.1 | `withAuth(handler)` HOF | Opus 4.7 | — | ⬜ TODO |
| C.2 | Rewrite all 27 actions to use `withAuth` + Zod inputs | Sonnet 4.6 | C.1 | ⬜ TODO |
| C.3 | `mapPostgresError` | Sonnet 4.6 | — | ⬜ TODO |
| C.4 | Move login/signup to Server Actions | Opus 4.7 | C.1 | ⬜ TODO |
| C.5 | Password reset flow | Opus 4.7 | C.4 | ⬜ TODO |
| C.6 | Email change flow | Sonnet 4.6 | C.5 | ⬜ TODO |
| C.7 | Account deletion + GDPR export | Opus 4.7 | C.1 | ⬜ TODO |
| C.8 | Per-user rate limiter | Opus 4.7 | — | ⬜ TODO |
| C.9 | Replace `revalidatePath` carpet-bombing with `revalidateTag` | Opus 4.7 | C.1 | ⬜ TODO |
| C.10 | Stronger password policy + HIBP check | Sonnet 4.6 | C.4 | ⬜ TODO |

### Cluster G — Onboarding & First-Run

| Seq | Task | Model | Status |
|---|---|---|---|
| G.1 | Replace 6-slide carousel with interactive 3-step | Opus 4.7 | ⬜ TODO **[ESCALATE]** |
| G.2 | "Try with sample data" seeding | Sonnet 4.6 | ⬜ TODO |
| G.3 | First-time tooltips (`floating-ui`) | Sonnet 4.6 | ⬜ TODO |
| G.4 | Branded email confirm + `/auth/welcome` | GLM-5.1 | ⬜ TODO |
| G.5 | "Why this is taking so long?" microcopy | GLM-5.1 | ⬜ TODO |
| G.6 | First-task celebration | Sonnet 4.6 | ⬜ TODO |
| G.7 | Drop ~9 MB onboarding PNG preload | Opus 4.6 Fast | ⬜ TODO |

### Cluster M — Docs & DevEx (continuous)

| Seq | Task | Model | Status |
|---|---|---|---|
| M.1 | Sync `docs/ARCHITECTURE.md` to actual code | GLM-5.1 | ⬜ TODO |
| M.7 | Husky + lint-staged pre-commit | DeepSeek V4 Flash | ⬜ TODO |
| M.8 | Dependabot weekly + auto-merge dev minor | DeepSeek V4 Flash | ⬜ TODO |
| M.6 | `npm run dev:bootstrap` seeds local DB | DeepSeek V4 Pro | ⬜ TODO |

**Phase 1 DoD**: All actions Zod-validated and `withAuth`-wrapped; password reset works; profile draft state in DB; sample-data flow live; first-run path is interactive; migrations 0004–0008 applied.

---

## Phase 2 — Core-Feature Release (Weeks 2–6) · Score 7.0 → 8.5

**Run order: D + E + F + N + O concurrently. N (schedule) is the user's marquee bug pack — prioritise.**

### Cluster N — Schedule Fix Pack (highest priority in Phase 2)

| Seq | Task | Model | Depends | Status |
|---|---|---|---|---|
| N.1 | Make column header strip droppable | Sonnet 4.6 | — | ⬜ TODO |
| N.2 | Decide past-date policy + apply consistently | Opus 4.7 | — | ⬜ TODO **[ESCALATE]** |
| N.3 | `reorderTasksOnDate` server action; persist in-day order | Sonnet 4.6 | N.2 decided | ⬜ TODO |
| N.4 | Replace `event.activatorEvent.clientY` with proper drop math | Opus 4.7 | — | ⬜ TODO |
| N.5 | TouchSensor `delay: 250, tolerance: 5` | Sonnet 4.6 | — | ⬜ TODO |
| N.6 | Cap `useDayOrder` localStorage to 12 weeks | Sonnet 4.6 | — | ⬜ TODO |
| N.7 | Validate cross-topic placement on reschedule | Opus 4.7 | N.2 | ⬜ TODO |
| N.8 | Visually grey-out disallowed columns | Sonnet 4.6 | N.2 | ⬜ TODO |
| N.9 | E2E: every drag scenario | Sonnet 4.6 | N.1–N.8 | ⬜ TODO |

### Cluster O — Timezone Project

| Seq | Task | Model | Depends | Status |
|---|---|---|---|---|
| O.1 | Migration `profiles.timezone` (= B.1) | Sonnet 4.6 | — | 🟧 will block-on-apply |
| O.2 | `lib/dates/userTimezone.ts` | Opus 4.7 | O.1 applied | ⬜ TODO |
| O.3 | Replace all `getTodayLocalDate()` callers | Kimi K2.6 | O.2 | ⬜ TODO |
| O.4 | Onboarding TZ detect + confirm | Sonnet 4.6 | O.2 | ⬜ TODO |
| O.5 | Settings: change timezone | Sonnet 4.6 | O.2 | ⬜ TODO |
| O.6 | Streak comparison uses user's local "today" | Opus 4.7 | O.2 | ⬜ TODO |
| O.7 | All deadline / earliest_start checks use user TZ | Opus 4.7 | O.2 | ⬜ TODO |

### Cluster D — Planner Engine

| Seq | Task | Model | Status |
|---|---|---|---|
| D.1 | Sort all `Map`/`Set` iterations explicitly | Opus 4.7 | ⬜ TODO |
| D.2 | Remove dead code (`isTopicSpacingOK`, `_loadRatio`) | Opus 4.6 Fast | ⬜ TODO |
| D.3 | Surface capacity scaling to user | Opus 4.7 | ⬜ TODO |
| D.4 | Property-based fuzz tests | DeepSeek V4 Pro | ⬜ TODO |
| D.5 | `diffPlans(prev, next)` | Opus 4.7 | ⬜ TODO |
| D.6 | Diff renderer in Confirm step | Sonnet 4.6 | ⬜ TODO |
| D.7 | Spike: GLPK-wasm ILP replacement | Opus 4.7 | ⬜ TODO |
| D.8 | Cache `generatePlanAction` by input hash | Sonnet 4.6 | ⬜ TODO |
| D.9 | Auto-fix: minimal capacity bump for `PARTIAL` | Opus 4.7 | ⬜ TODO |
| D.10 | Recommended-defaults wizard | Sonnet 4.6 | ⬜ TODO |
| D.11 | Visual dependency DAG (`reactflow`) | Sonnet 4.6 | ⬜ TODO |

### Cluster E — UI / Design System

| Seq | Task | Model | Status |
|---|---|---|---|
| E.1 | Inventory + tokens doc | Opus 4.7 | ⬜ TODO |
| E.2 | Replace inline `style={{ background: 'var(--…)' }}` with utilities | Sonnet 4.6 | ⬜ TODO |
| E.3 | Shrink `globals.css` 2462 → ~600 | Kimi K2.6 | ⬜ TODO **[ESCALATE]** |
| E.4 | TanStack-Table consumer for planner subjects-data-table | Kimi K2.6 | ⬜ TODO **[ESCALATE]** |
| E.5 | Same for dashboard subjects-data-table | Kimi K2.6 | ⬜ TODO |
| E.6 | `class-variance-authority` for variants | Sonnet 4.6 | ⬜ TODO |
| E.7 | Toast: undo + dedupe | Sonnet 4.6 | ⬜ TODO |
| E.8 | Sidebar: collapsible groups + cmd-k | Opus 4.6 Fast | ⬜ TODO |
| E.9 | Storybook scaffold | Sonnet 4.6 | ⬜ TODO |
| E.10 | Chromatic visual regression CI | DeepSeek V4 Pro | ⬜ TODO |

### Cluster F — Mobile-First

| Seq | Task | Model | Status |
|---|---|---|---|
| F.1 | Vertical agenda on viewport <768px | Opus 4.7 | ⬜ TODO **[ESCALATE]** |
| F.2 | Subject table → card list on mobile | Sonnet 4.6 | ⬜ TODO |
| F.3 | Calendar → horizontal-scroll week strip on mobile | Opus 4.7 | ⬜ TODO |
| F.4 | Long-press DnD activation for mobile | Sonnet 4.6 | ⬜ TODO |
| F.5 | Bottom-tab nav on mobile | Sonnet 4.6 | ⬜ TODO **[ESCALATE]** |
| F.6 | Audit `hidden lg:block` patterns | Opus 4.6 Fast | ⬜ TODO |
| F.7 | PWA manifest + install prompt | DeepSeek V4 Pro | ⬜ TODO |
| F.8 | Service worker offline read | Opus 4.7 | ⬜ TODO |

**Phase 2 DoD**: Schedule fix pack landed; subjects on TanStack; mobile schedule = vertical agenda; planner shows capacity-scaling banner; plan diff visible; timezone first-class.

---

## Phase 3 — Quality Release (Weeks 4–8) · Score 8.5 → 9.3

**Run order: H + I + J + L concurrently, riding on Phase 2 work.**

### Cluster H — Performance

| Seq | Task | Model | Status |
|---|---|---|---|
| H.1 | Profile claim → JWT `app_metadata.has_profile` | Opus 4.7 | ⬜ TODO |
| H.2 | Tag-based `unstable_cache` per user | Opus 4.7 | ⬜ TODO |
| H.3 | Image pipeline (AVIF/WebP, sizes) | DeepSeek V4 Pro | ⬜ TODO |
| H.4 | Bundle budget enforcement in CI | DeepSeek V4 Pro | ⬜ TODO |
| H.5 | Code-split heavy routes | Sonnet 4.6 | ⬜ TODO |
| H.6 | Replace 4-state `useState` in schedule with reducer | Kimi K2.6 | ⬜ TODO |
| H.7 | Edge runtime where Supabase SSR allows | Opus 4.7 | ⬜ TODO |
| H.8 | TanStack Query for client freshness | Sonnet 4.6 | ⬜ TODO |
| H.9 | Debounce reorder client → server | Sonnet 4.6 | ⬜ TODO |
| H.10 | Lighthouse CI gating | DeepSeek V4 Pro | ⬜ TODO |

### Cluster I — Observability

| Seq | Task | Model | Status |
|---|---|---|---|
| I.1 | Sentry FE + Server Actions | Opus 4.7 | ⬜ TODO |
| I.2 | Pino structured logger | Sonnet 4.6 | ⬜ TODO |
| I.3 | `ops_events` → BI sink | DeepSeek V4 Pro | ⬜ TODO |
| I.4 | `/api/health` + `/api/ready` | DeepSeek V4 Pro | ⬜ TODO |
| I.5 | Status page | DeepSeek V4 Flash | ⬜ TODO |
| I.6 | Weekly automated restore-test | Opus 4.7 | ⬜ TODO |
| I.7 | Top-5 incident runbook | GLM-5.1 | ⬜ TODO |
| I.8 | Synthetic monitoring (Playwright every 5min) | DeepSeek V4 Pro | ⬜ TODO |

### Cluster J — Testing

| Seq | Task | Model | Status |
|---|---|---|---|
| J.1 | Critical-path E2E (signup → committed plan) | Opus 4.7 | ⬜ TODO |
| J.2 | Schedule edit E2E | Sonnet 4.6 | ⬜ TODO |
| J.3 | DB integration via Testcontainers | Opus 4.7 | ⬜ TODO |
| J.5 | `@axe-core/playwright` on 7 main routes | Sonnet 4.6 | ⬜ TODO |
| J.7 | Coverage thresholds (lib ≥85%, actions ≥70%) | Sonnet 4.6 | ⬜ TODO |
| J.8 | k6 load test (1k concurrent, 95p<300ms) | DeepSeek V4 Pro | ⬜ TODO |
| J.9 | Stryker mutation tests bi-weekly | DeepSeek V4 Flash | ⬜ TODO |
| J.10 | CI fail on `console.log` | DeepSeek V4 Flash | ⬜ TODO |

### Cluster L — A11y & i18n

| Seq | Task | Model | Status |
|---|---|---|---|
| L.1 | `eslint-plugin-jsx-a11y` + fix all errors | Sonnet 4.6 | ⬜ TODO |
| L.2 | Audit icons for `aria-label` / `aria-hidden` | Opus 4.6 Fast | ⬜ TODO |
| L.3 | Skip-link + route-change focus mgmt | Sonnet 4.6 | ⬜ TODO |
| L.4 | Reduce-motion respect on landing | Sonnet 4.6 | ⬜ TODO |
| L.5 | NFC-normalise + Unicode confusables | DeepSeek V4 Pro | ⬜ TODO |
| L.6 | i18n scaffold via `next-intl` | Kimi K2.6 | ⬜ TODO |
| L.7 | Hindi locale | GLM-5.1 | ⬜ TODO |
| L.8 | RTL prep (logical properties) | Sonnet 4.6 | ⬜ TODO |

**Phase 3 DoD**: Sentry live; coverage gates passing; Lighthouse CI green; a11y errors eliminated; bundle budget enforced; load test 95p<300ms; visual regression in CI; i18n scaffold (en + hi).

---

## Phase 4 — Product Release (Weeks 6–12) · Score 9.3 → 9.8

**Cluster K only. Sequenced because most items share notification/email infra.**

| Seq | Task | Model | Depends | Status |
|---|---|---|---|---|
| K.1 | Email reminders (Resend) | Opus 4.7 | C.1 | ⬜ TODO |
| K.2 | In-app notification centre + read state | Sonnet 4.6 | K.1 | ⬜ TODO |
| K.3 | Web push (PWA-aware) | Opus 4.7 | F.7 | ⬜ TODO |
| K.4 | `.ics` calendar export | DeepSeek V4 Pro | — | ⬜ TODO |
| K.5 | Streak features (freeze, share card, grace day) | Sonnet 4.6 | O.6 | ⬜ TODO |
| K.6 | Multi-goal support (`goal_id` namespacing) | Opus 4.7 | — | ⬜ TODO **[ESCALATE]** |
| K.7 | Real-time `supabase.channel('tasks')` | Opus 4.7 | — | ⬜ TODO |
| K.8 | Sharable read-only plan link | Sonnet 4.6 | — | ⬜ TODO |
| K.9 | Stripe billing (Free / Pro) | Opus 4.7 | C.1 | ⬜ TODO **[ESCALATE]** |
| K.10 | Account deletion + data export | Sonnet 4.6 | C.7 | ⬜ TODO |
| K.11 | Pomodoro on schedule | MiniMax M2.7 | — | ⬜ TODO |
| K.12 | Google Calendar two-way sync (premium) | Opus 4.7 | K.9 | ⬜ TODO |

**Phase 4 DoD**: Email reminders, in-app notifications, .ics export, real-time, streak features, sharable plan link, account deletion + GDPR export, multi-goal support, Stripe billing.

---

## Phase 5 — Polish Release (Weeks 10–14) · Score 9.8 → 10.0

| Seq | Task | Model | Status |
|---|---|---|---|
| 5.1 | Web push notifications (= K.3 if not yet shipped) | Opus 4.7 | ⬜ TODO |
| 5.2 | Pomodoro polish | MiniMax M2.7 | ⬜ TODO |
| 5.3 | Service worker — offline today's tasks (= F.8) | Opus 4.7 | ⬜ TODO |
| 5.4 | Google Calendar sync (= K.12) | Opus 4.7 | ⬜ TODO |
| 5.5 | Storybook published | Sonnet 4.6 | ⬜ TODO |
| 5.6 | ADRs published (M.3) | Opus 4.7 | ⬜ TODO |
| 5.7 | Runbook live (I.7) | GLM-5.1 | ⬜ TODO |
| 5.8 | Final design-system pass + token unification | Opus 4.7 | ⬜ TODO |

**Phase 5 DoD**: composite score 10.0. Acceptance criteria from §H all green.

---

# § L — Session Log

Append a new row at the **end of every working session**. Format:

```
## Session <N> — <YYYY-MM-DD> — <short title>
- **Tasks closed**: list of (Seq, Task ID) pairs.
- **Tasks opened (in progress)**: list.
- **Blocked**: list with reason.
- **Files changed**: bullet list.
- **Migrations written (awaiting apply)**: list.
- **Decisions captured**: any §G escalations resolved.
- **Score delta**: previous → new (e.g., 5.0 → 5.2).
- **Next session entry point**: explicit next sequence number / cluster.
```

---

## Session 1 — 2026-05-04 — Cluster P landing (Modal focus fix)

- **Tasks closed**:
  - P.1 — One-shot initial focus via `hasInitiallyFocusedRef` + `prevOpenRef` open-transition guard.
  - P.2 — `onCloseRef` ref-sync; `handleKey` and `trapFocus` now stable (`useCallback([], [])`); main effect re-runs only on `[open]` transitions in practice.
  - P.3 — `data-modal-close="true"` added to header X button.
  - P.4 — `FOCUSABLE_SELECTOR` excludes `[data-modal-close]`.
  - P.5 — `initialFocusRef?: RefObject<HTMLElement | null>` added to `ModalProps`; preferred over autodetect when provided.
  - P.6 — `AddTaskButton` wires `titleInputRef` via `initialFocusRef`; removed `autoFocus` to prevent double-focus race.
  - A.10 — Marked done (covered by P.1–P.6).
- **Tasks opened (in progress)**: none.
- **Blocked**: P.12 (Storybook entry) on E.9 (Storybook scaffold) — Phase 2.
- **Files changed**:
  - `app/components/ui/Modal.tsx` (rewritten with three-layer fix; +`initialFocusRef` prop)
  - `app/components/tasks/AddTaskButton.tsx` (+`titleInputRef`, -`autoFocus`, +`initialFocusRef={titleInputRef}`)
- **Migrations written (awaiting apply)**: none.
- **Decisions captured**: Cluster P added to Phase 0 alongside Cluster A; Phase 0 DoD updated to require Add-Task focus stability.
- **Manual verification needed by user**: open Add Task on Overview and Calendar → type 10 chars in Title → all 10 land, focus never jumps to X. Schedule "Add Event" continues to work.
- **Score delta**: 5.0 → ~5.2 (one user-blocking class of bugs eliminated; A still pending).
- **Next session entry point**: **Seq 7 — Task A.1** (Drop `onboarding_completed` from upsert in `app/actions/onboarding/completeOnboarding.ts:25-32`, model: Sonnet 4.6). Phase 0 cannot close until A.1–A.9 + P.7–P.11 are done.

## Session 2 — 2026-05-04 — Cluster A landing + P.11 + auth hardening

- **Tasks closed**:
  - Seq 7 / A.1 — Dropped `onboarding_completed` from profile upsert.
  - Seq 8 / A.9 — Replaced `error.message` in `completeOnboarding.ts` + `error.tsx` with safe generic copy.
  - Seq 9 / A.3 — Covered by A.9 (no separate change needed).
  - Seq 10 / A.4 — Added `app/auth/error.tsx` and `app/onboarding/error.tsx`.
  - Seq 11 / A.2 — `proxy.ts` catch block now redirects to `/onboarding` instead of passing through.
  - Seq 12 / A.5 — Full security headers in `next.config.ts`: CSP (env-derived Supabase origin), HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
  - Seq 13 / A.6 — Toast queue capped at 3; evicted toasts have their timers cancelled.
  - Seq 14 / A.7 — Testimonials rewritten as third-person scenarios; trust-signal copy made honest (GLM-5.1 via OpenCode).
  - Seq 15 / A.8 — `profiles.welcomed_at` column added; `GlobalFounderMessage` now DB-driven via `markWelcomed()` server action; `localStorage` removed entirely. Migration `0004_add_welcomed_at_to_profiles.sql` written and applied.
  - Seq 17 / A.11 — `initialFocusRef` wired on all remaining `<Modal>` consumers; `Input.tsx` updated to `forwardRef` (Kimi K2.6 via OpenCode).
  - Seq 23 / P.11 — ESLint rule `local/require-modal-initial-focus-ref` live in `eslint.config.mjs` (DeepSeek V4 Pro via OpenCode).
  - Bonus — Raw `error.message` in `auth/login` and `auth/signup` replaced with mapped user-safe strings (DeepSeek V4 Pro via OpenCode).
- **Tasks opened (in progress)**: none.
- **Blocked**: Seq 24 / P.12 still blocked on E.9 (Storybook scaffold, Phase 2).
- **Files changed**:
  - `app/actions/onboarding/completeOnboarding.ts`
  - `app/error.tsx`
  - `app/auth/error.tsx` (new)
  - `app/onboarding/error.tsx` (new)
  - `proxy.ts`
  - `next.config.ts`
  - `app/components/Toast.tsx`
  - `app/landingpage/page.tsx`
  - `app/auth/signup/page.tsx`
  - `app/auth/login/page.tsx`
  - `app/components/FounderMessageModal.tsx`
  - `app/actions/user/markWelcomed.ts` (new)
  - `app/(dashboard)/layout.tsx`
  - `app/components/layout/AppShell.tsx`
  - `app/components/ui/Input.tsx` (forwardRef)
  - `app/components/subjects-data-table/shared.tsx`
  - `app/(dashboard)/planner/subjects-data-table.taskComposer.tsx`
  - `app/(dashboard)/planner/subjects-data-table.modals.tsx`
  - `app/(dashboard)/planner/subjects-data-table.dependencies.tsx`
  - `app/(dashboard)/dashboard/subjects/subjects-data-table.taskComposer.tsx`
  - `eslint-rules/require-modal-initial-focus-ref.js` (new)
  - `eslint.config.mjs`
- **Migrations written and applied**: `supabase/migrations/0004_add_welcomed_at_to_profiles.sql` ✅ applied.
- **Decisions captured**: none (no §G escalations this session).
- **Score delta**: ~5.2 → ~5.7 (all Cluster A triage items landed; security headers live; auth hardened; Modal consumers fully wired).
- **Next session entry point**: **Seq 20 — P.8** (focus-pattern audit on Dropdown/Tabs/PlanIssueModal/SubjectDrawer — Opus 4.7). After that: Seq 21 / P.9 (E2E test — Sonnet 4.6), Seq 22 / P.10 (component test — Sonnet 4.6). Phase 0 closes when all three are done.
- **Regression caught and fixed**: Kimi codemod sweep removed `GlobalFounderMessage` wiring from `AppShell` and `welcomed_at` fetch from `layout.tsx` (misidentified as stale). Fixed same session via Sonnet 4.6 restore prompt. Files restored: `app/(dashboard)/layout.tsx`, `app/components/layout/AppShell.tsx`.
- **P.8 closed (permanent fix path / Option B chosen)**: PlanIssueModal migrated to shared `<Modal>` with `initialFocusRef={recheckButtonRef}`. Two `SubjectDrawer.tsx` files (planner + dashboard subjects) consolidated into a single `app/components/subjects/SubjectDrawer.tsx` parameterised via `showDeadlineField`, `showDeleteAction`, `archiveBehavior` ("none" | "one-way" | "toggle"), and `isMutating` props. Both old files deleted. `autoFocus` anti-pattern eliminated; unstable `[busy, onClose, open]` Escape-effect deps gone (Modal handles via `onCloseRef`). Tabs/Dropdown findings deferred to Cluster F. `tsc --noEmit` + ESLint clean.

---

# § M — Session Update Protocol (mandatory)

This document is the project's working memory. **Every working session must end with an update to this file.** Without it, the next session has no idea what's already shipped.

### What "end of session" means
Any one of:
- A code change is committed or staged.
- A migration SQL is written.
- A §G escalation decision is made.
- A cluster's status materially changes.

### Update steps (in order)
1. **Find the affected rows in §K** and flip their status (⬜ → 🟦 → ✅, or → 🟧 BLOCKED with reason).
2. **Add a Session entry in §L** using the template above. Numbered sequentially. Include:
   - Closed tasks (with Seq + Task ID).
   - In-progress tasks.
   - New blockers.
   - Every file changed (paths only).
   - Every migration written (path + apply status).
   - Any §G escalation resolved.
   - Composite score delta (estimate; precise re-audit happens at phase boundaries).
   - **Explicit next session entry point** — Seq number + Task ID + model.
3. **If a phase DoD is met**, update the phase header in §K to mark the phase ✅ DONE and add a one-line completion note.
4. **If new bugs are discovered**, append them to §A (or §B for cross-cutting) with the same severity convention (🔴/🟠/🟢) **and** add corresponding rows to §K with TODO status.
5. **If a §G escalation is opened**, log the decision request in §L's "Decisions captured" — even if the answer is pending.
6. **Commit only after the update.** A commit without a §L entry leaves the doc stale — that's the failure mode this protocol exists to prevent.

### What this document is NOT
- A ticketing system. JIRA/Linear/GitHub Issues remain authoritative for sprint planning if used.
- A blow-by-blow chat log. Capture decisions and outcomes, not deliberation.
- A spec. Specs live in `docs/ADR/*` (Cluster M.3).

### Re-audit cadence
- **Per session**: §K and §L only.
- **Per phase boundary**: re-score against `PROJECT_AUDIT.md` rubric, update §H progression, archive any closed phase to a "completed" subsection.
- **Quarterly**: full audit refresh; bump `PROJECT_AUDIT.md` revision; reconcile drift.

---

*End of roadmap. Companion to `PROJECT_AUDIT.md`. Generated 2026-05-04. Last updated: Session 2 — 2026-05-04 (Cluster A + codemod sweep + P.8 permanent fix + P.9 E2E + P.10 component tests landed; Phase 0 closed; score 5.7 → 6.0; next: Phase 1).*
