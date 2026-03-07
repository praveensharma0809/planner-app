# Code Citations

## License: unknown
https://github.com/akr3ch/akr3ch.github.io/blob/6d8dec10baca8a817126d668d0c3bb5f630b10af/cs/mysql

```
Now I have a thorough understanding of the entire system. Let me produce the comprehensive architecture redesign document.

---

# StudyHard Planner Redesign — Full Architecture Document

## 1. Current System Analysis

### 1.1 How the Current Planner Works

The planner follows a linear three-step pipeline:

1. **Analyze** — `analyzePlanAction()` loads the user's profile (capacity, exam date), all subjects, and off-days. It passes them through `overloadAnalyzer()` to determine feasibility, then through `scheduler()` to produce a flat list of `ScheduledTask` objects.
2. **Resolve** (conditional) — If overload is detected in strict mode, the user can propose a single adjustment (increase daily minutes, extend a deadline, or reduce items) and re-run analysis in memory via `resolveOverload()`.
3. **Commit** — `commitPlan()` deletes all future `is_plan_generated = true` tasks and bulk-inserts the new schedule.

The UI on `/planner` is a single page with an "Analyze Plan" button, an overload adjustment panel, a read-only preview grid, and a "Confirm & Commit" button.

### 1.2 How Workload is Represented

Workload is modeled at the **subject level** as:
- `total_items` — total number of work units (chapters, exercises, etc.)
- `completed_items` — how many are done
- `avg_duration_minutes` — time per item

Remaining work = `(total_items - completed_items) * avg_duration_minutes`

There is a `subtopics` table that allows sub-breakdown under a subject, but the planner engine **completely ignores subtopics**. The scheduler only reads `subjects` rows. Subtopics exist purely as a UI-level organizational aid.

### 1.3 How Scheduling Currently Happens

The scheduler iterates day-by-day from `today` to the latest subject deadline:
- Skips off-days
- Each day starts with `capacity = daily_available_minutes`
- Iterates subjects in sorted order (mandatory first → nearest deadline → highest urgency)
- Greedily fills the day with sessions of `avg_duration_minutes` each until capacity is exhausted or the subject's remaining items hit zero
- Emits one `ScheduledTask` per session

There is no concept of:
- Varying daily capacity (weekday vs. weekend)
- Partial days
- Revision or practice sessions
- Session limits per subject per day
- Topic-level granularity
- Dependencies between topics

### 1.4 How Tasks Are Generated

Each generated task is a flat row: `{ subject_id, scheduled_date, duration_minutes, title, priority }`. The title is hardcoded to `"SubjectName – Session"`. All sessions for a subject are identical in duration and shape. There is no way to distinguish what *content* a session covers.

### 1.5 Weaknesses in the Current Data Model

| Issue | Detail |
|---|---|
| **Flat hierarchy** | Only `Subject → Subtopic`. No `Topic` layer. Subtopics carry workload fields but are ignored by the planner — they're decorative. |
| **No topic-level scheduling** | The scheduler cannot assign work to specific topics or subtopics. Every task is just a generic "session" for a subject. |
| **Workload duplication** | Subjects have `total_items`/`completed_items`, subtopics have their own `total_items`/`completed_items`, and a DB view tries to reconcile with `COALESCE`. These can drift. |
| **Ghost intelligence columns** | `subjects` has `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` that are maintained by a DB trigger but **not used** by the planner engine, which computes its own values. Two sources of truth. |
| **No planning parameters table** | Scheduling parameters (priority, deadline) are baked into `subjects`. There's no separation between "what a subject is" (structure) and "how it should be scheduled" (planning parameters). |
| **No global constraints table** | Global planning settings (exam date, daily capacity, study start) are scattered across `profiles` columns. There's no dedicated planning configuration entity. |
| **off_days.id has no default** | Application code must supply the UUID — a schema bug. |
| **plan_events is minimal** | No snapshot of what was generated. No way to diff plans or roll back. |

### 1.6 Weaknesses in the Planner UX

| Issue | Detail |
|---|---|
| **No structured setup flow** | Users must set up subjects in `/dashboard/subjects`, off-days in `/dashboard/settings`, then navigate to `/planner`. No guided wizard. |
| **No visual editing** | The preview is read-only. Users cannot drag tasks, swap days, or adjust the generated plan before committing. |
| **Single adjustment at a time** | The overload resolution only applies one adjustment per re-analyze. Users can't batch changes. |
| **No topic visibility** | Tasks show "Subject – Session" with no indication of what topic/content to study. |
| **No plan versioning or comparison** | `plan_events` logs that a commit happened but doesn't store the actual schedule. No way to see what changed between plans. |
| **No undo after commit** | Commit deletes all future generated tasks and replaces them. No rollback mechanism. |

### 1.7 Database Design Issues

1. **Denormalized subject intelligence** — `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` are computed columns kept in sync by a trigger (`compute_subject_intelligence`). The planner ignores them. This is dead complexity.
2. **`subject_workload_view`** — aggregates data that the planner doesn't use. Dead code.
3. **DB functions `complete_task_with_streak` and `increment_completed_items`** — exist in the DB but the app doesn't call them. App code does the same logic inline.
4. **`completed_items` race condition** — `completeTask` reads `completed_items`, increments in JS, and writes back. Two concurrent completions can lose an increment. Should be an atomic `UPDATE ... SET completed_items = completed_items + 1`.
5. **No `archived` filter in planner query** — `analyzePlanAction` loads subjects by `user_id` without filtering `archived = false`. Archived subjects contaminate the schedule.

### 1.8 Architectural Inconsistencies

1. **Pure layer vs. server layer type drift** — `SchedulerMode` includes `"auto"` in the pure layer but the UI never exposes it. Dead codepath maintained across tests.
2. **`ScheduledTask` vs `Task`** — The scheduler produces `ScheduledTask` (no `id`, no `user_id`, no `completed`). `commitPlan` manually adds `user_id`, `completed`, `is_plan_generated`. This mapping is implicit.
3. **No transaction in `commitPlan`** — Delete + insert are separate calls. If insert fails after delete, the user loses their plan.
4. **No transaction in `completeTask`** — Three separate DB calls (update task → read+update subject → read+update profile) with no atomicity. Failure between steps leaves data inconsistent.
5. **Subtopics table is orphaned from planning** — The only link is `subject_id` FK. There's no way to schedule work at the subtopic level.

---

## 2. New Planner Architecture

### 2.1 Philosophy

The redesign replaces the current "analyze-and-commit" page with a **5-phase guided planner** inside `/planner`. Each phase collects specific inputs, and the system generates a plan only when all required inputs are available. The key principles:

- **Structure is separate from scheduling parameters** — Define what you'll study first, then how.
- **Minimize required inputs** — Most parameters should have smart defaults. Only subject name and estimated effort are truly required.
- **Topic-level scheduling** — The scheduler should produce tasks that reference specific topics, not just subjects.
- **Preview-then-commit** — Generated plans are editable in preview before any database writes.
- **Past is immutable** — Committed past tasks are never modified by replanning.

### 2.2 Five-Phase Workflow

#### Phase 1 — Subject Structure Builder

User defines their syllabus hierarchy:

```
Subject (required)
  → Topic (optional)
      → Subtopic (optional)
```

The system supports three valid structures:
- Subject only (e.g., "Mathematics")
- Subject → Topics (e.g., "Mathematics" → "Algebra", "Calculus")
- Subject → Topics → Subtopics (e.g., "Calculus" → "Limits", "Derivatives")

**This phase captures structure only.** No scheduling parameters. No durations. The user is building a tree of "what needs to be studied."

Data collected:
- Subject name
- Topic names (optional)
- Subtopic names (optional)
- Sort order within each level

#### Phase 2 — Planning Parameters

User provides scheduling parameters at the **lowest defined level** (topic if topics exist, subject otherwise). The system rolls parameters upward.

**Minimal required inputs per plannable unit:**

| Parameter | Required? | Default | Notes |
|---|---|---|---|
| `estimated_hours` | **Yes** | — | Total effort in hours for this topic/subject |
| `priority` | No | 3 (medium) | 1–5 scale |
| `deadline` | No | Global exam date | Per-topic override |

**Optional parameters (shown in "advanced"):**

| Parameter | Notes |
|---|---|
| `depends_on` | Array of topic IDs that must complete first |
| `earliest_start` | Don't schedule before this date |
| `revision_sessions` | Number of revision sessions to add after initial coverage |
| `practice_sessions` | Number of practice/mock sessions to intersperse |

**Why this is minimal:** Most students know how much effort a topic needs and can assign rough priority. Everything else has safe defaults. Dependencies and revision are power-user features.

**What was removed from the original spec:** The `session_duration` parameter (how long each session is) is not per-topic. It's derived from the global constraint `session_length_minutes` in Phase 3. This avoids asking users to think about session durations for every topic.

#### Phase 3 — Global Planning Constraints

User defines environmental constraints that shape the entire schedule.

**Required:**
| Parameter | Type | Notes |
|---|---|---|
| `study_start_date` | date | When planning begins (default: today) |
| `exam_date` | date | Hard deadline for all subjects without per-topic overrides |
| `weekday_capacity_minutes` | integer | Available minutes Mon–Fri |
| `weekend_capacity_minutes` | integer | Available minutes Sat–Sun |

**Optional:**
| Parameter | Type | Notes |
|---|---|---|
| `session_length_minutes` | integer | Target session duration (default: 45) |
| `max_sessions_per_day` | integer | Cap on number of sessions per day (default: derived from capacity / session length) |
| `final_revision_days` | integer | Reserved days before exam for revision only (default: 0) |
| `buffer_percentage` | integer | Percentage of capacity to leave as buffer (default: 10) — adds slack for life interruptions |

Off-days are loaded from the existing `off_days` table (already managed in settings).

**What was removed from the original spec:** Mock test settings, partial study days (replaced by weekday/weekend split), explicit rest days (subsumed by off-days + buffer). These added complexity without proportional scheduling benefit.

#### Phase 4 — Plan Generation + Visual Editing

The algorithm produces a day-by-day schedule. Each day contains sessions tied to specific topics (or subjects if no topics defined).

**Display format:**

| Day | Date | Sessions |
|---|---|---|
| Mon | 2026-03-09 | Algebra (45m), Organic Chemistry (45m), Physics – Mechanics (45m) |
| Tue | 2026-03-10 | Calculus – Limits (45m), History (45m) |

**Editing capabilities:**
- Move a session to a different day (drag or select)
- Remove a session from a day
- Add a session to a day
- Swap two sessions between days

All edits modify an in-memory working copy. No database writes occur.

**Feasibility indicators are live:** If an edit causes a feasibility problem (e.g., removes too many sessions for a topic that's tight on time), the UI warns immediately.

#### Phase 5 — Plan Confirmation

User reviews the final schedule and commits. The commit action:
1. Deletes future `is_plan_generated = true` tasks for the user
2. Inserts all new tasks
3. Creates a `plan_snapshot` record with the full generated schedule as JSON for history/rollback
4. Logs a `plan_event`

These steps run in a single database transaction (via a Postgres function) to prevent partial writes.

---

## 3. Planner Algorithm Design

### 3.1 Input Model

```typescript
interface PlanInput {
  units: PlannableUnit[]        // Topics or subjects (the lowest-defined level)
  constraints: GlobalConstraints
  offDays: Set<string>          // ISO dates
}

