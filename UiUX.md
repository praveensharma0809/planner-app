# StudyHard UI/UX Documentation

Last verified: 2026-03-09  
Workspace: `c:\Users\Lenono\Desktop\planner-app`

This document describes the UI and UX exactly as implemented in the current codebase.
It is intended as a full handoff document for humans and AI models.

## 1) Scope And Method

- Source of truth: `app/**/*.tsx`, `app/globals.css`, root config files, and route-level loading/error boundaries.
- This is an as-built UX spec, not a design proposal.
- If behavior in production differs, code is considered canonical for this document.

## 2) Technology, Frameworks, Runtime

### Core stack

- Framework: Next.js 16 (`app` router), React 19.
- Language: TypeScript (`strict: true` in `tsconfig.json`).
- Styling: Tailwind CSS v4 with `@tailwindcss/postcss`.
- Auth/data: Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- Drag-and-drop libraries present: `@dnd-kit/*`.
- Testing: Vitest (not UI runtime, but part of engineering stack).

### Project-level UI config

- `package.json` scripts:
- `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `ci:check`.
- ESLint: Next core web vitals + TypeScript config via `eslint.config.mjs`.
- Next config: minimal default in `next.config.ts`.

## 3) Global Visual System

### Typography

- Primary font: Geist Sans (`next/font/google`) via `--font-geist-sans`.
- Monospace font: Geist Mono via `--font-geist-mono`.
- Body font stack: Geist Sans, `system-ui`, `-apple-system`, `sans-serif`.

### Theme system

- Theme states: `dark` and `light`.
- Theme context file: `app/components/ThemeProvider.tsx`.
- Theme persistence key: `localStorage["studyhard-theme"]`.
- Theme applied by setting `data-theme` on `<html>`.

### CSS design tokens (`app/globals.css`)

#### Dark theme tokens

- `--background: #050510`
- `--foreground: #e8e8f0`
- `--card: rgba(255,255,255,0.03)`
- `--card-border: rgba(255,255,255,0.06)`
- `--card-hover: rgba(255,255,255,0.06)`
- `--accent: #6366f1`
- `--accent-glow: rgba(99,102,241,0.15)`
- `--emerald: #34d399`
- `--emerald-glow: rgba(52,211,153,0.12)`

#### Light theme tokens

- `--background: #f0f2f5`
- `--foreground: #1a1a2e`
- `--card: rgba(255,255,255,0.7)`
- `--card-border: rgba(0,0,0,0.08)`
- `--card-hover: rgba(255,255,255,0.9)`
- `--accent` unchanged (`#6366f1`)
- `--emerald` shifts to `#10b981`

### Reusable visual classes

- Cards: `.glass-card`, `.gradient-card`, `.emerald-card`, `.danger-card`, `.warning-card`.
- Text: `.gradient-text`, `.gradient-text-emerald`, `.stat-number`.
- Progress bars: `.progress-emerald`, `.progress-amber`, `.progress-red`.
- Buttons: `.btn-primary`, `.btn-ghost`.
- Background layer: `.mesh-bg`.

### Global interaction and motion

- Global smooth scrolling: `* { scroll-behavior: smooth; }`.
- Keyboard focus ring: `:focus-visible` custom outline.
- Mouse-click outline suppression: `:focus:not(:focus-visible) { outline: none; }`.
- Animation utilities:
- `.animate-slide-in`
- `.animate-fade-in`
- `.animate-pulse-glow`

### Scrollbar treatment

- Custom WebKit scrollbar (6px width, transparent track).
- Dark and light thumb variants.

## 4) App Shell, Providers, Navigation

### Root layout (`app/layout.tsx`)

- Applies fonts and global CSS.
- Wraps app with:
- `ToastProvider` (`app/components/Toast.tsx`)
- `ThemeProvider` (`app/components/ThemeProvider.tsx`)
- Global metadata title: `StudyHard - Strategic Execution Engine`.

### Global toast system (`app/components/Toast.tsx`)

