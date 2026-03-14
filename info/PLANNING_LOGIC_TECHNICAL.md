# Planning Logic — Complete Technical Reference

---

## File Map

```
lib/planner/types.ts          → All TypeScript interfaces / types
lib/planner/feasibility.ts    → buildDaySlots() + checkFeasibility()
lib/planner/scheduler.ts      → schedule()  — the core algorithm
lib/planner/analyzePlan.ts    → generatePlan()  — orchestrator

app/actions/planner/generatePlan.ts   → Server action: loads DB data, calls generatePlan()
app/actions/planner/commitPlan.ts     → Server action: calls commit_plan_atomic RPC
app/actions/plan/rescheduleMissedPlan.ts → Server action: greedy first-fit reschedule
Quick start flow removed (onboarding now routes through planner wizard)

app/(dashboard)/planner/page.tsx                   → 5-phase wizard shell
app/(dashboard)/planner/components/PlannerStepper.tsx
app/(dashboard)/planner/components/StructureBuilder.tsx  → Phase 1
app/(dashboard)/planner/components/ParamsEditor.tsx      → Phase 2
app/(dashboard)/planner/components/ConstraintsForm.tsx   → Phase 3
app/(dashboard)/planner/components/PlanPreview.tsx       → Phase 4
app/(dashboard)/planner/components/PlanConfirm.tsx       → Phase 5

supabase/migrations/001_planner_redesign.sql   → commit_plan_atomic v1
supabase/migrations/002_session_plan_order.sql → session_length_minutes + plan_order
supabase/migrations/003_tasks_session_columns.sql → session_number / total_sessions, v2
supabase/migrations/004_commit_keep_previous.sql  → keep_mode param, v3
supabase/migrations/005_plan_config_focus_depth.sql → max_active_subjects
supabase/migrations/006_ops_events.sql → ops_events table
```

---

## Complete Planning System Tree