interface PlannableUnit {
  id: string
  subject_id: string
  name: string                  // "Subject > Topic" or just "Subject"
  estimated_minutes: number     // Total effort
  priority: number              // 1 (highest) to 5 (lowest)
  deadline: string              // ISO date (falls back to exam_date)
  earliest_start?: string       // ISO date
  depends_on?: string[]         // IDs of units that must finish first
  revision_sessions: number     // 0+
  practice_sessions: number     // 0+
}

interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  session_length_minutes: number  // default 45
  final_revision_days: number     // default 0
  buffer_percentage: number       // default 10
}
```

### 3.2 Algorithm Steps

**Step 1 — Session Decomposition**

Convert each `PlannableUnit` into sessions:

```
total_sessions = ceil(estimated_minutes / session_length_minutes)
core_sessions  = total_sessions
revision_sessions = unit.revision_sessions
practice_sessions = unit.practice_sessions
all_sessions = core_sessions + revision_sessions + practice_sessions
```

**Step 2 — Available Day Calculation**

Build the day list from `study_start_date` to `exam_date - final_revision_days` (the "core window"):

```
For each date in [study_start_date, exam_date - final_revision_days]:
  if date in offDays: skip
  capacity = isWeekend(date) ? weekend_capacity_minutes : weekday_capacity_minutes
  effective_capacity = capacity * (1 - buffer_percentage / 100)
  max_slots = floor(effective_capacity / session_length_minutes)
  add Day { date, max_slots, remaining_slots: max_slots }
```

**Step 3 — Feasibility Check**

Before scheduling, verify the plan is possible:

```
total_sessions_needed = sum of all_sessions for all units
total_slots_available = sum of max_slots for all days

if total_sessions_needed > total_slots_available:
  return INFEASIBLE with gap details
```

Per-unit feasibility (respecting deadlines):

```
For each unit:
  available_slots_before_deadline = sum of slots on days where
    date >= max(study_start_date, unit.earliest_start) AND
    date <= min(unit.deadline, exam_date - final_revision_days)
  if unit.all_sessions > available_slots_before_deadline:
    flag as INFEASIBLE with suggestions
```

**Step 4 — Priority-Weighted Scheduling**

The core scheduling algorithm uses a **priority queue** approach, not greedy sequential filling:

```
1. Create a priority queue of units sorted by:
   a. Urgency = sessions_remaining / days_until_deadline  (higher = more urgent)
   b. Priority tier (1 > 2 > 3 > 4 > 5)
   c. Dependencies satisfied (units whose deps are complete get priority)

2. For each day (in chronological order):
   while day has remaining slots:
     Pick the highest-urgency unit that:
       - has sessions remaining
       - has earliest_start <= current_date
       - has all depends_on units either complete or not yet started ← 
         (actually: all depends_on units have 0 remaining core sessions)
       - has deadline >= current_date
     If no eligible unit: break (leave slack)
     Assign one session, decrement unit's remaining sessions
     Recalculate urgency scores (since sessions_remaining decreased)

3. Schedule revision sessions:
   For each unit with revision sessions:
     Space them evenly across the last 1/3 of the unit's date range
     (or in the final_revision_days window if set)

4. Schedule practice sessions:
   For each unit with practice sessions:
     Space them evenly across the unit's date range, interleaved with core sessions
```

**Why priority queue over greedy fill:**
The current system iterates subjects in fixed order and greedily fills each day. This means the first subject in sort order dominates early days and starves later subjects. The priority queue dynamically recalculates urgency each day, ensuring all subjects get proportional attention.

### 3.3 Impossible Schedule Detection and Suggestions

When feasibility fails, the algorithm returns actionable suggestions:

| Condition | Suggestion |
|---|---|
| Total sessions > total slots | "Increase daily capacity by X minutes" or "Extend exam date by Y days" or "Remove Z sessions of effort" |
| Single unit's sessions > slots before its deadline | "Extend deadline for [Topic] by Y days" or "Reduce effort for [Topic] by Z hours" |
| Dependency chain too long for available time | "Remove dependency between [A] and [B]" |

Each suggestion is computed precisely:
- `extra_capacity_needed = ceil((sessions_gap * session_length) / available_days)` → "increase daily minutes by X"
- `extra_days_needed = ceil(sessions_gap / avg_daily_slots)` → "extend deadline by Y days"
- `sessions_to_cut = sessions_gap` → "reduce effort by Z hours (N sessions)"

### 3.4 Edge Cases

| Edge Case | Handling |
|---|---|
| Zero available days | Return INFEASIBLE immediately |
| Unit deadline before study_start_date | Flag as impossible, suggest extending deadline |
| Circular dependencies | Detect before scheduling, return error |
| All days are off-days | Return INFEASIBLE with "no available study days" |
| Session length > daily capacity | Return INFEASIBLE with "session length exceeds daily capacity" |
| Unit with 0 estimated hours | Skip (nothing to schedule) |
| Weekend-only student (weekday_capacity = 0) | Valid — only schedules on weekends |

---

## 4. New Database Schema

### 4.1 Design Principles

- Structure tables (what to study) are separate from planning tables (how to schedule)
- A single `plan_config` table stores all global constraints for a plan
- `topics` becomes a real entity between subjects and subtopics
- The `tasks` table gains a `topic_id` column for topic-level tracking
- Generated plans are snapshotted for history
- All user-owned tables have `user_id` with RLS on `auth.uid()`
- Intelligence columns are removed from `subjects` (the app computes what it needs)

### 4.2 Schema

#### `profiles` (modified — drop intelligence columns)

```sql
-- No structural changes needed. Keep as-is.
-- exam_date and daily_available_minutes stay for backward compat
-- but the planner reads from plan_config when available.
```

#### `subjects` (modified — simplified)

```sql
subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items`, `avg_duration_minutes`, `deadline`, `priority`, `mandatory`, `custom_daily_minutes`, `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date`.

Workload and scheduling parameters move to `topics` and `topic_params`. Subjects become purely structural containers.

#### `topics` (new)

```sql
topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### `subtopics` (modified — points to topics)

```sql
subtopics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id        uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items` (subtopics are structural only — effort lives on topics).

#### `topic_params` (new — scheduling parameters)

```sql
topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,                    -- NULL means use global exam_date
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',     -- topic IDs
  revision_sessions   integer NOT NULL DEFAULT 0,
  practice_sessions   integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
)
```

Note: For subjects with no topics, the system creates a single "default" topic with the subject's name. This normalizes the model — the scheduler always works with topics.

#### `plan_config` (new — global planning constraints)

```sql
plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
)
```

One config per user. Updated each time the user re-enters Phase 3.

#### `tasks` (modified — add topic_id, session_type)

```sql
tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id          uuid REFERENCES topics(id) ON DELETE SET NULL,
  title             text NOT NULL,
  scheduled_date    date NOT NULL,
  duration_minutes  integer NOT NULL CHECK (duration_minutes > 0),
  session_type      text NOT NULL DEFAULT 'core' CHECK (session_type IN ('core', 'revision', 'practice')),
  priority          integer NOT NULL DEFAULT 3,
  completed         boolean NOT NULL DEFAULT false,
  is_plan_generated boolean NOT NULL DEFAULT true,
  plan_version      uuid,          -- links to plan_snapshot that generated this task
  created_at        timestamptz NOT NULL DEFAULT now()
)
```

#### `off_days` (modified — add default for id)

```sql
off_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- FIX: add default
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
)
```

#### `plan_snapshots` (new — replaces plan_events for history)

```sql
plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL,      -- full generated schedule for diffing/rollback
  config_snapshot jsonb NOT NULL,      -- snapshot of plan_config at generation time
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### Execution tables — **unchanged**

`execution_categories`, `execution_items`, `execution_entries` are unrelated to the planner redesign and remain as-is.

### 4.3 Indexes

```sql
-- subjects
CREATE INDEX idx_subjects_user ON subjects(user_id);
CREATE INDEX idx_subjects_user_archived ON subjects(user_id, archived);

-- topics
CREATE INDEX idx_topics_subject ON topics(subject_id);
CREATE INDEX idx_topics_user ON topics(user_id);

-- subtopics
CREATE INDEX idx_subtopics_topic ON subtopics(topic_id);

-- topic_params
CREATE INDEX idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX idx_topic_params_user ON topic_params(user_id);

-- plan_config
-- UNIQUE(user_id) already serves as index

-- tasks
CREATE INDEX idx_tasks_user_date ON tasks(user_id, scheduled_date);
CREATE INDEX idx_tasks_subject ON tasks(subject_id);
CREATE INDEX idx_tasks_topic ON tasks(topic_id);
CREATE INDEX idx_tasks_plan_version ON tasks(plan_version);

-- off_days
CREATE INDEX idx_off_days_user ON off_days(user_id);

-- plan_snapshots
CREATE INDEX idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);
```

### 4.4 RLS Policies

Every user-owned table gets the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rows"   ON <table> FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own rows" ON <table> FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own rows" ON <table> FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own rows" ON <table> FOR DELETE USING (user_id = auth.uid());
```

Applied to: `subjects`, `topics`, `subtopics`, `topic_params`, `plan_config`, `tasks`, `off_days`, `plan_snapshots`.

---

## 5. Migration Strategy

### 5.1 Table Mapping

| Current | Action | New |
|---|---|---|
| `profiles` | **Keep** — no structural changes | `profiles` |
| `subjects` | **Transform** — strip workload columns, keep name/archived | `subjects` (slimmed) |
| `subtopics` | **Transform** — re-parent from subject_id to topic_id, drop workload cols | `subtopics` (re-parented) |
| `tasks` | **Modify** — add `topic_id`, `session_type`, `plan_version` | `tasks` (extended) |
| `off_days` | **Modify** — add default on `id` | `off_days` (fixed) |
| `plan_events` | **Drop** — replaced by `plan_snapshots` | (removed) |
| — | **Create** | `topics` |
| — | **Create** | `topic_params` |
| — | **Create** | `plan_config` |
| — | **Create** | `plan_snapshots` |
| `subject_workload_view` | **Drop** — no longer needed |
| `compute_subject_intelligence()` | **Drop** — no longer needed |
| `complete_task_with_streak()` | **Drop** — unused by app |
| `increment_completed_items()` | **Drop** — unused by app |
| `execution_*` | **Keep unchanged** | |

