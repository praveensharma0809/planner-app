# PROJECT_SPEC.md
## StudyHard — Formal Product Specification

**Version:** 2.0
**Status:** Pre-MVP Definition
**Last Updated:** February 28, 2026

---

## 1. Product Vision

StudyHard is a **Strategic Execution Engine** built for people who treat their preparation like a mission.

It is not a to-do app. It is not a journaling tool. It is a system that takes a person's workload, their available time, and their deadline — and converts it into a disciplined, structured, day-by-day execution plan.

The core promise: *You tell us what needs to be done and by when. We engineer a path to get there.*

The product must feel:
- Serious and controlled, like mission-control software
- Visually magnetic — a dashboard that stops you when you catch a glimpse
- Intelligent — it should feel like it's thinking ahead of you
- Honest — it shows you exactly where you stand, including flaws in your plan

---

## 2. Target Users

StudyHard is built for **any person preparing for a high-stakes goal** — primarily competitive exam aspirants, but not exclusively. The interface and language must remain open and non-specific so that a professional upskilling, a test-prep student, or a self-learner can all use it naturally.

**Do not label users as "students" in the UI.** Use neutral language like "you", "your plan", "your subjects."

**Primary users:**
- Competitive exam aspirants (GATE, UPSC, JEE, CA, etc.)
- Self-directed learners with deadlines
- Anyone who has a large body of material to cover in a defined timeframe

**Secondary users (future):**
- Academic students with semester-based goals
- Professionals preparing for certifications

---

## 3. Onboarding Flow

First-time users receive a **full guided onboarding experience** that is:
- Step-by-step
- Fully skippable at any point
- Non-intrusive — it guides but never blocks

### Onboarding Steps

**Step 1 — Profile Setup**
- Full name
- Primary goal/exam name (free text)
- **Final exam deadline** (the hard, global target date — e.g., the actual exam date)
- Daily available time in minutes

**Step 2 — Subject/Topic Setup**
- Add subjects or topics they need to cover
- For each subject, the user can optionally define:
  - Total items (lectures, chapters, problems — user defines the unit)
  - Average time per item (in minutes)
  - **Subject deadline** (an interim or self-imposed deadline, independent of the final exam date — e.g., "finish Physics by March 20")
  - If no subject deadline is set, the final exam deadline is used as the fallback
  - Priority level (1–5)
  - Whether it is mandatory (cannot be skipped)
  - Subtopics or chapters (optional, fully flexible depth)
- Users who skip detailed setup can proceed with just a subject name and revisit later

**Step 3 — Constraint Configuration**
- Daily study capacity (can differ from the profile default for specific subjects)
- Off-days or blocked days (holidays, rest days)
- Custom time availability per day (future-phase, skippable for now)

**Step 4 — Plan Preview (Blueprint Screen)**
- Before the plan is generated and saved, the user sees a full **Blueprint Screen** showing:
  - Total workload vs. available time
  - Projected daily load per subject
  - Deadline feasibility per subject (safe / tight / at risk / impossible)
  - Overload warnings with specific subjects flagged
  - Capacity gap: how many extra minutes/day are needed if overloaded
  - Suggested adjustments (reduce items, extend daily time, reprioritize)
  - If the plan is infeasible, the system surfaces specific conflicts and prompts the user to resolve them inline — adjusting deadlines, daily time, item counts, or priority — before proceeding
  - The system keeps asking and refining until the user arrives at a configuration that is either feasible or explicitly acknowledged as aggressive
  - There is no mode selection — the engine always tries to honor the user's constraints as fully as possible and flags what it cannot honor
- The user reviews the final blueprint, makes any last adjustments, and then confirms plan generation

**Step 5 — Plan Generated**
- Full schedule is written to the system
- User lands on their Dashboard

The onboarding tutorial ends here. Users can re-trigger this flow from settings.

---

## 4. Dashboard Behavior

The Dashboard is the **most important screen in the product.** It must be magnetic — something a user cannot scroll past without engaging with. It functions as mission control: one screen that tells the user exactly where they stand and what to do next.

### Dashboard Layout (Grid-Based)

The dashboard is composed of modular grid sections, each with a clear purpose:

---

**Grid 1 — Today's Mission**
- Lists all tasks scheduled for today
- Each task shows: subject name, duration, priority indicator, completion toggle
- Completed tasks are visually struck through or marked — they are never removed
- Incomplete tasks remain visible with a clear "pending" state
- If today has no tasks, it shows a clear idle state message

---

**Grid 2 — Plan Health & Progress**
- Visual progress bars per subject
- Shows: completed items / total items, % progress, days remaining to deadline
- Color-coded by deadline health:
  - Green = on track
  - Yellow = slightly behind
  - Red = at risk / behind significantly
- A single overall "Execution Score" synthesizing all subjects

---

**Grid 3 — Backlog Alert**
- Displays all tasks from previous dates that were not completed
- Grouped by date or subject
- When backlog exceeds a defined threshold (to be tuned during development), a prominent **Reschedule Suggestion Banner** appears:
  - "Your backlog has grown significantly. Consider regenerating your plan."
  - With a direct CTA button to the plan regeneration flow