- Context API with `addToast(message, type)`.
- Toast types: `success`, `error`, `info`.
- Position: bottom-right fixed stack.
- ARIA behavior: container `role="status"`, `aria-live="polite"`.
- Auto-dismiss timer from `TOAST_DURATION_MS`.
- Manual dismiss available.

### Top navigation (`app/dashboard/Sidebar.tsx`, exported as `TopNav`)

- Fixed 56px top bar for dashboard/planner/execution layouts.
- Desktop nav links:
- `/dashboard`
- `/dashboard/calendar`
- `/planner`
- `/dashboard/subjects`
- `/dashboard/settings`
- Active state logic:
- exact match for dashboard root
- prefix match for others
- Mobile:
- hamburger button
- overlay backdrop
- dropdown menu with same links and sign-out button
- Sign-out uses browser Supabase client and redirects to `/auth/login`.

### Layout wrappers

- `app/dashboard/layout.tsx`: `TopNav` + mesh background + content with `pt-14`.
- `app/planner/layout.tsx`: same shell pattern.
- `app/execution/layout.tsx`: same shell pattern.

## 5) Routing And Access Rules

### Middleware (`middleware.ts`)

- Refreshes Supabase session via SSR client/cookies.
- Protected route prefixes:
- `/dashboard`
- `/planner`
- `/onboarding`
- Unauthenticated users on protected routes -> redirect to `/auth/login?redirectTo=...`.
- Protected-route profile check:
- if no `profiles` row and not already on onboarding -> redirect `/onboarding`.

### Important UX nuance

- `/execution` is not listed in middleware protected prefixes.
- Execution route still enforces auth indirectly through action result behavior and shows sign-in fallback if unauthorized.

## 6) Complete Screen-By-Screen Documentation

## 6.1 `/` Home Gateway

File: `app/page.tsx`

- Type: client component.
- Behavior on mount:
- calls `supabase.auth.getUser()`
- if no user -> `router.push("/auth/login")`
- if user and no profile -> `router.push("/onboarding")`
- if user and profile exists -> `router.push("/dashboard")`
- Visual while checking:
- full-screen centered logo card
- gradient `StudyHard` heading
- `Loading...` text
- mesh background

UX note:
- route transitions happen client-side after initial render.

## 6.2 `/auth/login`

File: `app/auth/login/page.tsx`

- Layout:
- centered auth card (`glass-card`)
- brand mark + title
- Inputs:
- Email (`type=email`, required)
- Password (`type=password`, required)
- CTA:
- primary button text: `Sign In` / `Signing in...`
- Secondary nav:
- link to `/auth/signup`
- Feedback:
- Supabase auth errors shown as toasts
- network error toast fallback
- Success path:
- redirect to `/dashboard`

## 6.3 `/auth/signup`

File: `app/auth/signup/page.tsx`

- Mirrors login visual structure.
- Inputs:
- Email required
- Password required, `minLength={6}`
- CTA:
- `Create Account` / `Creating account...`
- Feedback:
- success toast: check email confirmation message
- error toasts on failure
- Success path:
- redirect to `/auth/login`
- Secondary nav:
- link to `/auth/login`

## 6.4 `/onboarding`

File: `app/onboarding/page.tsx`

- 4-step wizard, local step state (`step` 1..4).
- Top progress indicator (4 segment bar).

### Step 1: Profile

- Fields:
- full name (required)
- goal/exam name (required)
- daily available hours (`number`, min 1, max 16, required)
- goal deadline (`date`, min=today, required)
- Save action:
- inserts profile row directly via browser Supabase client
- `daily_available_minutes = dailyHours * 60`
- CTA: `Next ->`

### Step 2: Subjects

- Adds subject names using server action `addSubject`.
- Displays added subjects list with success glyph.
- CTA set:
- `+ Add Subject`
- navigation: back/next or skip

### Step 3: Off-days

- Add off-day via action `addOffDay` with optional reason.
- Remove off-day via `deleteOffDay`.
- Date min constrained to today.
- CTA set:
- `+ Add Off Day`
- back/next with optional skip

### Step 4: Completion