### 5.2 Data Migration Logic

1. **Subjects → Topics migration**: For each existing `subject`, create a corresponding `topic` with the same name. This "default topic" represents the subject-level workload that previously lived on the subject row.

2. **Subject workload → topic_params**: For each created topic (from step 1), create a `topic_params` row:
   - `estimated_hours = (total_items - completed_items) * avg_duration_minutes / 60.0`
   - `priority = subject.priority`
   - `deadline = subject.deadline`

3. **Subtopics re-parenting**: Existing subtopics reference `subject_id`. After creating topics, re-point subtopics to the matching topic via a mapping table. Since each old subject gets exactly one default topic, the mapping is 1:1.

4. **Tasks enrichment**: Existing tasks get `topic_id` set to the default topic for their `subject_id`, `session_type = 'core'`, `plan_version = NULL`.

5. **Profile → plan_config**: Create a `plan_config` row for each profile:
   - `study_start_date = today`
   - `exam_date = profiles.exam_date` (or today + 90 days if null)
   - `weekday_capacity_minutes = profiles.daily_available_minutes`
   - `weekend_capacity_minutes = profiles.daily_available_minutes`
   - `session_length_minutes = 45`

6. **plan_events → plan_snapshots**: Migrate existing `plan_events` into `plan_snapshots` with `schedule_json = '{}'::jsonb` (no historical schedule data is available, but we preserve the metadata).

### 5.3 Preservation Guarantees

- All existing tasks are preserved with their completion state
- All existing subjects are preserved (name, archived state)
- All off-days are preserved
- All execution board data is completely untouched
- User auth and profiles remain intact

---

## 6. SQL Migration Script

```sql
-- =============================================================================
-- StudyHard Planner Redesign Migration
-- Run against the production Supabase database
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

-- Topic planning parameters
CREATE TABLE IF NOT EXISTS topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',
  revision_sessions   integer NOT NULL DEFAULT 0 CHECK (revision_sessions >= 0),
  practice_sessions   integer NOT NULL DEFAULT 0 CHECK (practice_sessions >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_params_user ON topic_params(user_id);

-- Global plan configuration (one per user)
CREATE TABLE IF NOT EXISTS plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Plan snapshots (replaces plan_events)
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Migrate existing data into new structure
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Create a default topic for each existing subject
INSERT INTO topics (id, user_id, subject_id, name, sort_order, created_at)
SELECT
  gen_random_uuid(),
  s.user_id,
  s.id,
  s.name,
  0,
  s.created_at
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM topics t WHERE t.subject_id = s.id
);

-- 2b. Create topic_params from existing subject workload data
INSERT INTO topic_params (user_id, topic_id, estimated_hours, priority, deadline)
SELECT
  t.user_id,
  t.id,
  GREATEST(0, ROUND(((s.total_items - s.completed_items) * s.avg_duration_minutes) / 60.0, 1)),
  s.priority,
  s.deadline
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM topic_params tp WHERE tp.topic_id = t.id
);

-- 2c. Re-parent subtopics: add topic_id column, populate it, drop subject_id later
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE CASCADE;

UPDATE subtopics st
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = st.subject_id
  AND st.topic_id IS NULL;

-- 2d. Create plan_config from profiles
INSERT INTO plan_config (user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes)
SELECT
  p.id,
  CURRENT_DATE,
  COALESCE(p.exam_date, CURRENT_DATE + INTERVAL '90 days'),
  p.daily_available_minutes,
  p.daily_available_minutes
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_config pc WHERE pc.user_id = p.id
);

-- 2e. Migrate plan_events to plan_snapshots
INSERT INTO plan_snapshots (user_id, task_count, schedule_json, config_snapshot, summary, created_at)
SELECT
  pe.user_id,
  pe.task_count,
  '[]'::jsonb,
  '{}'::jsonb,
  pe.summary,
  pe.created_at
FROM plan_events pe
WHERE NOT EXISTS (
  SELECT 1 FROM plan_snapshots ps
  WHERE ps.user_id = pe.user_id AND ps.created_at = pe.created_at
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Modify existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Tasks: add topic_id, session_type, plan_version
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'core'
  CHECK (session_type IN ('core', 'revision', 'practice'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_version uuid;

-- Backfill topic_id for existing tasks
UPDATE tasks tk
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = tk.subject_id
  AND tk.topic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_version ON tasks(plan_version);

-- 3b. off_days: fix missing default on id
ALTER TABLE off_days ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3c. subtopics: drop old workload columns and subject_id FK after topic_id is populated
-- First make topic_id NOT NULL now that data is migrated
-- (Only if all rows have topic_id populated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subtopics WHERE topic_id IS NULL) THEN
    EXECUTE 'ALTER TABLE subtopics ALTER COLUMN topic_id SET NOT NULL';
  END IF;
END $$;

-- Drop old columns from subtopics
ALTER TABLE subtopics DROP COLUMN IF EXISTS total_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS subject_id;

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id);

-- 3d. Subjects: drop legacy workload/intelligence columns
ALTER TABLE subjects DROP COLUMN IF EXISTS total_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS avg_duration_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS deadline;
ALTER TABLE subjects DROP COLUMN IF EXISTS priority;
ALTER TABLE subjects DROP COLUMN IF EXISTS mandatory;
ALTER TABLE subjects DROP COLUMN IF EXISTS custom_daily_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS remaining_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS urgency_score;
ALTER TABLE subjects DROP COLUMN IF EXISTS health_state;
ALTER TABLE subjects DROP COLUMN IF EXISTS estimated_completion_date;

-- Add sort_order to subjects if not present
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Drop legacy objects
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS subject_workload_view;
DROP FUNCTION IF EXISTS compute_subject_intelligence() CASCADE;
DROP FUNCTION IF EXISTS complete_task_with_streak(uuid);
DROP FUNCTION IF EXISTS increment_completed_items(uuid);

-- Drop plan_events table (replaced by plan_snapshots)
DROP TABLE IF EXISTS plan_events;

-- Drop old subtopics indexes that reference dropped columns
DROP INDEX IF EXISTS idx_subtopics_subject_id;

-- Drop old constraints from subjects that reference dropped columns
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS avg_duration_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS total_items_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS completed_items_valid;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE topics
```


## License: unknown
https://github.com/akr3ch/akr3ch.github.io/blob/6d8dec10baca8a817126d668d0c3bb5f630b10af/cs/mysql

```
Now I have a thorough understanding of the entire system. Let me produce the comprehensive architecture redesign document.

---

# StudyHard Planner Redesign — Full Architecture Document

## 1. Current System Analysis

### 1.1 How the Current Planner Works

The planner follows a linear three-step pipeline:

1. **Analyze** — `analyzePlanAction()` loads the user's profile (capacity, exam date), all subjects, and off-days. It passes them through `overloadAnalyzer()` to determine feasibility, then through `scheduler()` to produce a flat list of `ScheduledTask` objects.
2. **Resolve** (conditional) — If overload is detected in strict mode, the user can propose a single adjustment (increase daily minutes, extend a deadline, or reduce items) and re-run analysis in memory via `resolveOverload()`.
3. **Commit** — `commitPlan()` deletes all future `is_plan_generated = true` tasks and bulk-inserts the new schedule.

The UI on `/planner` is a single page with an "Analyze Plan" button, an overload adjustment panel, a read-only preview grid, and a "Confirm & Commit" button.

### 1.2 How Workload is Represented

Workload is modeled at the **subject level** as:
- `total_items` — total number of work units (chapters, exercises, etc.)
- `completed_items` — how many are done
- `avg_duration_minutes` — time per item

Remaining work = `(total_items - completed_items) * avg_duration_minutes`

There is a `subtopics` table that allows sub-breakdown under a subject, but the planner engine **completely ignores subtopics**. The scheduler only reads `subjects` rows. Subtopics exist purely as a UI-level organizational aid.

### 1.3 How Scheduling Currently Happens

The scheduler iterates day-by-day from `today` to the latest subject deadline:
- Skips off-days
- Each day starts with `capacity = daily_available_minutes`
- Iterates subjects in sorted order (mandatory first → nearest deadline → highest urgency)
- Greedily fills the day with sessions of `avg_duration_minutes` each until capacity is exhausted or the subject's remaining items hit zero
- Emits one `ScheduledTask` per session

There is no concept of:
- Varying daily capacity (weekday vs. weekend)
- Partial days
- Revision or practice sessions
- Session limits per subject per day
- Topic-level granularity
- Dependencies between topics

### 1.4 How Tasks Are Generated

Each generated task is a flat row: `{ subject_id, scheduled_date, duration_minutes, title, priority }`. The title is hardcoded to `"SubjectName – Session"`. All sessions for a subject are identical in duration and shape. There is no way to distinguish what *content* a session covers.

### 1.5 Weaknesses in the Current Data Model

| Issue | Detail |
|---|---|
| **Flat hierarchy** | Only `Subject → Subtopic`. No `Topic` layer. Subtopics carry workload fields but are ignored by the planner — they're decorative. |
| **No topic-level scheduling** | The scheduler cannot assign work to specific topics or subtopics. Every task is just a generic "session" for a subject. |
| **Workload duplication** | Subjects have `total_items`/`completed_items`, subtopics have their own `total_items`/`completed_items`, and a DB view tries to reconcile with `COALESCE`. These can drift. |
| **Ghost intelligence columns** | `subjects` has `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` that are maintained by a DB trigger but **not used** by the planner engine, which computes its own values. Two sources of truth. |
| **No planning parameters table** | Scheduling parameters (priority, deadline) are baked into `subjects`. There's no separation between "what a subject is" (structure) and "how it should be scheduled" (planning parameters). |
| **No global constraints table** | Global planning settings (exam date, daily capacity, study start) are scattered across `profiles` columns. There's no dedicated planning configuration entity. |
| **off_days.id has no default** | Application code must supply the UUID — a schema bug. |
| **plan_events is minimal** | No snapshot of what was generated. No way to diff plans or roll back. |

### 1.6 Weaknesses in the Planner UX

| Issue | Detail |
|---|---|
| **No structured setup flow** | Users must set up subjects in `/dashboard/subjects`, off-days in `/dashboard/settings`, then navigate to `/planner`. No guided wizard. |
| **No visual editing** | The preview is read-only. Users cannot drag tasks, swap days, or adjust the generated plan before committing. |
| **Single adjustment at a time** | The overload resolution only applies one adjustment per re-analyze. Users can't batch changes. |
| **No topic visibility** | Tasks show "Subject – Session" with no indication of what topic/content to study. |
| **No plan versioning or comparison** | `plan_events` logs that a commit happened but doesn't store the actual schedule. No way to see what changed between plans. |
| **No undo after commit** | Commit deletes all future generated tasks and replaces them. No rollback mechanism. |

### 1.7 Database Design Issues

1. **Denormalized subject intelligence** — `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` are computed columns kept in sync by a trigger (`compute_subject_intelligence`). The planner ignores them. This is dead complexity.
2. **`subject_workload_view`** — aggregates data that the planner doesn't use. Dead code.
3. **DB functions `complete_task_with_streak` and `increment_completed_items`** — exist in the DB but the app doesn't call them. App code does the same logic inline.
4. **`completed_items` race condition** — `completeTask` reads `completed_items`, increments in JS, and writes back. Two concurrent completions can lose an increment. Should be an atomic `UPDATE ... SET completed_items = completed_items + 1`.
5. **No `archived` filter in planner query** — `analyzePlanAction` loads subjects by `user_id` without filtering `archived = false`. Archived subjects contaminate the schedule.

### 1.8 Architectural Inconsistencies

1. **Pure layer vs. server layer type drift** — `SchedulerMode` includes `"auto"` in the pure layer but the UI never exposes it. Dead codepath maintained across tests.
2. **`ScheduledTask` vs `Task`** — The scheduler produces `ScheduledTask` (no `id`, no `user_id`, no `completed`). `commitPlan` manually adds `user_id`, `completed`, `is_plan_generated`. This mapping is implicit.
3. **No transaction in `commitPlan`** — Delete + insert are separate calls. If insert fails after delete, the user loses their plan.
4. **No transaction in `completeTask`** — Three separate DB calls (update task → read+update subject → read+update profile) with no atomicity. Failure between steps leaves data inconsistent.
5. **Subtopics table is orphaned from planning** — The only link is `subject_id` FK. There's no way to schedule work at the subtopic level.

---

## 2. New Planner Architecture

### 2.1 Philosophy

The redesign replaces the current "analyze-and-commit" page with a **5-phase guided planner** inside `/planner`. Each phase collects specific inputs, and the system generates a plan only when all required inputs are available. The key principles:

- **Structure is separate from scheduling parameters** — Define what you'll study first, then how.
- **Minimize required inputs** — Most parameters should have smart defaults. Only subject name and estimated effort are truly required.
- **Topic-level scheduling** — The scheduler should produce tasks that reference specific topics, not just subjects.
- **Preview-then-commit** — Generated plans are editable in preview before any database writes.
- **Past is immutable** — Committed past tasks are never modified by replanning.

### 2.2 Five-Phase Workflow

#### Phase 1 — Subject Structure Builder

User defines their syllabus hierarchy:

```
Subject (required)
  → Topic (optional)
      → Subtopic (optional)