---

**Grid 4 — Mini Calendar (Overview)**
- A compact monthly calendar showing task load per day (dot or count indicator)
- Clicking any date navigates to that day on the Calendar page
- Clicking the calendar grid header navigates to the full Calendar page
- This is a preview — not an interactive scheduling tool itself

---

**Grid 5 — Weekly Snapshot**
- Shows the current week's scheduled vs. completed tasks as a bar or compact chart
- Gives a quick sense of how this week is going

---

**Grid 6 — Streak Tracker**
- Tracks consecutive days where at least one task was completed
- Shows current streak and longest streak
- Visual indicator (flame, chain, or equivalent) that fits the serious identity of the product — not childish, but motivating
- Streak is broken if no task is completed on a scheduled day

---

**Grid 7 — Upcoming Deadlines**
- Lists subjects with their deadlines in ascending order
- Shows days remaining and completion % next to each
- Flags subjects that are approaching deadlines with low completion

---

### Dashboard Design Rules
- Every grid must always show meaningful data or a clear empty state — no blank panels
- The layout is responsive: grids resize and reflow for different screen sizes
- The visual language is serious, structured, and data-forward — no decorative elements without purpose
- Animations are controlled and purposeful — no looping or distracting motion

---

## 5. Planning Engine Rules

The planning engine is the core of the product. It runs **only when explicitly triggered by the user** via a "Generate Plan" button. It does not auto-generate.

### Input
- All subjects with their items, durations, deadlines (subject-level and/or final exam deadline), and priorities
- User's daily available minutes
- Any off-days or blocked dates

### Deadline Hierarchy
- **Final Exam Deadline**: The global hard deadline set on the user's profile. No task can be scheduled beyond this date.
- **Subject Deadline**: An optional per-subject target date. If set, the engine uses it to determine the burn rate for that subject. Must fall on or before the final exam deadline.
- If a subject has no deadline set, the final exam deadline is used as its effective deadline.
- Both types of deadlines are editable at any time.

### Processing Rules

1. **Workload Calculation**: For each subject, calculate total minutes required = total_items × avg_duration_minutes
2. **Burn Rate**: Calculate how many items/day are needed per subject to finish before its deadline
3. **Capacity Check**: Sum up all burn rates and compare against daily_available_minutes
4. **Overload Detection**: If total required daily minutes > available daily minutes, the plan is flagged as overloaded
5. **Conflict Resolution Loop**: Before writing anything, the system enters a refinement dialogue with the user:
   - It shows exactly which subjects are causing the conflict
   - It suggests specific, actionable adjustments (e.g., extend a subject deadline, reduce item count, increase daily time)
   - The user can make changes inline and the blueprint updates in real time
   - This loop continues until all conflicts are resolved or the user explicitly accepts and proceeds with an acknowledged aggressive plan
6. **Blueprint Generation**: Once the user is satisfied, show the final full analysis before writing the plan (same screen is reused for regeneration)
7. **Task Distribution**: Spread tasks across calendar days from today through each subject's effective deadline, respecting off-days and prioritizing mandatory subjects first, then by priority level, then by deadline proximity
8. **Task Granularity**: Each generated task represents one item (lecture, chapter, problem — as defined by the user) or a group if items are very short

### Plan Generation Output
- A set of daily tasks from today through the furthest deadline
- Each task is tagged with: subject, date, duration, priority, generated flag
- Existing future tasks from previous generated plans are replaced on regeneration
- Past tasks (completed or not) are never deleted or modified by regeneration

### Planning Mode
There is a single unified planning mode. The engine always:
- Attempts to honor every subject's deadline and priority
- Surfaces all conflicts transparently and asks the user to resolve them
- Never silently drops or defers tasks without the user's awareness
- Proceeds to generate only after the user confirms the final blueprint

The result is a plan that reflects exactly what the user agreed to — no hidden trade-offs.

---

## 6. Rescheduling Logic

StudyHard does **not automatically reschedule** when tasks are missed.

### Missed Task Behavior
- A task whose date has passed and is not completed becomes a **backlog item**
- It remains visible on the Dashboard in the Backlog Grid
- It remains visible on the Calendar on its original scheduled date (marked as missed)
- It is never moved or auto-reassigned

### Backlog Management
- Backlog items accumulate over time
- When backlog count or duration crosses a threshold, the system surfaces a **Reschedule Suggestion**
- The user decides when and whether to regenerate
- On regeneration, the blueprint screen accounts for the accumulated backlog and reflects it in the overload analysis

### Manual Regeneration
- The user can trigger plan regeneration at any time from the Dashboard or the Planner page
- Regeneration shows the blueprint first, then overwrites only future tasks
- Completed past tasks are preserved exactly as they are

---

## 7. Calendar Behavior

The Calendar page is a **full timeline view** of the user's plan.