```
PLANNING SYSTEM
├── 1. ENTRY POINTS
│   ├── A. Planner Wizard  (app/(dashboard)/planner/page.tsx)
│   │      5-phase sequential wizard, state persisted to sessionStorage
│   │      key: "planner-draft-2026-03-08-sequential-v2"
│   │
│   └── B. Reschedule Missed  (app/actions/plan/rescheduleMissedPlan.ts)
│          Takes ALL incomplete plan-generated tasks and redistributes
│          them forward from today using a first-fit greedy approach

│
├── 2. DATA COLLECTION (Phases 1–3 of the Wizard)
│   │
│   ├── Phase 1 — STRUCTURE  (saveStructure.ts → subjects / topics tables)
│   │   Subjects → Topics (→ optional Subtopics)
│   │   Topics are ordered by:
│   │     subject.sort_order ASC → topic.sort_order ASC
│   │     → topic.created_at ASC → topic.id ASC (tie-breaker)
│   │   This order is preserved by the scheduler (no re-sort within subject)
│   │
│   ├── Phase 2 — PARAMS  (saveTopicParams.ts → topic_params table)
│   │   Per topic:
│   │   ┌──────────────────────────────────────────────────────────────┐
│   │   │  estimated_hours       → total effort (defines session count)│
│   │   │  session_length_minutes→ how long one session is (default 60)│
│   │   │  priority              → 1 (High) … 5 (Very Low)            │
│   │   │  deadline              → defaults to exam_date              │
│   │   │  earliest_start        → optional; topic can't start before │
│   │   │  depends_on            → array of topic IDs (prerequisite)  │
│   │   └──────────────────────────────────────────────────────────────┘
│   │
│   └── Phase 3 — CONSTRAINTS  (savePlanConfig.ts → plan_config table)
│       ┌──────────────────────────────────────────────────────────────┐
│       │  study_start_date          first day of scheduling window   │
│       │  exam_date                 hard end boundary                │
│       │  weekday_capacity_minutes  raw study minutes Mon–Fri        │
│       │  weekend_capacity_minutes  raw study minutes Sat–Sun        │
│       │  plan_order                "priority"|"deadline"            │
│       │                            |"subject"|"balanced"            │
│       │  final_revision_days       days before exam excluded from   │
│       │                            core scheduling window           │
│       │  buffer_percentage         0–50%; shrinks usable capacity   │
│       │  max_active_subjects       0 = no limit; Focus Depth        │
│       └──────────────────────────────────────────────────────────────┘

│
├── 3. PLAN GENERATION  (Phase 4: generatePlanAction → generatePlan)
│   │
│   ├── 3.A  generatePlanAction()  [app/actions/planner/generatePlan.ts]
│   │   ├── Auth check → UNAUTHORIZED
│   │   ├── Load plan_config → NO_CONFIG
│   │   ├── Load topics (non-archived subjects only), sorted as above
│   │   ├── → NO_TOPICS if none
│   │   ├── Load topic_params for all topic IDs
│   │   ├── Load off_days
│   │   ├── Build PlannableUnit[] — FILTER: estimated_hours > 0 only
│   │   │     estimated_minutes = round(estimated_hours × 60)
│   │   │     deadline falls back to planConfig.exam_date if null
│   │   ├── Build GlobalConstraints from plan_config
│   │   └── Call generatePlan({ units, constraints, offDays })
│   │
│   └── 3.B  generatePlan()  [lib/planner/analyzePlan.ts]
│       ├── units.length === 0 → { status: "NO_UNITS" }
│       ├── checkFeasibility(units, constraints, offDays)
│       ├── schedule(units, constraints, offDays)
│       ├── sessions.length === 0 AND !feasible → { status: "INFEASIBLE", feasibility }
│       └── else → { status: "READY", schedule, feasibility }
│           NOTE: READY is returned even when feasibility.feasible = false
│                 (best-effort schedule shown alongside warnings)

│
├── 4. FEASIBILITY CHECK  [lib/planner/feasibility.ts]
│   │
│   ├── 4.A  buildDaySlots(constraints, offDays)  ← shared with scheduler
│   │   ├── cursor = study_start_date
│   │   ├── revisionCutoff = exam_date − final_revision_days
│   │   ├── Loop cursor ≤ revisionCutoff:
│   │   │   ├── skip if date ∈ offDays
│   │   │   ├── rawCapacity = weekend ? weekend_cap : weekday_cap
│   │   │   ├── effectiveCapacity = floor(rawCapacity × (1 − buffer_pct/100))
│   │   │   ├── skip if effectiveCapacity ≤ 0
│   │   │   └── push DaySlot { date, capacity, remainingMinutes, isWeekend }
│   │   └── Returns DaySlot[]
│   │
│   ├── 4.B  checkFeasibility(units, constraints, offDays)
│   │   ├── Build day slots (above)
│   │   ├── totalMinutesAvailable = Σ slot.capacity
│   │   │
│   │   ├── For each unit (skip if estimated_minutes ≤ 0):
│   │   │   │
│   │   │   ├── sessionsNeeded = ceil(estimated_minutes / session_length_minutes)
│   │   │   ├── minutesNeeded  = sessionsNeeded × session_length_minutes
│   │   │   │       ↑ NOTE: always a multiple of session_length_minutes
│   │   │   │
│   │   │   ├── unitWindow = [earliest_start ?? study_start_date … deadline]
│   │   │   ├── availableMinutes = Σ slot.capacity for slots in unitWindow
│   │   │   │
│   │   │   ├── classifyUnit(minutesNeeded, availableMinutes):
│   │   │   │   ├── availableMinutes ≤ 0 OR minutesNeeded > available → "impossible"
│   │   │   │   ├── ratio = minutesNeeded / availableMinutes
│   │   │   │   │   ├── ratio ≤ 0.80 → "safe"
│   │   │   │   │   ├── ratio ≤ 0.90 → "tight"
│   │   │   │   │   └── ratio > 0.90 → "at_risk"
│   │   │   │
│   │   │   └── buildUnitSuggestions():
│   │   │       minuteGap = minutesNeeded − availableMinutes
│   │   │       if gap > 0:
│   │   │         extraDays  = ceil(gap / avgDailyCapacity) → "extend_deadline"
│   │   │         reduceHrs  = ceil(gap / 60)               → "reduce_effort"
│   │   │
│   │   ├── globalGap = max(0, totalMinutesNeeded − totalMinutesAvailable)
│   │   ├── feasible = (globalGap === 0) AND (no unit has status "impossible")
│   │   │
│   │   └── Global suggestions (if globalGap > 0):
│   │       ├── extraMinutesPerDay = ceil(gap / activeDays)  → "increase_capacity"
│   │       ├── extraDays = ceil(gap / avgDailyCapacity)     → "extend_deadline"
│   │       └── reduceHours = ceil(gap / 60)                 → "reduce_effort"

│
├── 5. SCHEDULER  [lib/planner/scheduler.ts]  — the core algorithm
│   │
│   ├── 5.A  INPUT SANITIZATION
│   │   ├── Remove duplicate unit IDs (keep first occurrence)
│   │   ├── Remove self-references in depends_on
│   │   ├── Remove orphan deps (IDs not present in unit set)
│   │   └── Clamp session_length_minutes ≥ 1  (prevent division-by-zero)
│   │
│   ├── 5.B  CIRCULAR DEPENDENCY DETECTION  (detectCircularDeps — DFS)
│   │   ├── Build adjacency map of deps
│   │   ├── DFS with `visited` + `stack` sets
│   │   └── If cycle detected → return []  (no plan produced)
│   │
│   ├── 5.C  UNIT STATES  (UnitState per topic)
│   │   ├── coreSessions  = ceil(estimated_minutes / session_length_minutes)
│   │   ├── coreRemaining = coreSessions  (countdown)
│   │   ├── scheduled     = 0  (counter)
│   │   └── depsComplete  = (depends_on.length === 0)
│   │
│   ├── 5.D  SEQUENTIAL GROUPING (within subject)
│   │   └── subjectTopics: Map<subject_id, UnitState[]>
│   │       Topics ordered exactly as they arrived (Phase 1 sort order).
│   │       Rule: Topic N must be 100% complete before Topic N+1 starts.
│   │
│   ├── 5.E  UPFRONT CAPACITY SCALING  ("burn rate" balancing)
│   │   │
│   │   ├── totalMinutesNeeded = Σ (coreRemaining × session_length_minutes)
│   │   ├── totalCapacity = Σ slot.capacity (from buildDaySlots)
│   │   │
│   │   ├── IF totalMinutesNeeded > totalCapacity:
│   │   │   ├── scaleFactor = totalMinutesNeeded / totalCapacity
│   │   │   ├── For each day slot:
│   │   │   │   scaled = min(ceil(capacity × scaleFactor), 480)
│   │   │   │   capacity = remainingMinutes = scaled
│   │   │   └── HARD MAX = 480 min (8 hours) per day, regardless of scale
│   │   │
│   │   └── Effect: every day gets proportionally equal load,
│   │               no day is over/under-scheduled (up to the hard cap)
│   │
│   ├── 5.F  OVERSIZED UNIT FILTER
│   │   └── maxDayCapacity = max(slot.capacity for all slots)
│   │       Units where session_length_minutes > maxDayCapacity
│   │       are added to `oversizedIds` set — excluded from all scheduling
│   │
│   ├── 5.G  DEPENDENCY REFRESH  (called before each day + overflow round)
│   │   └── For each non-oversized unit:
│   │       depsComplete = depends_on.every(dep =>
│   │         completedUnits.has(dep) OR oversizedIds.has(dep))
│   │
│   ├── 5.H  MAIN SCHEDULING PASS  (iterates day by day)
│   │   │
│   │   │   SAFETY LIMIT = (totalPossibleSessions × daySlots.length) + daySlots.length
│   │   │
│   │   ├── For each day in daySlots:
│   │   │   │
│   │   │   ├── refreshDeps()
│   │   │   │
│   │   │   ├── Collect active topic per subject:
│   │   │   │   getActiveTopic(sid, date):
│   │   │   │     Walk topic list for subject, return first topic where:
│   │   │   │       coreRemaining > 0
│   │   │   │       NOT in oversizedIds
│   │   │   │       depsComplete
│   │   │   │       date ≥ earliest_start (or study_start_date)
│   │   │   │       date ≤ deadline  (strict — no overflow yet)
│   │   │   │     Returns undefined if no valid earlier topic exists
│   │   │   │
│   │   │   ├── If no active topics on this day → skip day
│   │   │   │
│   │   │   ├── ORDER SUBJECTS by plan_order:
│   │   │   │   ├── "priority" → sort by unit.priority ASC (1=highest)
│   │   │   │   ├── "deadline" → sort by unit.deadline ASC (soonest first)
│   │   │   │   ├── "subject"  → preserve Phase 1 subject order
│   │   │   │   └── "balanced" → sort by urgency DESC
│   │   │   │       urgency formula:
│   │   │   │         daysLeft = max(1, ceil((deadline − today) / 86400000))
│   │   │   │         urgency  = (coreRemaining / daysLeft) × (6 − priority)
│   │   │   │         ↑ higher remaining work + sooner deadline + higher priority
│   │   │   │           → higher urgency score → scheduled earlier that day
│   │   │   │
│   │   │   ├── FOCUS DEPTH FILTER  (max_active_subjects > 0):
│   │   │   │   ├── Identify "urgent" subjects: deadline within 7 days
│   │   │   │   │   (urgent subjects are ALWAYS included — override the limit)
│   │   │   │   ├── slotsForRegular = max(0, limit − urgentCount)
│   │   │   │   └── orderedSubjectIds = [...urgentIds, ...regularIds.slice(0, slotsForRegular)]
│   │   │   │
│   │   │   ├── ROUND-ROBIN PLACEMENT LOOP (while day.remainingMinutes > 0):
│   │   │   │   │
│   │   │   │   ├── Per-subject cap (when multiple subjects active):
│   │   │   │   │   maxPerSubjectMinutes = ceil(day.capacity × 0.6)
│   │   │   │   │   (ensures no single subject hogs >60% of a day)
│   │   │   │   │   When only 1 subject active → cap = Infinity
│   │   │   │   │
│   │   │   │   ├── Each round iterates all orderedSubjectIds once:
│   │   │   │   │   For each subject sid:
│   │   │   │   │     ├── skip if subjectUsed ≥ maxPerSubjectMinutes
│   │   │   │   │     ├── getActiveTopic(sid, day.date)  (re-evaluated each round)
│   │   │   │   │     ├── skip if hasEarlierUnfinishedTopic (enforces sequential)
│   │   │   │   │     ├── skip if day.remainingMinutes < sessionLen
│   │   │   │   │     ├── skip if subjectUsed + sessionLen > maxPerSubject AND subjectUsed > 0
│   │   │   │   │     └── placeSession():
│   │   │   │   │           state.scheduled++
│   │   │   │   │           sessions.push(ScheduledSession)
│   │   │   │   │           state.coreRemaining--
│   │   │   │   │           day.remainingMinutes -= sessionLen
│   │   │   │   │           if coreRemaining === 0: completedUnits.add(id)
│   │   │   │   │
│   │   │   │   └── Round ends; if no session placed in a full round → exit while
│   │   │   │
│   │   │   └── Session label:
│   │   │       total > 1: "SubjectName – TopicName (N/Total)"
│   │   │       total = 1: "SubjectName – TopicName"
│   │   │
│   │   └── Safety counter prevents infinite loops
│   │
│   ├── 5.I  OVERFLOW RECOVERY PASS  (after main pass)
│   │   Used when a topic missed its deadline window due to sequencing delays
│   │   (e.g., Topic A took longer than expected, so Topic B missed its window)
│   │   │
│   │   ├── MAX_OVERFLOW_ROUNDS = totalPossibleSessions + 1
│   │   ├── While overflowPlaced AND rounds < MAX_OVERFLOW_ROUNDS:
│   │   │   ├── refreshDeps()
│   │   │   ├── candidates = topics where:
│   │   │   │   ├── NOT oversized
│   │   │   │   ├── coreRemaining > 0
│   │   │   │   ├── At least one EARLIER topic in same subject is completed
│   │   │   │   │   (the sequencing delay case — blocked because predecessor finished late)
│   │   │   │   └── depsComplete
│   │   │   │
│   │   │   ├── Sort candidates: highest (remaining/total) ratio first
│   │   │   │   (topics furthest behind get placed first)
│   │   │   │
│   │   │   ├── For each candidate, scan ALL day slots:
│   │   │   │   ├── skip if day.remainingMinutes < session_length_minutes
│   │   │   │   ├── skip if day.date < earliest_start
│   │   │   │   ├── skip if hasEarlierUnfinishedTopic  (strict sequential)
│   │   │   │   ├── NO DEADLINE CHECK (deadline is relaxed in overflow)
│   │   │   │   └── placeSession() + day.remainingMinutes -= sessionLen
│   │   │   │
│   │   │   └── overflowPlaced = true if any session was placed this round
│   │   │
│   │   └── NOTE: Topics that simply can't fit their own window are NOT
│   │           overflowed — feasibility warning covers those cases.
│   │
│   └── 5.J  FINAL SORT
│       sessions.sort by:
│         1. scheduled_date ASC
│         2. subject position in original subjectOrder ASC  (stable)

│
├── 6. PLAN PREVIEW  (Phase 4 UI — PlanPreview.tsx)
│   Computed client-side from the schedule returned by generatePlan:
│   │
│   ├── Dropped sessions  (sessions missing from expected full coverage)
│   ├── Impossible / at_risk / tight units  (from feasibility.units)
│   ├── Global gap in minutes
│   ├── Load distribution  (sessions per day, distribution stats)
│   ├── Configuration insights
│   │   ├── buffer_percentage in effect
│   │   ├── focus depth active
│   │   └── final_revision_days applied
│   ├── Generation notes (per-topic warnings)
│   └── Deduplicated fix suggestions with targetPhase (which wizard phase to revisit)

│
├── 7. COMMIT  (Phase 5 — commitPlan.ts → Supabase RPC commit_plan_atomic)
│   │
│   ├── Inputs:
│   │   ├── sessions[]      — ScheduledSession array from preview
│   │   ├── keepMode        — how to handle existing plan tasks
│   │   │   ├── "future"  → keep tasks dated AFTER new plan's start date
│   │   │   ├── "until"   → keep tasks dated BEFORE new plan's start date
│   │   │   └── "none"    → delete ALL old generated tasks
│   │   └── summary         — free-text label for snapshot
│   │
│   ├── newPlanStartDate = min(session.scheduled_date) across all sessions
│   │
│   ├── RPC commit_plan_atomic:
│   │   ├── Delete old is_plan_generated tasks per keepMode
│   │   ├── Insert new tasks (all dates, no date guard)
│   │   ├── Insert plan_snapshot record (schedule_json, config_snapshot, summary)
│   │   └── Returns { status: "SUCCESS", task_count, snapshot_id }
│   │
│   └── On success:
│       ├── revalidatePath /dashboard, /dashboard/calendar, /planner
│       └── Return { status: "SUCCESS", taskCount, snapshotId }

│
└── 8. RESCHEDULE MISSED  [rescheduleMissedPlan.ts]  — independent path
    │  Triggered from dashboard button when tasks are overdue
    │
    ├── Load all is_plan_generated=true, completed=false tasks (ordered by date, priority)
    ├── Load plan_config / profiles for constraints
    ├── Build day slots from TODAY → exam_date (same buildDaySlots as scheduler)
    ├── Reserve capacity for non-generated or completed tasks already on future days
    │   (so rescheduled tasks don't double-book)
    ├── GREEDY FIRST-FIT placement:
    │   For each pending task (in date+priority order):
    │     scan daySlots → first day where remainingMinutes ≥ duration_minutes
    │     → place it there, decrement remainingMinutes
    │     (no urgency / interleaving — pure first-fit)
    ├── Delete all old generated incomplete tasks
    ├── Insert plan_snapshot
    ├── Insert newly scheduled tasks
    └── Return { movedTaskCount, unscheduledTaskCount, keptCompletedCount }
```