```

The system supports three valid structures:
- Subject only (e.g., "Mathematics")
- Subject → Topics (e.g., "Mathematics" → "Algebra", "Calculus")
- Subject → Topics → Subtopics (e.g., "Calculus" → "Limits", "Derivatives")

**This phase captures structure only.** No scheduling parameters. No durations. The user is building a tree of "what needs to be studied."

Data collected:
- Subject name
- Topic names (optional)
- Subtopic names (optional)
- Sort order within each level

#### Phase 2 — Planning Parameters

User provides scheduling parameters at the **lowest defined level** (topic if topics exist, subject otherwise). The system rolls parameters upward.

**Minimal required inputs per plannable unit:**

| Parameter | Required? | Default | Notes |
|---|---|---|---|
| `estimated_hours` | **Yes** | — | Total effort in hours for this topic/subject |
| `priority` | No | 3 (medium) | 1–5 scale |
| `deadline` | No | Global exam date | Per-topic override |

**Optional parameters (shown in "advanced"):**

| Parameter | Notes |
|---|---|
| `depends_on` | Array of topic IDs that must complete first |
| `earliest_start` | Don't schedule before this date |
| `revision_sessions` | Number of revision sessions to add after initial coverage |
| `practice_sessions` | Number of practice/mock sessions to intersperse |

**Why this is minimal:** Most students know how much effort a topic needs and can assign rough priority. Everything else has safe defaults. Dependencies and revision are power-user features.

**What was removed from the original spec:** The `session_duration` parameter (how long each session is) is not per-topic. It's derived from the global constraint `session_length_minutes` in Phase 3. This avoids asking users to think about session durations for every topic.

#### Phase 3 — Global Planning Constraints

User defines environmental constraints that shape the entire schedule.

**Required:**
| Parameter | Type | Notes |
|---|---|---|
| `study_start_date` | date | When planning begins (default: today) |
| `exam_date` | date | Hard deadline for all subjects without per-topic overrides |
| `weekday_capacity_minutes` | integer | Available minutes Mon–Fri |
| `weekend_capacity_minutes` | integer | Available minutes Sat–Sun |

**Optional:**
| Parameter | Type | Notes |
|---|---|---|
| `session_length_minutes` | integer | Target session duration (default: 45) |
| `max_sessions_per_day` | integer | Cap on number of sessions per day (default: derived from capacity / session length) |
| `final_revision_days` | integer | Reserved days before exam for revision only (default: 0) |
| `buffer_percentage` | integer | Percentage of capacity to leave as buffer (default: 10) — adds slack for life interruptions |

Off-days are loaded from the existing `off_days` table (already managed in settings).

**What was removed from the original spec:** Mock test settings, partial study days (replaced by weekday/weekend split), explicit rest days (subsumed by off-days + buffer). These added complexity without proportional scheduling benefit.

#### Phase 4 — Plan Generation + Visual Editing

The algorithm produces a day-by-day schedule. Each day contains sessions tied to specific topics (or subjects if no topics defined).

**Display format:**

| Day | Date | Sessions |
|---|---|---|
| Mon | 2026-03-09 | Algebra (45m), Organic Chemistry (45m), Physics – Mechanics (45m) |
| Tue | 2026-03-10 | Calculus – Limits (45m), History (45m) |

**Editing capabilities:**
- Move a session to a different day (drag or select)
- Remove a session from a day
- Add a session to a day
- Swap two sessions between days

All edits modify an in-memory working copy. No database writes occur.

**Feasibility indicators are live:** If an edit causes a feasibility problem (e.g., removes too many sessions for a topic that's tight on time), the UI warns immediately.

#### Phase 5 — Plan Confirmation

User reviews the final schedule and commits. The commit action:
1. Deletes future `is_plan_generated = true` tasks for the user
2. Inserts all new tasks
3. Creates a `plan_snapshot` record with the full generated schedule as JSON for history/rollback
4. Logs a `plan_event`

These steps run in a single database transaction (via a Postgres function) to prevent partial writes.

---

## 3. Planner Algorithm Design

### 3.1 Input Model

```typescript
interface PlanInput {
  units: PlannableUnit[]        // Topics or subjects (the lowest-defined level)
  constraints: GlobalConstraints
  offDays: Set<string>          // ISO dates
}

interface PlannableUnit {
  id: string
  subject_id: string
  name: string                  // "Subject > Topic" or just "Subject"
  estimated_minutes: number     // Total effort
  priority: number              // 1 (highest) to 5 (lowest)
  deadline: string              // ISO date (falls back to exam_date)
  earliest_start?: string       // ISO date
  depends_on?: string[]         // IDs of units that must finish first
  revision_sessions: number     // 0+
  practice_sessions: number     // 0+
}

interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  session_length_minutes: number  // default 45
  final_revision_days: number     // default 0
  buffer_percentage: number       // default 10
}
```

### 3.2 Algorithm Steps

**Step 1 — Session Decomposition**

Convert each `PlannableUnit` into sessions:

```
total_sessions = ceil(estimated_minutes / session_length_minutes)
core_sessions  = total_sessions
revision_sessions = unit.revision_sessions
practice_sessions = unit.practice_sessions
all_sessions = core_sessions + revision_sessions + practice_sessions
```

**Step 2 — Available Day Calculation**

Build the day list from `study_start_date` to `exam_date - final_revision_days` (the "core window"):

```
For each date in [study_start_date, exam_date - final_revision_days]:
  if date in offDays: skip
  capacity = isWeekend(date) ? weekend_capacity_minutes : weekday_capacity_minutes
  effective_capacity = capacity * (1 - buffer_percentage / 100)
  max_slots = floor(effective_capacity / session_length_minutes)
  add Day { date, max_slots, remaining_slots: max_slots }
```

**Step 3 — Feasibility Check**

Before scheduling, verify the plan is possible:

```
total_sessions_needed = sum of all_sessions for all units
total_slots_available = sum of max_slots for all days

if total_sessions_needed > total_slots_available:
  return INFEASIBLE with gap details
```

Per-unit feasibility (respecting deadlines):

```
For each unit:
  available_slots_before_deadline = sum of slots on days where
    date >= max(study_start_date, unit.earliest_start) AND
    date <= min(unit.deadline, exam_date - final_revision_days)
  if unit.all_sessions > available_slots_before_deadline:
    flag as INFEASIBLE with suggestions
```

**Step 4 — Priority-Weighted Scheduling**

The core scheduling algorithm uses a **priority queue** approach, not greedy sequential filling:

```
1. Create a priority queue of units sorted by:
   a. Urgency = sessions_remaining / days_until_deadline  (higher = more urgent)
   b. Priority tier (1 > 2 > 3 > 4 > 5)
   c. Dependencies satisfied (units whose deps are complete get priority)

2. For each day (in chronological order):
   while day has remaining slots:
     Pick the highest-urgency unit that:
       - has sessions remaining
       - has earliest_start <= current_date
       - has all depends_on units either complete or not yet started ← 
         (actually: all depends_on units have 0 remaining core sessions)
       - has deadline >= current_date
     If no eligible unit: break (leave slack)
     Assign one session, decrement unit's remaining sessions
     Recalculate urgency scores (since sessions_remaining decreased)

3. Schedule revision sessions:
   For each unit with revision sessions:
     Space them evenly across the last 1/3 of the unit's date range
     (or in the final_revision_days window if set)

4. Schedule practice sessions:
   For each unit with practice sessions:
     Space them evenly across the unit's date range, interleaved with core sessions