### Features

- **Monthly Grid View**: Default view. Each day shows task count or total duration badge.
- **Day Modal / Expanded View**: Clicking a day opens a detailed view of all tasks for that day — scrollable, with subject tags, durations, and completion toggles.
- **Task Completion Inside Calendar**: Users can mark tasks complete directly from the day view without navigating away.
- **Drag and Reschedule**: Users can drag a task from one day to another to manually reschedule individual tasks. This is a direct move — no conflict resolution is performed automatically. If the destination day is overloaded, a warning is shown but the move is allowed.
- **Missed Task Indicator**: Days in the past with incomplete tasks are marked distinctly (e.g., muted red border or indicator).
- **Today Highlight**: Today's date is always visually prominent.
- **Navigation**: Users can navigate month by month. A "Jump to Today" control is always accessible.

### Calendar Rules
- The calendar is the canonical view of the schedule — what's on the calendar is what the plan says
- Manual drags are reflected immediately and persist
- Regenerating the plan from the planner replaces future generated tasks but not manually repositioned tasks (this behavior can be revisited — flagged for product decision)

---

## 8. Progress Tracking

Progress is tracked at three levels:

### Subject Level
- completed_items / total_items → shown as % and progress bar
- Estimated finish date based on current burn rate
- Deadline health status (on track / at risk / missed)

### Daily Level
- Tasks completed today vs. tasks scheduled today → daily completion %
- Shown on Dashboard (Today's Mission) and inside the Calendar day view

### Overall Level
- Aggregate completion across all subjects
- Weekly execution bar (completed vs. scheduled this week)
- Streak (consecutive days with at least one task completed)
- Backlog volume (total missed task-minutes)

### Completion State Rules
- A task is either completed (✓) or not — binary
- Completed tasks are marked visually and remain in place — they are never hidden or removed
- There is no "partial completion" at MVP
- There is no undo for task completion (flagged for future consideration)

---

## 9. Allowed User Actions

These are all the actions the user is permitted to take within the system:

### Subject Management
- Add a subject with full or partial details
- Edit any subject field at any time
- Delete a subject (with confirmation — warns that associated tasks will also be removed)
- Add subtopics or chapters under a subject (optional, flexible depth)
- Set or update deadline, priority, mandatory flag, custom daily time

### Task Management
- Mark any task as complete
- Manually add a custom task (not plan-generated) on any date
- Drag a task to a different date on the Calendar
- View all tasks — past, present, and future

### Plan Management
- Click "Generate Plan" to enter the blueprint and conflict-resolution flow
- Resolve conflicts inline (adjust deadlines, item counts, daily time, priorities) until the plan is satisfactory
- Confirm the final blueprint to write the plan
- Regenerate the plan at any time (replaces future tasks, preserves past)
- Review the blueprint before confirming any regeneration

### Profile & Settings
- Update daily available minutes
- Update the final exam deadline
- Update per-subject deadlines independently
- Update personal details
- Set off-days / blocked dates

### Onboarding
- Skip any onboarding step
- Re-trigger the onboarding tutorial from settings

---

## 10. What Is NOT Part of MVP

The following features are explicitly excluded from the MVP. They may be considered in future phases.

| Feature | Phase |
|---|---|
| Email or push notifications | Phase 2+ |
| Mobile app / PWA | Phase 3+ |
| Gamification (XP, badges, leaderboards) | Phase 3+ |
| AI-based suggestions or adaptive scheduling | Phase 3+ |
| Mentor / reviewer role | Phase 3+ |
| Notes, journaling, or rich text per task | Phase 3+ |
| Social features or sharing | Not planned |
| Multiple concurrent exam profiles | Phase 2 |
| Analytics dashboard (heatmaps, efficiency scores) | Phase 2 |
| Drag-to-reorder subject sequence | Phase 2 |
| Revision cycle scheduling | Phase 2 |
| Custom per-day time availability | Phase 2 |
| Undo for task completion | Phase 2 |
| Monetization / premium tier | Phase 4+ |
| Color themes or appearance customization | Not planned |

---

## 11. Core Product Rules (Non-Negotiable)

These rules must hold throughout the product at every phase:

1. **No silent failures.** Every operation that fails must surface a clear, specific message.
2. **No auto-mutations.** The system never changes the user's plan without explicit user action.
3. **Past data is sacred.** Completed tasks, past dates, and historical records are never modified or deleted by the system.
4. **Backlog is always visible.** Missed tasks are never hidden — they accumulate and are surfaced prominently.
5. **Blueprint before generation.** No plan is generated without the user first seeing the full analysis of feasibility.
6. **Language is neutral.** The product avoids "student" and exam-specific terminology in the UI. It speaks to any serious person with a goal.
7. **The dashboard is the heartbeat.** It must always reflect the true current state — no stale data, no empty states without meaning.
8. **Serious visual identity.** No gamification aesthetics, no childish visuals. The product looks and feels like professional execution software.

---

*End of PROJECT_SPEC.md*