- Summary cards for subjects/off-days/daily hours.
- Primary CTA: `Quick Start Plan (Recommended)`.
- Secondary CTA: `Open Planner ->`.
- Tertiary CTA: `Skip to Dashboard`.
- Quick start behavior:
- calls `quickStartPlan`
- on success toast with task count and redirect to dashboard

UX states:
- initial loading gate returns `null` until auth/profile check completes.

## 6.5 `/dashboard`

File: `app/dashboard/page.tsx`

### Data sources and dependencies

- `getStreak`
- `getWeeklySnapshot`
- `getSubjectProgress`
- `getBacklog`
- `getExecutionMonth`
- server Supabase query for subject list

### Visual structure

- Header:
- date label
- greeting (morning/afternoon/evening)
- compact inline stats (streak, today done/total, week done/total, remaining hours, overdue)
- CTA button: `Generate Plan`
- Optional progress bar: appears if today has tasks
- Main content grid:
- left (2/3 on xl): backlog warning, today tasks block, execution widget
- right (1/3 on xl): subject progress, plan history, insight cards

### Key interactions

- Backlog banner:
- shows overdue count and missed minutes
- includes `RescheduleMissedButton`
- links to planner
- Today tasks:
- inline quick-add via `QuickAddTask`
- pending tasks are submit forms using `SubmitButton`
- completion action uses server action `completeTask`
- completed tasks rendered separately with strike-through

### Empty states

- no tasks today: icon, text, `Generate a plan` button.
- no subjects: link to add subjects.

### Feedback states

- Pending buttons show disabled behavior.
- Insights panel includes contextual messages for streak/completion/risk/no-week-plan.

### Route boundaries

- Loading UI: `app/dashboard/loading.tsx`.
- Error boundary: `app/dashboard/error.tsx` with `reset()` button.

## 6.6 `/dashboard/calendar`