```

**Why priority queue over greedy fill:**
The current system iterates subjects in fixed order and greedily fills each day. This means the first subject in sort order dominates early days and starves later subjects. The priority queue dynamically recalculates urgency each day, ensuring all subjects get proportional attention.

### 3.3 Impossible Schedule Detection and Suggestions

When feasibility fails, the algorithm returns actionable suggestions:

| Condition | Suggestion |
|---|---|
| Total sessions > total slots | "Increase daily capacity by X minutes" or "Extend exam date by Y days" or "Remove Z sessions of effort" |
| Single unit's sessions > slots before its deadline | "Extend deadline for [Topic] by Y days" or "Reduce effort for [Topic] by Z hours" |
| Dependency chain too long for available time | "Remove dependency between [A] and [B]" |

Each suggestion is computed precisely:
- `extra_capacity_needed = ceil((sessions_gap * session_length) / available_days)` → "increase daily minutes by X"
- `extra_days_needed = ceil(sessions_gap / avg_daily_slots)` → "extend deadline by Y days"
- `sessions_to_cut = sessions_gap` → "reduce effort by Z hours (N sessions)"

### 3.4 Edge Cases

| Edge Case | Handling |
|---|---|
| Zero available days | Return INFEASIBLE immediately |
| Unit deadline before study_start_date | Flag as impossible, suggest extending deadline |
| Circular dependencies | Detect before scheduling, return error |
| All days are off-days | Return INFEASIBLE with "no available study days" |
| Session length > daily capacity | Return INFEASIBLE with "session length exceeds daily capacity" |
| Unit with 0 estimated hours | Skip (nothing to schedule) |
| Weekend-only student (weekday_capacity = 0) | Valid — only schedules on weekends |

---

## 4. New Database Schema

### 4.1 Design Principles

- Structure tables (what to study) are separate from planning tables (how to schedule)
- A single `plan_config` table stores all global constraints for a plan
- `topics` becomes a real entity between subjects and subtopics
- The `tasks` table gains a `topic_id` column for topic-level tracking
- Generated plans are snapshotted for history
- All user-owned tables have `user_id` with RLS on `auth.uid()`
- Intelligence columns are removed from `subjects` (the app computes what it needs)

### 4.2 Schema

#### `profiles` (modified — drop intelligence columns)

```sql
-- No structural changes needed. Keep as-is.
-- exam_date and daily_available_minutes stay for backward compat
-- but the planner reads from plan_config when available.
```

#### `subjects` (modified — simplified)

```sql
subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items`, `avg_duration_minutes`, `deadline`, `priority`, `mandatory`, `custom_daily_minutes`, `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date`.

Workload and scheduling parameters move to `topics` and `topic_params`. Subjects become purely structural containers.

#### `topics` (new)

```sql
topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### `subtopics` (modified — points to topics)

```sql
subtopics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id        uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items` (subtopics are structural only — effort lives on topics).

#### `topic_params` (new — scheduling parameters)

```sql
topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,                    -- NULL means use global exam_date
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',     -- topic IDs
  revision_sessions   integer NOT NULL DEFAULT 0,
  practice_sessions   integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
)
```

Note: For subjects with no topics, the system creates a single "default" topic with the subject's name. This normalizes the model — the scheduler always works with topics.

#### `plan_config` (new — global planning constraints)

```sql
plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
)
```

One config per user. Updated each time the user re-enters Phase 3.

#### `tasks` (modified — add topic_id, session_type)

```sql
tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id          uuid REFERENCES topics(id) ON DELETE SET NULL,
  title             text NOT NULL,
  scheduled_date    date NOT NULL,
  duration_minutes  integer NOT NULL CHECK (duration_minutes > 0),
  session_type      text NOT NULL DEFAULT 'core' CHECK (session_type IN ('core', 'revision', 'practice')),
  priority          integer NOT NULL DEFAULT 3,
  completed         boolean NOT NULL DEFAULT false,
  is_plan_generated boolean NOT NULL DEFAULT true,
  plan_version      uuid,          -- links to plan_snapshot that generated this task
  created_at        timestamptz NOT NULL DEFAULT now()
)
```

#### `off_days` (modified — add default for id)

```sql
off_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- FIX: add default
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
)
```

#### `plan_snapshots` (new — replaces plan_events for history)

```sql
plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL,      -- full generated schedule for diffing/rollback
  config_snapshot jsonb NOT NULL,      -- snapshot of plan_config at generation time
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### Execution tables — **unchanged**

`execution_categories`, `execution_items`, `execution_entries` are unrelated to the planner redesign and remain as-is.

### 4.3 Indexes

```sql
-- subjects
CREATE INDEX idx_subjects_user ON subjects(user_id);
CREATE INDEX idx_subjects_user_archived ON subjects(user_id, archived);

-- topics
CREATE INDEX idx_topics_subject ON topics(subject_id);
CREATE INDEX idx_topics_user ON topics(user_id);

-- subtopics
CREATE INDEX idx_subtopics_topic ON subtopics(topic_id);

-- topic_params
CREATE INDEX idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX idx_topic_params_user ON topic_params(user_id);

-- plan_config
-- UNIQUE(user_id) already serves as index

-- tasks
CREATE INDEX idx_tasks_user_date ON tasks(user_id, scheduled_date);
CREATE INDEX idx_tasks_subject ON tasks(subject_id);
CREATE INDEX idx_tasks_topic ON tasks(topic_id);
CREATE INDEX idx_tasks_plan_version ON tasks(plan_version);

-- off_days
CREATE INDEX idx_off_days_user ON off_days(user_id);

-- plan_snapshots
CREATE INDEX idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);
```

### 4.4 RLS Policies

Every user-owned table gets the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rows"   ON <table> FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own rows" ON <table> FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own rows" ON <table> FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own rows" ON <table> FOR DELETE USING (user_id = auth.uid());
```

Applied to: `subjects`, `topics`, `subtopics`, `topic_params`, `plan_config`, `tasks`, `off_days`, `plan_snapshots`.

---

## 5. Migration Strategy

### 5.1 Table Mapping

| Current | Action | New |
|---|---|---|
| `profiles` | **Keep** — no structural changes | `profiles` |
| `subjects` | **Transform** — strip workload columns, keep name/archived | `subjects` (slimmed) |
| `subtopics` | **Transform** — re-parent from subject_id to topic_id, drop workload cols | `subtopics` (re-parented) |
| `tasks` | **Modify** — add `topic_id`, `session_type`, `plan_version` | `tasks` (extended) |
| `off_days` | **Modify** — add default on `id` | `off_days` (fixed) |
| `plan_events` | **Drop** — replaced by `plan_snapshots` | (removed) |
| — | **Create** | `topics` |
| — | **Create** | `topic_params` |
| — | **Create** | `plan_config` |
| — | **Create** | `plan_snapshots` |
| `subject_workload_view` | **Drop** — no longer needed |
| `compute_subject_intelligence()` | **Drop** — no longer needed |
| `complete_task_with_streak()` | **Drop** — unused by app |
| `increment_completed_items()` | **Drop** — unused by app |
| `execution_*` | **Keep unchanged** | |

### 5.2 Data Migration Logic

1. **Subjects → Topics migration**: For each existing `subject`, create a corresponding `topic` with the same name. This "default topic" represents the subject-level workload that previously lived on the subject row.

2. **Subject workload → topic_params**: For each created topic (from step 1), create a `topic_params` row:
   - `estimated_hours = (total_items - completed_items) * avg_duration_minutes / 60.0`
   - `priority = subject.priority`
   - `deadline = subject.deadline`

3. **Subtopics re-parenting**: Existing subtopics reference `subject_id`. After creating topics, re-point subtopics to the matching topic via a mapping table. Since each old subject gets exactly one default topic, the mapping is 1:1.

4. **Tasks enrichment**: Existing tasks get `topic_id` set to the default topic for their `subject_id`, `session_type = 'core'`, `plan_version = NULL`.

5. **Profile → plan_config**: Create a `plan_config` row for each profile:
   - `study_start_date = today`
   - `exam_date = profiles.exam_date` (or today + 90 days if null)
   - `weekday_capacity_minutes = profiles.daily_available_minutes`
   - `weekend_capacity_minutes = profiles.daily_available_minutes`
   - `session_length_minutes = 45`

6. **plan_events → plan_snapshots**: Migrate existing `plan_events` into `plan_snapshots` with `schedule_json = '{}'::jsonb` (no historical schedule data is available, but we preserve the metadata).

### 5.3 Preservation Guarantees

- All existing tasks are preserved with their completion state
- All existing subjects are preserved (name, archived state)
- All off-days are preserved
- All execution board data is completely untouched
- User auth and profiles remain intact

---

## 6. SQL Migration Script