---

## Key Formulae Quick-Reference

| Formula | Location | Purpose |
|---|---|---|
| `sessionsNeeded = ceil(estimatedMins / sessionLenMins)` | feasibility + scheduler | Sessions per topic |
| `minutesNeeded = sessionsNeeded × sessionLenMins` | feasibility | Always a multiple of session length |
| `effectiveCapacity = floor(rawCap × (1 − bufferPct/100))` | buildDaySlots | Buffer shrink |
| `ratio = minutesNeeded / availableMinutes` | classifyUnit | ≤0.8=safe, ≤0.9=tight, >0.9=at_risk, >1=impossible |
| `urgency = (coreRemaining / daysLeft) × (6 − priority)` | computeUrgency | Balanced ordering score |
| `daysLeft = max(1, ceil((deadline − today) / 86400000))` | computeUrgency | Floor at 1 to avoid div/0 |
| `scaleFactor = totalMinutesNeeded / totalCapacity` | scheduler scale | Burn rate correction |
| `scaledCap = min(ceil(cap × scaleFactor), 480)` | scheduler scale | Hard 8-hr daily ceiling |
| `maxPerSubject = ceil(day.capacity × 0.6)` | round-robin | 60% per-subject cap |
| `overflowSort = b.remaining/b.total − a.remaining/a.total` | overflow | Most-behind topics first |