Files:
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/calendar/MonthView.tsx`

### Route behavior

- Month query param supported: `?month=YYYY-MM`.
- Invalid/missing month falls back to current month.
- Pulls month tasks + subject list.

### Month grid UX

- Monday-first 7-column header (`Mon ... Sun`).
- Prev/next month arrows in compact pill control.
- Day cells show:
- date bubble
- optional total study hours badge
- up to 4 task previews + overflow count
- Sunday with no tasks shows a decorative placeholder icon.
- Subject color mapping is deterministic from subject list order (8-color cycle).

### Day detail modal UX

- Opens on day click.
- ESC closes modal.
- Overlay click closes modal.
- For each task:
- completion toggle (`completeTask` / `uncompleteTask`)
- subject badge + session type label
- duration display
- `Missed` badge for past unfinished tasks
- inline date input for reschedule (`rescheduleTask`, min=today)
- Success reschedule currently triggers full page reload.

### Route boundaries

- Loading UI: `app/dashboard/calendar/loading.tsx`.
- Error boundary: `app/dashboard/calendar/error.tsx`.

### Additional calendar component in repo

- `app/dashboard/calendar/WeekView.tsx` exists with drag/drop and inline reschedule UX but is not currently mounted by `calendar/page.tsx`.

## 6.7 `/dashboard/subjects`

Files:
- `app/dashboard/subjects/page.tsx`
- `app/dashboard/subjects/subjects-data-table.tsx`
- `app/dashboard/subjects/SubjectDrawer.tsx`

### Page composition

- Header title: `Curriculum`.
- Controls:
- toggle active vs archived view
- `+ Add Subject` opens drawer
- Data table columns:
- Subject
- Topics
- Estimated
- Progress
- Earliest Deadline
- Priority
- Actions

### Row interactions

- Click subject name to edit in drawer.
- Archive/restore button (inline actions).
- Delete button with native `confirm()` dialog.

### Drawer UX

- Right-side slide-in panel with backdrop.
- Modes:
- create
- edit
- In edit mode, loads current subject via `getSubjectById`.
- Save actions:
- create -> `addSubject`
- edit -> `updateSubject`
- CTA text varies by mode.

### Empty and boundaries

- Empty active/archived table text variants.
- Loading UI: `app/dashboard/subjects/loading.tsx`.
- Error boundary: `app/dashboard/subjects/error.tsx`.

## 6.8 `/dashboard/settings`

Files:
- `app/dashboard/settings/page.tsx`
- `app/dashboard/settings/SettingsForm.tsx`
- `app/dashboard/settings/OffDaysManager.tsx`

### Sections

- Profile settings form
- Off-days manager
- Appearance (theme toggle)
- Operations link
- Onboarding re-run link

### SettingsForm UX

- Fields:
- Full name (required)
- Goal name (required)
- Daily available hours (number, min 1, max 16)
- Goal deadline (required date)
- Converts daily hours to minutes for update action.
- Inline message box for success/error.
- CTA: `Save changes` / `Saving...`

### OffDaysManager UX

- Add form:
- date required (`min=today`)
- reason optional
- List of configured off-days sorted by date.
- Row-level remove action.
- Past off-days visually reduced opacity.
- Inline error box on failures.

### Theme toggle UX

- Uses `ThemeToggle` component.
- Button text reflects current mode and next mode.
- Includes moon/sun icon glyphs.

### Route boundaries

- Loading UI: `app/dashboard/settings/loading.tsx`.
- Error boundary: `app/dashboard/settings/error.tsx`.

## 6.9 `/dashboard/settings/operations`

File: `app/dashboard/settings/operations/page.tsx`

- Purpose: reliability telemetry dashboard.
- Top metrics cards:
- events (24h)
- error events
- warning events
- quick-start success rate (7d)
- Event reliability table with status mix and latencies.
- Recent issues list (warning/error only).
- Back link to settings.

## 6.10 `/planner`

Files:
- `app/planner/page.tsx`
- `app/planner/components/*`

### Wizard architecture

- 5 phases: structure -> parameters -> constraints -> preview -> confirm.
- Stepper: `PlannerStepper` with reachable-phase gating.
- Session persistence:
- sessionStorage key: `planner-wizard-state`
- version key: `PLANNER_ENGINE_VERSION = 2026-03-08-sequential-v2`
- stale persisted state gets cleared when engine version changes.

### Phase 1: Structure (`StructureBuilder`)

- Editable hierarchy:
- subject
- topic
- subtopic
- Add/remove controls at each level.
- Live count badges for subjects/topics/subtopics.
- Save CTA: `Save & Continue ->`.
- Validation gate: at least one non-empty subject name.

### Phase 2: Parameters (`ParamsEditor`)

- Per-topic configuration.
- Effort modes:
- `T` time (hours)
- `D` days (converted by `days * 2h`)
- `L` lectures (count * minutes)
- Priority pills mapped to values:
- High -> 1
- Med -> 3
- Low -> 5
- Deadline date field.
- Expandable advanced area per topic:
- session length presets (30,45,60,90,120) and custom
- earliest start date
- dependencies picker with chips
- Footer CTA: `Save & Continue ->`.
- Validation gate: at least one topic with `estimated_hours > 0`.

### Phase 3: Constraints (`ConstraintsForm`)

- Study window:
- study start date
- exam date
- validates exam date > start date
- Daily capacity:
- weekday minutes
- weekend minutes
- presets + custom input
- validates not both zero
- Plan order options:
- balanced
- priority
- deadline
- subject
- Focus depth: max active subjects/day (`0` means unlimited).
- Buffer percentage (0 to 50).
- Final revision days.
- CTA: `Save & Generate Plan ->` / `Generating...`.

### Phase 4: Preview (`PlanPreview`)

- Summaries:
- total sessions, days, avg minutes/day, end date
- Plan review panel:
- how-built notes
- warnings/critical counts
- suggested fixes (optional jump to phase)
- Day-by-day cards grouped by subject.
- Local edit action: remove session with `x` button.
- CTA: `Continue to Confirm`.

### Phase 5: Confirm (`PlanConfirm`)

- Summary stats cards.
- Keep-mode options:
- `until` Keep until new plan starts
- `none` Delete all previous generated tasks
- `future` Replace future only
- State default in code: `keepMode = "until"`.
- Commit CTA:
- `Commit Plan ->`
- `Committing...`
- `Recommit Plan ->` after success
- Result banners for success/error.

### Planner UX feedback

- Toasts for save/generate/commit outcomes.
- Infeasible generation keeps user in flow with warning to adjust.

## 6.11 `/execution`

Files:
- `app/execution/page.tsx`
- `app/execution/ExecutionBoard.tsx`

### Entry behavior

- If `getExecutionMonth` is unauthorized, page shows sign-in fallback card with link to `/auth/login`.

### Page frame

- Formula-bar style top strip (`h-7`) with:
- month nav arrows
- month label
- global streak
- monthly completion percent
- today completion count
- optional `Past month` label

### Spreadsheet board UX

- Sticky header with:
- column letters row
- labels row
- fixed row number and sticky category/item columns
- Geometry constants:
- row number 36px
- category 120px
- item 160px
- day 32px each
- percent 44px
- streak 38px
- Toolbar actions:
- add category input
- `Add` button
- sort mode select (`manual`, `streak`, `percent`)
- Category rows:
- inline add item input (`+ add item...`)
- delete category button
- Item rows:
- optional drag handle when manual sort
- checkbox per day
- row completion percent
- streak metric
- delete item button
- Drag behavior:
- manual mode only
- item reorder inside category
- persists via `reorderExecutionItems`
- Deletion UX:
- soft delete for items/categories
- floating undo bar with countdown (8s)
- Undo actions:
- `undoDeleteExecutionItem`
- `undoDeleteExecutionCategory`

### Today emphasis behavior

- Today column gets special background.
- If today has zero completions, highlight shifts to red-toned warning state.

## 7) Additional UI Surfaces In Repo (Not Primary Route Mounts)

- `app/dashboard/timetable/WeeklyTimetable.tsx`:
- dnd-kit draggable weekly board with day columns and drag overlay.
- uses `DayColumn` and `TaskBlock`.
- currently not mounted by dashboard page.
- `app/dashboard/calendar/AddTaskForm.tsx`:
- inline custom task creation panel.
- not currently used by `MonthView` route output.

## 8) Form, Validation, And Feedback Matrix

| Surface | Key Inputs | Validation | Feedback |
|---|---|---|---|
| Login | Email, Password | required fields | toast errors, loading CTA text |
| Signup | Email, Password | password min 6 | success toast, error toasts |
| Onboarding Step 1 | name, goal, daily hours, date | required, hours range 1..16, date >= today | inline step progression, toasts on failure |
| Onboarding Step 2 | subject name | trimmed non-empty | add button disabled until valid |
| Onboarding Step 3 | off-day date, reason | date required, min today | row list updates, error toast |
| QuickAddTask | title, subject, duration | title required, duration 5..240 | toasts, disabled pending CTA |
| SettingsForm | profile + hours + deadline | hours must parse > 0, required fields | inline success/error message block |
| OffDaysManager | date, reason | date required, min today | inline error block, remove buttons |
| Planner Phase 1 | hierarchy text fields | at least one subject non-empty | save gate + toast |
| Planner Phase 2 | effort/priority/deadline/deps | at least one estimated_hours > 0 | save gate + toast |
| Planner Phase 3 | dates/capacity/order/buffer | date ordering + capacity not all zero | errors inline + save gate |
| Calendar modal | completion toggle + reschedule date | reschedule min today | optimistic visual + reload on success |
| Execution board | checkbox grid, add/delete/reorder | action-level server validation | optimistic update + toast + undo timer |

## 9) Loading, Error, Empty, And Success States

### Loading boundaries implemented

- `app/dashboard/loading.tsx`
- `app/dashboard/calendar/loading.tsx`
- `app/dashboard/subjects/loading.tsx`
- `app/dashboard/settings/loading.tsx`

### Error boundaries implemented

- `app/dashboard/error.tsx`
- `app/dashboard/calendar/error.tsx`
- `app/dashboard/subjects/error.tsx`
- `app/dashboard/settings/error.tsx`

### Empty states examples

- Dashboard today tasks empty card with planner CTA.
- Plan history empty state with create link.
- Subjects table empty messaging for active/archived modes.
- Off-days empty explanatory text.
- Execution board empty category instruction row.

### Success messaging patterns

- Toast success notifications across auth/planner/dashboard actions.
- Inline success panel in settings form.
- Planner commit success banner in phase 5.

## 10) Accessibility And Input Ergonomics

### Existing positive patterns

- Visible keyboard focus ring (`:focus-visible`).
- Many controls include `aria-label`.
- Toast container uses `aria-live` polite announcements.
- Keyboard shortcuts in specific components:
- Enter for quick submits
- Escape to close modal or inline editor in some contexts

### Current limitations observed from code

- Accessibility support is uneven across all controls (not all icon buttons fully labeled).
- Some destructive actions still use native confirm or minimal affordance.
- No global skip-link or keyboard shortcut palette.

## 11) Responsive Behavior

- Global pattern: mobile-first utility classes (`p-4`, `sm:p-8`, etc.).
- Top nav:
- desktop horizontal nav
- mobile dropdown with overlay
- Dashboard:
- stacks to single column on small screens, 3-column at xl
- Calendar:
- month grid remains dense; details handled in modal
- Subjects:
- table uses horizontal scroll wrapper for narrow widths
- Execution:
- spreadsheet layout expects horizontal scrolling on small screens

## 12) UX Consistency Notes

### Strong consistency areas

- Shared shell for dashboard/planner/execution.
- Reused visual language (`glass-card`, gradient accents, subtle borders).
- Consistent toast-based global feedback.

### Notable inconsistencies or caveats

- Planner keep-mode copy says `future` is default in option text, but code default is `until`.
- `/execution` is outside middleware protected route list (auth still enforced by data result path).
- Some auxiliary components exist but are not mounted in current route tree (`WeekView`, `WeeklyTimetable`, `AddTaskForm`).

## 13) File-Level UI Map (Quick Reference)

### Global

- `app/layout.tsx`
- `app/globals.css`
- `app/components/Toast.tsx`
- `app/components/ThemeProvider.tsx`
- `app/components/ThemeToggle.tsx`
- `app/components/SubmitButton.tsx`

### Route pages

- `app/page.tsx`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/onboarding/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/subjects/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/settings/operations/page.tsx`
- `app/planner/page.tsx`
- `app/execution/page.tsx`

### Route shells and boundaries

- `app/dashboard/layout.tsx`
- `app/planner/layout.tsx`
- `app/execution/layout.tsx`
- `app/dashboard/loading.tsx`
- `app/dashboard/error.tsx`
- `app/dashboard/calendar/loading.tsx`
- `app/dashboard/calendar/error.tsx`
- `app/dashboard/subjects/loading.tsx`
- `app/dashboard/subjects/error.tsx`
- `app/dashboard/settings/loading.tsx`
- `app/dashboard/settings/error.tsx`

### Major route components

- `app/dashboard/Sidebar.tsx`
- `app/dashboard/QuickAddTask.tsx`
- `app/dashboard/ExecutionWidget.tsx`
- `app/dashboard/PlanHistory.tsx`
- `app/dashboard/RescheduleMissedButton.tsx`
- `app/dashboard/calendar/MonthView.tsx`
- `app/dashboard/subjects/subjects-data-table.tsx`
- `app/dashboard/subjects/SubjectDrawer.tsx`
- `app/dashboard/settings/SettingsForm.tsx`
- `app/dashboard/settings/OffDaysManager.tsx`
- `app/planner/components/PlannerStepper.tsx`
- `app/planner/components/StructureBuilder.tsx`
- `app/planner/components/ParamsEditor.tsx`
- `app/planner/components/ConstraintsForm.tsx`
- `app/planner/components/PlanPreview.tsx`
- `app/planner/components/PlanConfirm.tsx`
- `app/execution/ExecutionBoard.tsx`

---

This UI/UX document is complete for the current code snapshot and is suitable as an AI handoff reference for all implemented screens, interactions, and visual system behavior.