```sql
-- =============================================================================
-- StudyHard Planner Redesign Migration
-- Run against the production Supabase database
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

-- Topic planning parameters
CREATE TABLE IF NOT EXISTS topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',
  revision_sessions   integer NOT NULL DEFAULT 0 CHECK (revision_sessions >= 0),
  practice_sessions   integer NOT NULL DEFAULT 0 CHECK (practice_sessions >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_params_user ON topic_params(user_id);

-- Global plan configuration (one per user)
CREATE TABLE IF NOT EXISTS plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Plan snapshots (replaces plan_events)
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Migrate existing data into new structure
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Create a default topic for each existing subject
INSERT INTO topics (id, user_id, subject_id, name, sort_order, created_at)
SELECT
  gen_random_uuid(),
  s.user_id,
  s.id,
  s.name,
  0,
  s.created_at
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM topics t WHERE t.subject_id = s.id
);

-- 2b. Create topic_params from existing subject workload data
INSERT INTO topic_params (user_id, topic_id, estimated_hours, priority, deadline)
SELECT
  t.user_id,
  t.id,
  GREATEST(0, ROUND(((s.total_items - s.completed_items) * s.avg_duration_minutes) / 60.0, 1)),
  s.priority,
  s.deadline
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM topic_params tp WHERE tp.topic_id = t.id
);

-- 2c. Re-parent subtopics: add topic_id column, populate it, drop subject_id later
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE CASCADE;

UPDATE subtopics st
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = st.subject_id
  AND st.topic_id IS NULL;

-- 2d. Create plan_config from profiles
INSERT INTO plan_config (user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes)
SELECT
  p.id,
  CURRENT_DATE,
  COALESCE(p.exam_date, CURRENT_DATE + INTERVAL '90 days'),
  p.daily_available_minutes,
  p.daily_available_minutes
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_config pc WHERE pc.user_id = p.id
);

-- 2e. Migrate plan_events to plan_snapshots
INSERT INTO plan_snapshots (user_id, task_count, schedule_json, config_snapshot, summary, created_at)
SELECT
  pe.user_id,
  pe.task_count,
  '[]'::jsonb,
  '{}'::jsonb,
  pe.summary,
  pe.created_at
FROM plan_events pe
WHERE NOT EXISTS (
  SELECT 1 FROM plan_snapshots ps
  WHERE ps.user_id = pe.user_id AND ps.created_at = pe.created_at
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Modify existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Tasks: add topic_id, session_type, plan_version
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'core'
  CHECK (session_type IN ('core', 'revision', 'practice'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_version uuid;

-- Backfill topic_id for existing tasks
UPDATE tasks tk
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = tk.subject_id
  AND tk.topic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_version ON tasks(plan_version);

-- 3b. off_days: fix missing default on id
ALTER TABLE off_days ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3c. subtopics: drop old workload columns and subject_id FK after topic_id is populated
-- First make topic_id NOT NULL now that data is migrated
-- (Only if all rows have topic_id populated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subtopics WHERE topic_id IS NULL) THEN
    EXECUTE 'ALTER TABLE subtopics ALTER COLUMN topic_id SET NOT NULL';
  END IF;
END $$;

-- Drop old columns from subtopics
ALTER TABLE subtopics DROP COLUMN IF EXISTS total_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS subject_id;

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id);

-- 3d. Subjects: drop legacy workload/intelligence columns
ALTER TABLE subjects DROP COLUMN IF EXISTS total_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS avg_duration_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS deadline;
ALTER TABLE subjects DROP COLUMN IF EXISTS priority;
ALTER TABLE subjects DROP COLUMN IF EXISTS mandatory;
ALTER TABLE subjects DROP COLUMN IF EXISTS custom_daily_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS remaining_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS urgency_score;
ALTER TABLE subjects DROP COLUMN IF EXISTS health_state;
ALTER TABLE subjects DROP COLUMN IF EXISTS estimated_completion_date;

-- Add sort_order to subjects if not present
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Drop legacy objects
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS subject_workload_view;
DROP FUNCTION IF EXISTS compute_subject_intelligence() CASCADE;
DROP FUNCTION IF EXISTS complete_task_with_streak(uuid);
DROP FUNCTION IF EXISTS increment_completed_items(uuid);

-- Drop plan_events table (replaced by plan_snapshots)
DROP TABLE IF EXISTS plan_events;

-- Drop old subtopics indexes that reference dropped columns
DROP INDEX IF EXISTS idx_subtopics_subject_id;

-- Drop old constraints from subjects that reference dropped columns
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS avg_duration_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS total_items_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS completed_items_valid;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE topics
```


## License: unknown
https://github.com/akr3ch/akr3ch.github.io/blob/6d8dec10baca8a817126d668d0c3bb5f630b10af/cs/mysql

```
Now I have a thorough understanding of the entire system. Let me produce the comprehensive architecture redesign document.

---

# StudyHard Planner Redesign — Full Architecture Document

## 1. Current System Analysis

### 1.1 How the Current Planner Works

The planner follows a linear three-step pipeline:

1. **Analyze** — `analyzePlanAction()` loads the user's profile (capacity, exam date), all subjects, and off-days. It passes them through `overloadAnalyzer()` to determine feasibility, then through `scheduler()` to produce a flat list of `ScheduledTask` objects.
2. **Resolve** (conditional) — If overload is detected in strict mode, the user can propose a single adjustment (increase daily minutes, extend a deadline, or reduce items) and re-run analysis in memory via `resolveOverload()`.
3. **Commit** — `commitPlan()` deletes all future `is_plan_generated = true` tasks and bulk-inserts the new schedule.

The UI on `/planner` is a single page with an "Analyze Plan" button, an overload adjustment panel, a read-only preview grid, and a "Confirm & Commit" button.

### 1.2 How Workload is Represented

Workload is modeled at the **subject level** as:
- `total_items` — total number of work units (chapters, exercises, etc.)
- `completed_items` — how many are done
- `avg_duration_minutes` — time per item

Remaining work = `(total_items - completed_items) * avg_duration_minutes`

There is a `subtopics` table that allows sub-breakdown under a subject, but the planner engine **completely ignores subtopics**. The scheduler only reads `subjects` rows. Subtopics exist purely as a UI-level organizational aid.

### 1.3 How Scheduling Currently Happens

The scheduler iterates day-by-day from `today` to the latest subject deadline:
- Skips off-days
- Each day starts with `capacity = daily_available_minutes`
- Iterates subjects in sorted order (mandatory first → nearest deadline → highest urgency)
- Greedily fills the day with sessions of `avg_duration_minutes` each until capacity is exhausted or the subject's remaining items hit zero
- Emits one `ScheduledTask` per session

There is no concept of:
- Varying daily capacity (weekday vs. weekend)
- Partial days
- Revision or practice sessions
- Session limits per subject per day
- Topic-level granularity
- Dependencies between topics

### 1.4 How Tasks Are Generated

Each generated task is a flat row: `{ subject_id, scheduled_date, duration_minutes, title, priority }`. The title is hardcoded to `"SubjectName – Session"`. All sessions for a subject are identical in duration and shape. There is no way to distinguish what *content* a session covers.

### 1.5 Weaknesses in the Current Data Model

| Issue | Detail |
|---|---|
| **Flat hierarchy** | Only `Subject → Subtopic`. No `Topic` layer. Subtopics carry workload fields but are ignored by the planner — they're decorative. |
| **No topic-level scheduling** | The scheduler cannot assign work to specific topics or subtopics. Every task is just a generic "session" for a subject. |
| **Workload duplication** | Subjects have `total_items`/`completed_items`, subtopics have their own `total_items`/`completed_items`, and a DB view tries to reconcile with `COALESCE`. These can drift. |
| **Ghost intelligence columns** | `subjects` has `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` that are maintained by a DB trigger but **not used** by the planner engine, which computes its own values. Two sources of truth. |
| **No planning parameters table** | Scheduling parameters (priority, deadline) are baked into `subjects`. There's no separation between "what a subject is" (structure) and "how it should be scheduled" (planning parameters). |
| **No global constraints table** | Global planning settings (exam date, daily capacity, study start) are scattered across `profiles` columns. There's no dedicated planning configuration entity. |
| **off_days.id has no default** | Application code must supply the UUID — a schema bug. |
| **plan_events is minimal** | No snapshot of what was generated. No way to diff plans or roll back. |

### 1.6 Weaknesses in the Planner UX

| Issue | Detail |
|---|---|
| **No structured setup flow** | Users must set up subjects in `/dashboard/subjects`, off-days in `/dashboard/settings`, then navigate to `/planner`. No guided wizard. |
| **No visual editing** | The preview is read-only. Users cannot drag tasks, swap days, or adjust the generated plan before committing. |
| **Single adjustment at a time** | The overload resolution only applies one adjustment per re-analyze. Users can't batch changes. |
| **No topic visibility** | Tasks show "Subject – Session" with no indication of what topic/content to study. |
| **No plan versioning or comparison** | `plan_events` logs that a commit happened but doesn't store the actual schedule. No way to see what changed between plans. |
| **No undo after commit** | Commit deletes all future generated tasks and replaces them. No rollback mechanism. |

### 1.7 Database Design Issues

1. **Denormalized subject intelligence** — `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date` are computed columns kept in sync by a trigger (`compute_subject_intelligence`). The planner ignores them. This is dead complexity.
2. **`subject_workload_view`** — aggregates data that the planner doesn't use. Dead code.
3. **DB functions `complete_task_with_streak` and `increment_completed_items`** — exist in the DB but the app doesn't call them. App code does the same logic inline.
4. **`completed_items` race condition** — `completeTask` reads `completed_items`, increments in JS, and writes back. Two concurrent completions can lose an increment. Should be an atomic `UPDATE ... SET completed_items = completed_items + 1`.
5. **No `archived` filter in planner query** — `analyzePlanAction` loads subjects by `user_id` without filtering `archived = false`. Archived subjects contaminate the schedule.

### 1.8 Architectural Inconsistencies

1. **Pure layer vs. server layer type drift** — `SchedulerMode` includes `"auto"` in the pure layer but the UI never exposes it. Dead codepath maintained across tests.
2. **`ScheduledTask` vs `Task`** — The scheduler produces `ScheduledTask` (no `id`, no `user_id`, no `completed`). `commitPlan` manually adds `user_id`, `completed`, `is_plan_generated`. This mapping is implicit.
3. **No transaction in `commitPlan`** — Delete + insert are separate calls. If insert fails after delete, the user loses their plan.
4. **No transaction in `completeTask`** — Three separate DB calls (update task → read+update subject → read+update profile) with no atomicity. Failure between steps leaves data inconsistent.
5. **Subtopics table is orphaned from planning** — The only link is `subject_id` FK. There's no way to schedule work at the subtopic level.

---

## 2. New Planner Architecture

### 2.1 Philosophy

The redesign replaces the current "analyze-and-commit" page with a **5-phase guided planner** inside `/planner`. Each phase collects specific inputs, and the system generates a plan only when all required inputs are available. The key principles:

- **Structure is separate from scheduling parameters** — Define what you'll study first, then how.
- **Minimize required inputs** — Most parameters should have smart defaults. Only subject name and estimated effort are truly required.
- **Topic-level scheduling** — The scheduler should produce tasks that reference specific topics, not just subjects.
- **Preview-then-commit** — Generated plans are editable in preview before any database writes.
- **Past is immutable** — Committed past tasks are never modified by replanning.

### 2.2 Five-Phase Workflow

#### Phase 1 — Subject Structure Builder

User defines their syllabus hierarchy:

```
Subject (required)
  → Topic (optional)
      → Subtopic (optional)