---

## Edge Cases Handled

| Case | Handling |
|---|---|
| Zero units | `generatePlan` → `NO_UNITS` immediately |
| Topic has `estimated_hours = 0` | Excluded from `PlannableUnit[]` in `generatePlanAction`; also skipped in feasibility |
| Circular dependency chain | DFS in `detectCircularDeps` → `schedule()` returns `[]` |
| Self-referencing depends_on | Stripped during sanitization |
| Orphan dependency IDs | Stripped during sanitization |
| Duplicate unit IDs | First occurrence kept, rest dropped |
| `session_length_minutes = 0` | Clamped to 1 (division-by-zero guard) |
| Session length > any day's capacity | Added to `oversizedIds`, silently excluded (no crash) |
| Total work > total capacity | Capacity scaled up proportionally (burn rate), capped at 480 min/day |
| Topic's window too small | Infeasible status in feasibility; main pass respects deadline; overflow pass only handles sequencing-delayed topics, NOT window-too-small topics |
| `earliest_start` in future | Slots before that date skipped via `date < start` guard in `getActiveTopic` |
| All days are off-days | `buildDaySlots` returns `[]`; scheduler returns `[]`; `INFEASIBLE` |
| `final_revision_days` ≥ entire window | `revisionCutoff < study_start_date` → no slots → infeasible |
| Exam date in past (reschedule path) | Explicit check → `NO_CAPACITY` response |
| Subject ordering change after Phase 1 | `subjectOrder` captured once before scheduling; stable sort preserves it |
| Multiple subjects active on a day | Round-robin interleaving; 60% per-subject cap enforced |
| Focus depth + urgent override | Urgent (≤7 days) subjects always bypass `max_active_subjects` limit |
| Dependency not yet complete | `depsComplete = false` → `getActiveTopic` returns `undefined` for that subject |
| Predecessor topic still unfinished | `hasEarlierUnfinishedTopic` guard blocks later topic in same subject |
| Safety / infinite-loop guard | `safetyCounter` vs `SAFETY_LIMIT = (totalSessions × days) + days` |
| `READY` but infeasible | Plan returned with warnings — user can review and decide to commit anyway |
| keepMode on commit | `"future"` keeps tasks after new plan start; `"until"` keeps tasks before; `"none"` wipes all |