```

The system supports three valid structures:
- Subject only (e.g., "Mathematics")
- Subject → Topics (e.g., "Mathematics" → "Algebra", "Calculus")
- Subject → Topics → Subtopics (e.g., "Calculus" → "Limits", "Derivatives")

**This phase captures structure only.** No scheduling parameters. No durations. The user is building a tree of "what needs to be studied."

Data collected:
- Subject name
- Topic names (optional)
- Subtopic names (optional)
- Sort order within each level

#### Phase 2 — Planning Parameters

User provides scheduling parameters at the **lowest defined level** (topic if topics exist, subject otherwise). The system rolls parameters upward.

**Minimal required inputs per plannable unit:**

| Parameter | Required? | Default | Notes |
|---|---|---|---|
| `estimated_hours` | **Yes** | — | Total effort in hours for this topic/subject |
| `priority` | No | 3 (medium) | 1–5 scale |
| `deadline` | No | Global exam date | Per-topic override |

**Optional parameters (shown in "advanced"):**

| Parameter | Notes |
|---|---|
| `depends_on` | Array of topic IDs that must complete first |
| `earliest_start` | Don't schedule before this date |
| `revision_sessions` | Number of revision sessions to add after initial coverage |
| `practice_sessions` | Number of practice/mock sessions to intersperse |

**Why this is minimal:** Most students know how much effort a topic needs and can assign rough priority. Everything else has safe defaults. Dependencies and revision are power-user features.

**What was removed from the original spec:** The `session_duration` parameter (how long each session is) is not per-topic. It's derived from the global constraint `session_length_minutes` in Phase 3. This avoids asking users to think about session durations for every topic.

#### Phase 3 — Global Planning Constraints

User defines environmental constraints that shape the entire schedule.

**Required:**
| Parameter | Type | Notes |
|---|---|---|
| `study_start_date` | date | When planning begins (default: today) |
| `exam_date` | date | Hard deadline for all subjects without per-topic overrides |
| `weekday_capacity_minutes` | integer | Available minutes Mon–Fri |
| `weekend_capacity_minutes` | integer | Available minutes Sat–Sun |

**Optional:**
| Parameter | Type | Notes |
|---|---|---|
| `session_length_minutes` | integer | Target session duration (default: 45) |
| `max_sessions_per_day` | integer | Cap on number of sessions per day (default: derived from capacity / session length) |
| `final_revision_days` | integer | Reserved days before exam for revision only (default: 0) |
| `buffer_percentage` | integer | Percentage of capacity to leave as buffer (default: 10) — adds slack for life interruptions |

Off-days are loaded from the existing `off_days` table (already managed in settings).

**What was removed from the original spec:** Mock test settings, partial study days (replaced by weekday/weekend split), explicit rest days (subsumed by off-days + buffer). These added complexity without proportional scheduling benefit.

#### Phase 4 — Plan Generation + Visual Editing

The algorithm produces a day-by-day schedule. Each day contains sessions tied to specific topics (or subjects if no topics defined).

**Display format:**

| Day | Date | Sessions |
|---|---|---|
| Mon | 2026-03-09 | Algebra (45m), Organic Chemistry (45m), Physics – Mechanics (45m) |
| Tue | 2026-03-10 | Calculus – Limits (45m), History (45m) |

**Editing capabilities:**
- Move a session to a different day (drag or select)
- Remove a session from a day
- Add a session to a day
- Swap two sessions between days

All edits modify an in-memory working copy. No database writes occur.

**Feasibility indicators are live:** If an edit causes a feasibility problem (e.g., removes too many sessions for a topic that's tight on time), the UI warns immediately.

#### Phase 5 — Plan Confirmation

User reviews the final schedule and commits. The commit action:
1. Deletes future `is_plan_generated = true` tasks for the user
2. Inserts all new tasks
3. Creates a `plan_snapshot` record with the full generated schedule as JSON for history/rollback
4. Logs a `plan_event`

These steps run in a single database transaction (via a Postgres function) to prevent partial writes.

---

## 3. Planner Algorithm Design

### 3.1 Input Model

```typescript
interface PlanInput {
  units: PlannableUnit[]        // Topics or subjects (the lowest-defined level)
  constraints: GlobalConstraints
  offDays: Set<string>          // ISO dates
}

interface PlannableUnit {
  id: string
  subject_id: string
  name: string                  // "Subject > Topic" or just "Subject"
  estimated_minutes: number     // Total effort
  priority: number              // 1 (highest) to 5 (lowest)
  deadline: string              // ISO date (falls back to exam_date)
  earliest_start?: string       // ISO date
  depends_on?: string[]         // IDs of units that must finish first
  revision_sessions: number     // 0+
  practice_sessions: number     // 0+
}

interface GlobalConstraints {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  session_length_minutes: number  // default 45
  final_revision_days: number     // default 0
  buffer_percentage: number       // default 10
}
```

### 3.2 Algorithm Steps

**Step 1 — Session Decomposition**

Convert each `PlannableUnit` into sessions:

```
total_sessions = ceil(estimated_minutes / session_length_minutes)
core_sessions  = total_sessions
revision_sessions = unit.revision_sessions
practice_sessions = unit.practice_sessions
all_sessions = core_sessions + revision_sessions + practice_sessions
```

**Step 2 — Available Day Calculation**

Build the day list from `study_start_date` to `exam_date - final_revision_days` (the "core window"):

```
For each date in [study_start_date, exam_date - final_revision_days]:
  if date in offDays: skip
  capacity = isWeekend(date) ? weekend_capacity_minutes : weekday_capacity_minutes
  effective_capacity = capacity * (1 - buffer_percentage / 100)
  max_slots = floor(effective_capacity / session_length_minutes)
  add Day { date, max_slots, remaining_slots: max_slots }
```

**Step 3 — Feasibility Check**

Before scheduling, verify the plan is possible:

```
total_sessions_needed = sum of all_sessions for all units
total_slots_available = sum of max_slots for all days

if total_sessions_needed > total_slots_available:
  return INFEASIBLE with gap details
```

Per-unit feasibility (respecting deadlines):

```
For each unit:
  available_slots_before_deadline = sum of slots on days where
    date >= max(study_start_date, unit.earliest_start) AND
    date <= min(unit.deadline, exam_date - final_revision_days)
  if unit.all_sessions > available_slots_before_deadline:
    flag as INFEASIBLE with suggestions
```

**Step 4 — Priority-Weighted Scheduling**

The core scheduling algorithm uses a **priority queue** approach, not greedy sequential filling:

```
1. Create a priority queue of units sorted by:
   a. Urgency = sessions_remaining / days_until_deadline  (higher = more urgent)
   b. Priority tier (1 > 2 > 3 > 4 > 5)
   c. Dependencies satisfied (units whose deps are complete get priority)

2. For each day (in chronological order):
   while day has remaining slots:
     Pick the highest-urgency unit that:
       - has sessions remaining
       - has earliest_start <= current_date
       - has all depends_on units either complete or not yet started ← 
         (actually: all depends_on units have 0 remaining core sessions)
       - has deadline >= current_date
     If no eligible unit: break (leave slack)
     Assign one session, decrement unit's remaining sessions
     Recalculate urgency scores (since sessions_remaining decreased)

3. Schedule revision sessions:
   For each unit with revision sessions:
     Space them evenly across the last 1/3 of the unit's date range
     (or in the final_revision_days window if set)

4. Schedule practice sessions:
   For each unit with practice sessions:
     Space them evenly across the unit's date range, interleaved with core sessions
```

**Why priority queue over greedy fill:**
The current system iterates subjects in fixed order and greedily fills each day. This means the first subject in sort order dominates early days and starves later subjects. The priority queue dynamically recalculates urgency each day, ensuring all subjects get proportional attention.

### 3.3 Impossible Schedule Detection and Suggestions

When feasibility fails, the algorithm returns actionable suggestions:

| Condition | Suggestion |
|---|---|
| Total sessions > total slots | "Increase daily capacity by X minutes" or "Extend exam date by Y days" or "Remove Z sessions of effort" |
| Single unit's sessions > slots before its deadline | "Extend deadline for [Topic] by Y days" or "Reduce effort for [Topic] by Z hours" |
| Dependency chain too long for available time | "Remove dependency between [A] and [B]" |

Each suggestion is computed precisely:
- `extra_capacity_needed = ceil((sessions_gap * session_length) / available_days)` → "increase daily minutes by X"
- `extra_days_needed = ceil(sessions_gap / avg_daily_slots)` → "extend deadline by Y days"
- `sessions_to_cut = sessions_gap` → "reduce effort by Z hours (N sessions)"

### 3.4 Edge Cases

| Edge Case | Handling |
|---|---|
| Zero available days | Return INFEASIBLE immediately |
| Unit deadline before study_start_date | Flag as impossible, suggest extending deadline |
| Circular dependencies | Detect before scheduling, return error |
| All days are off-days | Return INFEASIBLE with "no available study days" |
| Session length > daily capacity | Return INFEASIBLE with "session length exceeds daily capacity" |
| Unit with 0 estimated hours | Skip (nothing to schedule) |
| Weekend-only student (weekday_capacity = 0) | Valid — only schedules on weekends |

---

## 4. New Database Schema

### 4.1 Design Principles

- Structure tables (what to study) are separate from planning tables (how to schedule)
- A single `plan_config` table stores all global constraints for a plan
- `topics` becomes a real entity between subjects and subtopics
- The `tasks` table gains a `topic_id` column for topic-level tracking
- Generated plans are snapshotted for history
- All user-owned tables have `user_id` with RLS on `auth.uid()`
- Intelligence columns are removed from `subjects` (the app computes what it needs)

### 4.2 Schema

#### `profiles` (modified — drop intelligence columns)

```sql
-- No structural changes needed. Keep as-is.
-- exam_date and daily_available_minutes stay for backward compat
-- but the planner reads from plan_config when available.
```

#### `subjects` (modified — simplified)

```sql
subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items`, `avg_duration_minutes`, `deadline`, `priority`, `mandatory`, `custom_daily_minutes`, `remaining_minutes`, `urgency_score`, `health_state`, `estimated_completion_date`.

Workload and scheduling parameters move to `topics` and `topic_params`. Subjects become purely structural containers.

#### `topics` (new)

```sql
topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### `subtopics` (modified — points to topics)

```sql
subtopics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id        uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**Removed:** `total_items`, `completed_items` (subtopics are structural only — effort lives on topics).

#### `topic_params` (new — scheduling parameters)

```sql
topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,                    -- NULL means use global exam_date
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',     -- topic IDs
  revision_sessions   integer NOT NULL DEFAULT 0,
  practice_sessions   integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
)
```

Note: For subjects with no topics, the system creates a single "default" topic with the subject's name. This normalizes the model — the scheduler always works with topics.

#### `plan_config` (new — global planning constraints)

```sql
plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
)
```

One config per user. Updated each time the user re-enters Phase 3.

#### `tasks` (modified — add topic_id, session_type)

```sql
tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id          uuid REFERENCES topics(id) ON DELETE SET NULL,
  title             text NOT NULL,
  scheduled_date    date NOT NULL,
  duration_minutes  integer NOT NULL CHECK (duration_minutes > 0),
  session_type      text NOT NULL DEFAULT 'core' CHECK (session_type IN ('core', 'revision', 'practice')),
  priority          integer NOT NULL DEFAULT 3,
  completed         boolean NOT NULL DEFAULT false,
  is_plan_generated boolean NOT NULL DEFAULT true,
  plan_version      uuid,          -- links to plan_snapshot that generated this task
  created_at        timestamptz NOT NULL DEFAULT now()
)
```

#### `off_days` (modified — add default for id)

```sql
off_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- FIX: add default
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
)
```

#### `plan_snapshots` (new — replaces plan_events for history)

```sql
plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL,      -- full generated schedule for diffing/rollback
  config_snapshot jsonb NOT NULL,      -- snapshot of plan_config at generation time
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

#### Execution tables — **unchanged**

`execution_categories`, `execution_items`, `execution_entries` are unrelated to the planner redesign and remain as-is.

### 4.3 Indexes

```sql
-- subjects
CREATE INDEX idx_subjects_user ON subjects(user_id);
CREATE INDEX idx_subjects_user_archived ON subjects(user_id, archived);

-- topics
CREATE INDEX idx_topics_subject ON topics(subject_id);
CREATE INDEX idx_topics_user ON topics(user_id);

-- subtopics
CREATE INDEX idx_subtopics_topic ON subtopics(topic_id);

-- topic_params
CREATE INDEX idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX idx_topic_params_user ON topic_params(user_id);

-- plan_config
-- UNIQUE(user_id) already serves as index

-- tasks
CREATE INDEX idx_tasks_user_date ON tasks(user_id, scheduled_date);
CREATE INDEX idx_tasks_subject ON tasks(subject_id);
CREATE INDEX idx_tasks_topic ON tasks(topic_id);
CREATE INDEX idx_tasks_plan_version ON tasks(plan_version);

-- off_days
CREATE INDEX idx_off_days_user ON off_days(user_id);

-- plan_snapshots
CREATE INDEX idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);
```

### 4.4 RLS Policies

Every user-owned table gets the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rows"   ON <table> FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own rows" ON <table> FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own rows" ON <table> FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own rows" ON <table> FOR DELETE USING (user_id = auth.uid());
```

Applied to: `subjects`, `topics`, `subtopics`, `topic_params`, `plan_config`, `tasks`, `off_days`, `plan_snapshots`.

---

## 5. Migration Strategy

### 5.1 Table Mapping

| Current | Action | New |
|---|---|---|
| `profiles` | **Keep** — no structural changes | `profiles` |
| `subjects` | **Transform** — strip workload columns, keep name/archived | `subjects` (slimmed) |
| `subtopics` | **Transform** — re-parent from subject_id to topic_id, drop workload cols | `subtopics` (re-parented) |
| `tasks` | **Modify** — add `topic_id`, `session_type`, `plan_version` | `tasks` (extended) |
| `off_days` | **Modify** — add default on `id` | `off_days` (fixed) |
| `plan_events` | **Drop** — replaced by `plan_snapshots` | (removed) |
| — | **Create** | `topics` |
| — | **Create** | `topic_params` |
| — | **Create** | `plan_config` |
| — | **Create** | `plan_snapshots` |
| `subject_workload_view` | **Drop** — no longer needed |
| `compute_subject_intelligence()` | **Drop** — no longer needed |
| `complete_task_with_streak()` | **Drop** — unused by app |
| `increment_completed_items()` | **Drop** — unused by app |
| `execution_*` | **Keep unchanged** | |

### 5.2 Data Migration Logic

1. **Subjects → Topics migration**: For each existing `subject`, create a corresponding `topic` with the same name. This "default topic" represents the subject-level workload that previously lived on the subject row.

2. **Subject workload → topic_params**: For each created topic (from step 1), create a `topic_params` row:
   - `estimated_hours = (total_items - completed_items) * avg_duration_minutes / 60.0`
   - `priority = subject.priority`
   - `deadline = subject.deadline`

3. **Subtopics re-parenting**: Existing subtopics reference `subject_id`. After creating topics, re-point subtopics to the matching topic via a mapping table. Since each old subject gets exactly one default topic, the mapping is 1:1.

4. **Tasks enrichment**: Existing tasks get `topic_id` set to the default topic for their `subject_id`, `session_type = 'core'`, `plan_version = NULL`.

5. **Profile → plan_config**: Create a `plan_config` row for each profile:
   - `study_start_date = today`
   - `exam_date = profiles.exam_date` (or today + 90 days if null)
   - `weekday_capacity_minutes = profiles.daily_available_minutes`
   - `weekend_capacity_minutes = profiles.daily_available_minutes`
   - `session_length_minutes = 45`

6. **plan_events → plan_snapshots**: Migrate existing `plan_events` into `plan_snapshots` with `schedule_json = '{}'::jsonb` (no historical schedule data is available, but we preserve the metadata).

### 5.3 Preservation Guarantees

- All existing tasks are preserved with their completion state
- All existing subjects are preserved (name, archived state)
- All off-days are preserved
- All execution board data is completely untouched
- User auth and profiles remain intact

---

## 6. SQL Migration Script

```sql
-- =============================================================================
-- StudyHard Planner Redesign Migration
-- Run against the production Supabase database
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Create new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

-- Topic planning parameters
CREATE TABLE IF NOT EXISTS topic_params (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  estimated_hours     numeric(6,1) NOT NULL,
  priority            integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline            date,
  earliest_start      date,
  depends_on          uuid[] DEFAULT '{}',
  revision_sessions   integer NOT NULL DEFAULT 0 CHECK (revision_sessions >= 0),
  practice_sessions   integer NOT NULL DEFAULT 0 CHECK (practice_sessions >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_params_topic ON topic_params(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_params_user ON topic_params(user_id);

-- Global plan configuration (one per user)
CREATE TABLE IF NOT EXISTS plan_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_start_date            date NOT NULL,
  exam_date                   date NOT NULL,
  weekday_capacity_minutes    integer NOT NULL CHECK (weekday_capacity_minutes >= 0),
  weekend_capacity_minutes    integer NOT NULL CHECK (weekend_capacity_minutes >= 0),
  session_length_minutes      integer NOT NULL DEFAULT 45 CHECK (session_length_minutes > 0),
  final_revision_days         integer NOT NULL DEFAULT 0 CHECK (final_revision_days >= 0),
  buffer_percentage           integer NOT NULL DEFAULT 10 CHECK (buffer_percentage BETWEEN 0 AND 50),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Plan snapshots (replaces plan_events)
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_count      integer NOT NULL DEFAULT 0,
  schedule_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_user ON plan_snapshots(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Migrate existing data into new structure
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Create a default topic for each existing subject
INSERT INTO topics (id, user_id, subject_id, name, sort_order, created_at)
SELECT
  gen_random_uuid(),
  s.user_id,
  s.id,
  s.name,
  0,
  s.created_at
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM topics t WHERE t.subject_id = s.id
);

-- 2b. Create topic_params from existing subject workload data
INSERT INTO topic_params (user_id, topic_id, estimated_hours, priority, deadline)
SELECT
  t.user_id,
  t.id,
  GREATEST(0, ROUND(((s.total_items - s.completed_items) * s.avg_duration_minutes) / 60.0, 1)),
  s.priority,
  s.deadline
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE NOT EXISTS (
  SELECT 1 FROM topic_params tp WHERE tp.topic_id = t.id
);

-- 2c. Re-parent subtopics: add topic_id column, populate it, drop subject_id later
ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE CASCADE;

UPDATE subtopics st
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = st.subject_id
  AND st.topic_id IS NULL;

-- 2d. Create plan_config from profiles
INSERT INTO plan_config (user_id, study_start_date, exam_date, weekday_capacity_minutes, weekend_capacity_minutes)
SELECT
  p.id,
  CURRENT_DATE,
  COALESCE(p.exam_date, CURRENT_DATE + INTERVAL '90 days'),
  p.daily_available_minutes,
  p.daily_available_minutes
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_config pc WHERE pc.user_id = p.id
);

-- 2e. Migrate plan_events to plan_snapshots
INSERT INTO plan_snapshots (user_id, task_count, schedule_json, config_snapshot, summary, created_at)
SELECT
  pe.user_id,
  pe.task_count,
  '[]'::jsonb,
  '{}'::jsonb,
  pe.summary,
  pe.created_at
FROM plan_events pe
WHERE NOT EXISTS (
  SELECT 1 FROM plan_snapshots ps
  WHERE ps.user_id = pe.user_id AND ps.created_at = pe.created_at
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Modify existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Tasks: add topic_id, session_type, plan_version
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'core'
  CHECK (session_type IN ('core', 'revision', 'practice'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_version uuid;

-- Backfill topic_id for existing tasks
UPDATE tasks tk
SET topic_id = t.id
FROM topics t
WHERE t.subject_id = tk.subject_id
  AND tk.topic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_version ON tasks(plan_version);

-- 3b. off_days: fix missing default on id
ALTER TABLE off_days ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3c. subtopics: drop old workload columns and subject_id FK after topic_id is populated
-- First make topic_id NOT NULL now that data is migrated
-- (Only if all rows have topic_id populated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subtopics WHERE topic_id IS NULL) THEN
    EXECUTE 'ALTER TABLE subtopics ALTER COLUMN topic_id SET NOT NULL';
  END IF;
END $$;

-- Drop old columns from subtopics
ALTER TABLE subtopics DROP COLUMN IF EXISTS total_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subtopics DROP COLUMN IF EXISTS subject_id;

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id);

-- 3d. Subjects: drop legacy workload/intelligence columns
ALTER TABLE subjects DROP COLUMN IF EXISTS total_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS completed_items;
ALTER TABLE subjects DROP COLUMN IF EXISTS avg_duration_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS deadline;
ALTER TABLE subjects DROP COLUMN IF EXISTS priority;
ALTER TABLE subjects DROP COLUMN IF EXISTS mandatory;
ALTER TABLE subjects DROP COLUMN IF EXISTS custom_daily_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS remaining_minutes;
ALTER TABLE subjects DROP COLUMN IF EXISTS urgency_score;
ALTER TABLE subjects DROP COLUMN IF EXISTS health_state;
ALTER TABLE subjects DROP COLUMN IF EXISTS estimated_completion_date;

-- Add sort_order to subjects if not present
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Drop legacy objects
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS subject_workload_view;
DROP FUNCTION IF EXISTS compute_subject_intelligence() CASCADE;
DROP FUNCTION IF EXISTS complete_task_with_streak(uuid);
DROP FUNCTION IF EXISTS increment_completed_items(uuid);

-- Drop plan_events table (replaced by plan_snapshots)
DROP TABLE IF EXISTS plan_events;

-- Drop old subtopics indexes that reference dropped columns
DROP INDEX IF EXISTS idx_subtopics_subject_id;

-- Drop old constraints from subjects that reference dropped columns
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS avg_duration_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS total_items_positive;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS completed_items_valid;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE topics
```

