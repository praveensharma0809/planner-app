# The Study Planner — Complete Logic for Humans (v2)

> **Last updated: March 2026 — v2 engine implemented.**
> Status legend used throughout this document:
> **✅ IMPLEMENTED** — live in the codebase right now.
> **🔜 PLANNED** — designed and documented, not yet built.

---

## DESIGN PHILOSOPHY

```
OLD mindset:         "Here's a plan. Take it or leave it."
NEW mindset:         "Here are the knobs. Build YOUR plan. We'll make sure the math works."

Core principles:
  1. STUDENT CONTROL  — The student decides HOW they study, not just WHAT.
  2. LIVE FEEDBACK    — Every input change shows its impact immediately.
  3. GRACEFUL FIXES   — Problems are caught early and resolved in-place, not at the end.
  4. PERSONAL RHYTHM  — Students have rest days, energy cycles, subject fatigue.
                         The planner must respect all of these.
  5. POST-COMMIT FLEX — The plan is a living document, not a prison sentence.
```

---

## THE BIG PICTURE

```
You give the app:            The app does:                   You get:
  → What to study       ──►  Validates as you type      ──►  A schedule YOU shaped
  → How you like to           Warns before problems           (that the math confirms
    study (your rules)        Lets you tweak anything           actually works)
  → Your available time       Checks feasibility live
  → Your deadlines
```

---

## STAGE 1 — STRUCTURE (What to Study) ✅

### 1.1 — Subject & Topic Hierarchy

```
Subject (e.g. "Maths")
  └── Topic 1  (e.g. "Calculus")
  └── Topic 2  (e.g. "Algebra")
  └── Topic 3  (e.g. "Statistics")
```

Topics within a subject are ordered. By default the scheduler works through them
sequentially unless a `depends_on` relationship or topic `tier` overrides the order.

### 1.2 — Topic Ordering via Tiers ✅

Each topic carries a `tier` number (0 = default, sequential from subject list).
Topics in the same tier are treated as parallel — the scheduler can interleave them.
Topics in a lower tier must be complete before topics in a higher tier start.

```
tier=0  [Calculus]   ← starts first
tier=0  [Algebra]    ← also starts first (parallel with Calculus)
tier=1  [Statistics] ← only after tier-0 topics are done
```

Full per-subject ordering modes are now **✅ IMPLEMENTED** in constraints:

- Sequential: finish one topic before the next.
- Flexible Sequential: start interleaving the next topic after a configurable completion threshold.
- Parallel: treat all unfinished topics in the subject as available together.
- Custom tiers: use explicit topic `tier` values to unlock groups.

### 1.3 — Circular Dependency Prevention ✅

```
When user adds a "depends_on" link (Topic B depends on Topic A):
  1. Graph check: would adding this edge create a cycle?
  2. If YES → show inline error: "This would create a loop: A → B → A"
     The link is NOT saved.

Result: circular dependencies cannot reach the scheduler.
```

---

## STAGE 2 — TOPIC PARAMETERS (How Much Effort) ✅

┌─────────────────────────────────────────────────────────────────────┐
│  For every topic you enter:                                         │
│                                                                     │
│  ├── Estimated Hours   → "I think this takes 10 hours total"       │
│  │     → Sessions needed = ceil(Total Hours × 60 / Session Mins)   │
│  │                                                                  │
│  ├── Session Length    → "Each sitting I study for 60 min"         │
│  │     Preset pills: 30m, 45m, 60m, 90m, 120m, custom             │
│  │     Minimum: 15 min. Maximum: 240 min. (0 is an error.)        │
│  │                                                                  │
│  ├── Priority          → 3 levels:                                  │
│  │     🔴 High   — "Must be completed, no compromises"             │
│  │     🟡 Medium — "Important but can shift if needed"             │
│  │     🟢 Low    — "Can be dropped/shortened in a squeeze"         │
│  │     (Internally: High=1, Med=3, Low=5 for scoring)              │
│  │                                                                  │
│  ├── Deadline          → "Must finish by March 20"                 │
│  │     (defaults to Global Deadline if blank)                      │
│  │                                                                  │
│  ├── Earliest Start    → "Don't start this before Feb 1"           │
│  │     (optional — leave blank to start from day 1)                │
│  │                                                                  │
│  ├── Depends On        → (with live cycle detection, see 1.3)      │
│  │                                                                  │
│  ├── Tier              → ordering group (0 = first, 1 = after 0s)  │
│  │                                                                  │
│  ├── Rest After (days) → "After finishing this topic, rest N days  │
│  │     before starting the next topic in this subject"             │
│  │     Pills: None / 1d / 2d / 3d.  Default: 0.                    │
│  │     Effect: inserts a gap between this topic's last session     │
│  │     and the next eligible topic's first session.                │
│  │                                                                  │
│  ├── Max Sessions/Day  → "Never study this topic more than N       │
│  │     sessions in one day"                                         │
│  │     Pills: ∞ / 1 / 2 / 3.  Default: no limit (∞).              │
│  │     Prevents burnout on heavy topics.                            │
│  │                                                                  │
│  └── Study Frequency   → Per-topic scheduling hint:                │
│        "daily"   → schedule every available day when possible      │
│        "spaced"  → every other day (gaps for retention)            │
│        "dense"   → concentrate sessions in as few days as possible │
│        Default: "daily"                                             │
│        This is a HINT — the scheduler overrides it when time is    │
│        tight (deadline pressure takes priority).                    │
└─────────────────────────────────────────────────────────────────────┘

### Duplicate Prevention ✅

```
When user types a topic name already in the same subject:
  → Inline warning. Save button disabled until name is changed.
  → No duplicates can ever reach the scheduler.
```

---

## STAGE 3 — TIME & CONSTRAINTS (Your Schedule) ✅

### 3.1 — Planning Window

```
├── Study Start Date     → When do you begin? (e.g. Feb 1)
├── Global Deadline      → When does everything need to be done?
│     (Replaces "Exam Date" — more general purpose.)
│
│   Derived: Total Planning Days = Global Deadline − Study Start Date
```

### 3.2 — Day Capacity

```
├── Weekday default   → minutes available Mon–Fri
├── Weekend default   → minutes available Sat–Sun
│
├── Per-Day-of-Week Overrides ✅
│     Optional collapsible section: set a different capacity for each
│     day of the week (e.g. Wednesday = 0h because of club meetings).
│     If not set, falls back to weekday/weekend defaults.
│
│   Stored as: day_of_week_capacity[0..6] (Sun=0 … Sat=6)
│   null = use default; number = use this value (in minutes)
│
└── Custom Per-Date Overrides ✅
      A mini calendar lets the student pick an exact date and override
      its capacity directly (including zeroing the day out entirely).
```

### 3.3 — Flexibility Allowance ✅

```
OLD: "Buffer 10%" → silently reduces EVERY day by 10%. Confusing.

NEW: "Flexibility: Allow increasing any day's capacity by up to N minutes
      if the planner needs it."

     Range: 0 – 120 min (0 / +15 / +30 / +45 / +60 / +90 / +120m pills).
     Default: 0 (strict — never exceed declared capacity).

     Effect: Each day stores BASE capacity and FLEX ceiling (base + allowance).
       Case 1: Total work ≤ total base  →  "Relaxed Fit". No day needs extra.
       Case 2: Total work fits in flex  →  "Snug Fit". Some days get ⚡ marker.
       Case 3: Work > total flex        →  "Overloaded". Fix-it panel shown.

     Days that get extended are marked "⚡ +Xm" in the preview so the
     student always sees exactly where they'll need to push harder.
```

### 3.4 — Focus Depth ✅

```
├── Max Subjects Per Day
│     0 = no limit;  2, 3, 4 = cap.
│     Subjects with deadline ≤ 7 days always bypass this limit (emergency).
│
├── Max Topics Per Subject Per Day  ✅
│     Default: 1. Options: 1, 2, 3, unlimited.
│     When > 1 and a subject has parallel/flexible topics, the scheduler
│     can place more than one topic's sessions in the same day.
│
├── Min Gap Between Same Subject Days  ✅
│     "Don't schedule the same subject two days in a row."
│     Options: No gap | 1 day | 2 days.  Default: No gap.
│     Automatically overridden if deadline ≤ 3 days (emergency).
│
└── Max Daily Ceiling  ✅
      Hard cap on total study minutes per day.
      Default: 8h (480 min). User can lower it.
      Overrides flexibility allowance — even if a day has flex capacity,
      it will never exceed this ceiling.
```

### 3.5 — Plan Order Builder ✅

```
Replaces the old 4 radio buttons (priority / deadline / subject / balanced).

The student builds a PRIORITY STACK of ordering rules. The scheduler
applies them top-to-bottom as tie-breakers.

Available criteria:
  ⚡ urgency        → (remaining sessions ÷ days left) × priority weight
  🔴 priority       → High > Medium > Low
  ⏰ deadline        → soonest first
  📚 subject_order  → Phase 1 entry order
  📊 effort         → most sessions remaining first
  🎯 completion     → closest to done first (momentum)

DEFAULT stack:  [urgency → priority → deadline]
(equivalent to the old "balanced" mode)

UI: drag-to-rank with ▲/▼ buttons and remove ✕. Inactive criteria shown
as "+ Add" pills. A legacy plan_order string is derived from the top
criterion for backward compatibility.
```

### 3.6 — Revision Reserve ✅

```
├── Final Revision Days
│     "Save the last N days before the deadline for revision only."
│     Options: 0 / 3 / 5 / 7 / 14 days.
│     The scheduling window ends at: Global Deadline − Revision Days.
```

---

## STAGE 4 — BUILDING THE CALENDAR OF USABLE DAYS ✅

```
START: Study Start Date
  │
  ▼
Is this date ≤ (Global Deadline − Revision Reserve Days)?
  │
  ├── NO  → STOP.
  │
  └── YES → Is this date a user-marked OFF DAY?
                │
                ├── YES → Skip. Move to next day.
                │
                └── NO  → Determine BASE capacity:
                            1. Per-day-of-week override? → use it
                            2. Otherwise: Sat/Sun → weekend default
                                          Mon–Fri → weekday default
                            │
                            Is Base > 0?
                            ├── NO  → Skip day
                            └── YES → Add to calendar.
                                       Flex Ceiling = Base + flexibility_minutes
                                       (used if total work > total base)

  Repeat for every day in the window.
```

**Result:** A list of usable study days, each with a `base` capacity and a `flex` ceiling.

---

## STAGE 5 — FEASIBILITY ✅

### 5.1 — Per-Topic Check

```
FOR EACH TOPIC:

  Sessions Needed = ceil(Estimated Minutes ÷ Session Length)
  Minutes Needed  = Sessions Needed × Session Length

  Available Minutes = sum of usable-day BASE capacities in
                      [max(earliest_start, study_start) … deadline]

  Ratio = Minutes Needed ÷ Available Minutes

  ┌──────────────────────────────────────────────────────────────┐
  │  Ratio ≤ 0.80  →  SAFE                                      │
  │  Ratio ≤ 0.90  →  TIGHT                                     │
  │  Ratio > 0.90  →  AT RISK                                   │
  │  Ratio > 1.00  →  IMPOSSIBLE                                 │
  │  Available = 0  →  IMPOSSIBLE                                │
  └──────────────────────────────────────────────────────────────┘
```

### 5.2 — Global Feasibility

```
  Total Base Capacity = sum of all usable-day BASE capacities
  Total Flex Capacity = sum of all usable-day FLEX capacities

  ✅  FEASIBLE      — Total Needed ≤ Total Base AND no topic IMPOSSIBLE
  ⚡  FLEX-FEASIBLE — Total Needed > Base BUT ≤ Flex  (flexFeasible = true)
  🔴  INFEASIBLE    — Total Needed > Flex  OR  any topic IMPOSSIBLE
```

### 5.3 — Live Feasibility Indicator ✅

```
A persistent health bar updates while the student edits topic parameters
and constraints. It shows overall fit plus per-topic risk states before
"Generate Plan" is pressed.
```

---

## STAGE 6 — SCHEDULING (Building the Day-by-Day Plan) ✅

### 6.1 — Pre-Scheduling Validation

```
Zero topics with effort > 0?
  → Status: NO_UNITS. UI redirects to Phase 1 with message.

No usable days in planning window?
  → Status: NO_DAYS. UI redirects to Phase 3 with message.

Circular dependency?
  → Detected via DFS. Status: INFEASIBLE.
```

### 6.2 — Capacity Strategy (replaces old Burn Rate Scaling)

```
CASE 1: Total Work ≤ Total Base Capacity
  → Use base capacities. Mark plan as "Relaxed Fit".

CASE 2: Total Work > Base  AND  ≤ Flex Capacity
  → Distribute overflow proportionally across days:
    Overflow = Total Work − Total Base
    For each day:
      Extra = min(flexibility_minutes, ceil(Overflow × DayBase / TotalBase))
      DayCapacity = DayBase + Extra
    → Mark each stretched day with "⚡ +Xm" in the preview.
    → Mark plan as "Snug Fit".

CASE 3: Total Work > Total Flex Capacity
  → Use full flex capacities (best effort).
  → Hard ceiling per day = max_daily_minutes.
  → Plan will be PARTIAL — report dropped sessions.
  → Mark plan as "Overloaded".
```

### 6.3 — Oversized Sessions

```
Find the biggest day flex capacity across all days.

For each topic:
  session_length > biggest flex capacity?
  └── YES → WARNING shown. Topic is not silently skipped.
             Student must shorten the session or increase capacity.
```

### 6.4 — Urgency Score (Improved Formula)

```
For each active topic on a given day:

  Days Left = max(1, ceil((Deadline − Today) in days))

  Completion Ratio = Sessions Placed ÷ Total Sessions
  Remaining Ratio  = Sessions Remaining ÷ Days Left

  Priority Weight:
    High (1)   → 3.0
    Medium (3) → 2.0
    Low (5)    → 1.0

  Urgency = Remaining Ratio × Priority Weight × (1 + (1 − Completion Ratio))

  Effect:
    - More sessions left + fewer days → higher urgency
    - Topics not yet started get a full 2× boost
    - Topics 80% done get only 1.2× boost
    This prevents nearly-done topics from stealing time from fresh ones.
```

### 6.5 — The Main Day Loop (Rebuilt)

```
FOR EACH usable day (in calendar order):

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP A: Refresh Dependencies                                   │
  │                                                                 │
  │  For each topic:                                                │
  │    Are all depends_on topics completed?                         │
  │    ├── YES → UNLOCKED                                           │
  │    └── NO  → LOCKED, skip today                                 │
  │                                                                 │
  │  Tier check: topics in tier N are locked until ALL topics in   │
  │  tiers < N are completed.                                       │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP B: Identify Active Topics                                 │
  │                                                                 │
  │  For each subject, find topics where ALL of:                    │
  │    ✓ Sessions remaining                                          │
  │    ✓ Unlocked (deps + tier complete)                            │
  │    ✓ Today ≥ earliest_start                                     │
  │    ✓ Today ≤ deadline                                           │
  │    ✓ Rest-after gap from predecessor has elapsed                │
  │    ✓ Subject gap rule met (min_subject_gap_days)                │
  │    ✓ max_sessions_per_day for this topic not yet hit today      │
  │    ✓ study_frequency hint honored where possible:              │
  │        "spaced" → skip if topic was studied yesterday           │
  │        "dense"  → prefer this topic over others if active       │
  │    ✓ Number of active topics in subject ≤ max_topics_per_       │
  │        subject_per_day                                          │
  │                                                                 │
  │  No valid topics → subject is IDLE today                        │
  └─────────────────────────────────────────────────────────────────┘

  Zero active subjects? → Skip day.

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP C: Order Subjects Using the Priority Stack                │
  │                                                                 │
  │  Apply plan_order_stack as a multi-level sort:                  │
  │    For each pair (A, B): compare Rule 1 → Rule 2 → Rule 3 …   │
  │    Fall back to subject entry order as stable tiebreaker.       │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP D: Focus Depth Filter                                     │
  │                                                                 │
  │  If max_active_subjects > 0:                                    │
  │    URGENT (deadline ≤ 7 days): always kept.                     │
  │    Regular slots = max(0, limit − count of urgents)             │
  │    Final list = [urgents] + [top N regulars from Step C]        │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP E: Round-Robin Session Placement                          │
  │                                                                 │
  │  Effective capacity = day's base or flex (from Stage 6.2).      │
  │  Per-subject daily cap (if multiple subjects):                  │
  │    max per subject = ceil(Effective Capacity × 0.60)            │
  │  Single subject active → no cap.                                │
  │                                                                 │
  │  ROUND-ROBIN LOOP (one session per subject per round):          │
  │    Skip if:                                                     │
  │      ✗ Subject hit 60% daily cap                                │
  │      ✗ No active topic for this subject                         │
  │      ✗ Topic hit its max_sessions_per_day for today             │
  │      ✗ Remaining day time < session_length                      │
  │                                                                 │
  │    Otherwise → Place session:                                   │
  │      Record: subject, topic, date, duration, session N/total    │
  │      Subtract session_length from remaining minutes             │
  │      If topic now fully done → mark complete, record date       │
  │                                                                 │
  │    Zero sessions placed in a full round → STOP this day.        │
  └─────────────────────────────────────────────────────────────────┘

  Move to next day.
```

---

## STAGE 7 — OVERFLOW RECOVERY (Catching Late Topics) ✅

```
After the main pass, some topics may have remaining sessions because:
  (a) Sequencing delay — an earlier topic took all the calendar space.
  (b) Rest-after gap pushed them past their original deadline.
  (c) Study frequency spacing reduced available slots.

RECOVERY PASS:

  REPEAT up to (Total Unplaced Sessions + 1) times:

    Find CANDIDATES — topics that are:
      ✓ Still have sessions remaining
      ✓ All prerequisites met
      ✓ The bottleneck is provably scheduling (not "never had enough time"):
          at least one predecessor in the same subject IS completed,
          OR the topic is parallel-mode but ran out of daily slots.

    Are there zero candidates? → STOP.

    Sort candidates:
      (Remaining ÷ Total Sessions) DESC  ← most behind first
      Then by priority (High → Low)

    For each candidate, scan study_start → global_deadline:
      ├── Skip if day capacity < session_length
      ├── Skip if day is before earliest_start
      ├── Skip if rest-after gap from predecessor not elapsed
      ├── NO DEADLINE CHECK (relaxed for overflow recovery)
      └── Place session, subtract from day's remaining capacity.

    If ANY session placed → loop again.
    If NONE placed in full pass → STOP.

  Report: X sessions rescued via overflow recovery.
```

---

## STAGE 8 — FINAL SORT & ENRICHMENT ✅

```
All placed sessions sorted by:
  1. Date ASC (earliest first)
  2. Top criterion from plan_order_stack (e.g., urgency DESC)
  3. Subject entry order (stable tie-breaker)

Session metadata enriched with:
  - session_number / total_sessions  ("Session 3 of 10")
  - is_flex_day: boolean             (was this day's capacity extended?)
  - flex_extra_minutes: number       (how many extra minutes were used)
  - topic_completion_after: number   (0.0–1.0, percentage done after session)
  - is_topic_final_session: boolean  (shown as 🎯 in the preview)
```

---

## STAGE 9 — PLAN PREVIEW ✅

```
Calendar-style view of the generated schedule. Each day shows:

  [Subject A – Topic X (3/10)] [60 min] ⚡ 70%
  [Subject B – Topic Y (1/5)]  [45 min] 🎯
  Day total: 1h 45m / 2h capacity (⚡ +15m flex used)

  Color-coded by subject.
  ⚡ = this day uses flex capacity (+Xm shown).
  🎯 = final session of this topic (topic ends today).
  70% = topic_completion_after (how far through the topic after this session).

Stats bar shows:
  Total sessions | Total hours | Subjects | Topics
  Fit status: ✅ Relaxed / ⚡ Snug (flex used) / 🔴 Overloaded

Plan review section highlights:
  - Which sessions will flex beyond declared capacity
  - How the top 3 ordering criteria drive today's order
  - Any topics that could not be placed (PARTIAL result)
```

### Interactive Plan Editing ✅

```
Post-generation editing actions available in preview:
  → DELETE SESSION (remove it from the local draft)
  → MOVE SESSION (drag-and-drop to a different day)
  → PIN SESSION  (lock to date, survives re-optimization)
  → SWAP SESSIONS (pick two sessions and exchange their days)
  → ADD MANUAL SESSION (+ on any day → pick topic → add pinned session)
  → RE-OPTIMIZE AROUND EDITS (rebuild only the unpinned generated sessions)
```

---

## STAGE 10 — OUTCOMES (All Possible Results) ✅

```
generatePlan() outcome tree:

  Zero topics with effort > 0?
  └──► Status: NO_UNITS
       UI: redirect to Phase 1 with call-to-action message.

  No usable days in planning window?
  └──► Status: NO_DAYS
       UI: redirect to Phase 3 with capacity fix suggestions.

  Schedule empty + not feasible?
  └──► Status: INFEASIBLE
       UI: show feasibility report + suggestions.

  Schedule partially filled (some sessions dropped)?
  └──► Status: PARTIAL
       UI: show schedule + list of dropped sessions + fix suggestions.
       Wizard advances to preview (Phase 4) showing what DID fit.

  Everything fits?
  └──► Status: READY
       UI: show full schedule + analysis + editing tools.

  In ALL non-empty cases the schedule is returned with the feasibility
  report. The student always sees something actionable.
```

---

## STAGE 11 — COMMITTING (Saving the Plan) ✅

```
Student reviews the plan preview, then chooses how to handle OLD tasks:

  ┌────────────────────────────────────────────────────────────────┐
  │  "until"        → Keep tasks BEFORE new plan's first date.     │
  │                   Delete from new plan start onwards.          │
  │                                                                │
  │  "future"       → Keep tasks AFTER new plan's first date.      │
  │                   Delete tasks that overlap the new window.    │
  │                                                                │
  │  "merge"  (NEW) → Keep ALL existing tasks. Add new sessions    │
  │                   only where no existing task already exists.  │
  │                   (Useful for partial re-plans.)               │
  │                                                                │
  │  "none"         → Delete ALL old generated tasks.              │
  │                   Start completely fresh.                      │
  └────────────────────────────────────────────────────────────────┘

Then:
  1. Delete old tasks per chosen mode.
  2. Insert all new sessions as tasks in the database.
  3. Save a snapshot (plan_version) with the full schedule + config.
  4. Calendar and dashboard automatically refresh.
```

---

## STAGE 12 — RESCHEDULE MISSED (Emergency Recovery) ✅

```
You fell behind. This rescues incomplete sessions intelligently.

1. Find ALL incomplete generated tasks (past + future).
   Sort by: priority (High first), then scheduled date ASC.

2. Build available calendar from TODAY → Global Deadline.
   (Same capacity rules as normal scheduling.)

3. Reserve time already taken by:
   - Manual tasks (not generated by planner)
   - Completed sessions

4. SMART RE-PLACEMENT:
   - Group missed tasks by subject.
   - Re-run a mini scheduling pass on only the missed tasks,
     respecting: topic ordering, rest-after gaps, subject gap rules,
     study frequency preferences, and focus depth limits.
   - Better than blind greedy first-fit.

5. Delete old incomplete generated tasks.
6. Insert newly placed tasks.
7. Report:
   ├── X sessions rescheduled successfully
   ├── Y sessions could not fit (with reasons)
   └── Z completed sessions kept in place
```

---

## DECISION MAP — EVERY POSSIBLE PATH ✅

```
Student enters the Planner
│
├─► Phase 1: Structure
│     Build subjects → topics. Set depends_on, tier.
│     Cycle detection prevents impossible dependency chains.
│
├─► Phase 2: Parameters
│     Set effort, priority, session length, rest_after_days,
│     max_sessions_per_day, study_frequency, tier, deadline, etc.
│     Duplicates / cycles blocked at input time.
│
├─► Phase 3: Constraints
│     Set planning window, weekday/weekend capacity,
│     per-day-of-week overrides, flexibility allowance,
│     max_daily_minutes, focus depth, plan_order_stack,
│     min_subject_gap_days, max_topics_per_subject_per_day,
│     revision reserve, off days.
│
├─► Phase 4: Generation (on "Generate Plan")
│     Build calendar of usable days (base + flex ceilings).
│     Apply capacity strategy (relaxed / snug / overloaded).
│     Run main day loop with full v2 constraint set.
│     Run overflow recovery pass.
│     Sort + enrich sessions.
│     │
│     Result:
│     ├── NO_UNITS   → Back to Phase 1 with message
│     ├── NO_DAYS    → Back to Phase 3 with message
│     ├── INFEASIBLE → Show feasibility report + suggestions
│     ├── PARTIAL    → Show schedule + dropped sessions list
│     └── READY      → Show full schedule + analysis
│
├─► Phase 5: Preview
│     Student reviews day-by-day schedule.
│     Flex days marked ⚡, final sessions marked 🎯, completion shown.
│     Can delete, move, pin, swap, add manual sessions, and re-optimize.
│
├─► Phase 6: Commit
│     Choose keep mode (until / future / merge / none).
│     Plan written to DB via commit_plan_atomic RPC.
│     Dashboard + Calendar refresh.
│
└─► Post-Commit:
      → Reschedule Missed (emergency recovery from dashboard)
      → Re-enter planner to adjust constraints and re-commit
```

---

## IMPLEMENTATION STATUS SUMMARY

| Feature | Status |
|---|---|
| Subject / topic hierarchy | ✅ |
| Topic tiers (parallel groups) | ✅ |
| Circular dependency prevention | ✅ |
| Priority as 3 levels (High/Med/Low) | ✅ |
| Rest After days per topic | ✅ |
| Max Sessions Per Day per topic | ✅ |
| Study Frequency preference (daily/spaced/dense) | ✅ |
| Per-day-of-week capacity overrides | ✅ |
| Flexibility allowance (replaces buffer %) | ✅ |
| Max daily minutes ceiling | ✅ |
| Max topics per subject per day | ✅ |
| Min subject gap days | ✅ |
| Plan Order Priority Stack (drag-to-rank, 6 criteria) | ✅ |
| Revision reserve days | ✅ |
| Capacity strategy (relaxed/snug/overloaded) | ✅ |
| Improved urgency score formula | ✅ |
| Overflow recovery pass (sequencing rescue) | ✅ |
| Session enrichment (flex markers, completion %, final session) | ✅ |
| PARTIAL / NO_DAYS outcome handling | ✅ |
| Merge commit mode | ✅ |
| Reschedule Missed (smart re-placement) | ✅ |
| Per-date custom capacity (mini calendar) | ✅ |
| Full per-subject ordering modes (Sequential/Flexible/Parallel/Custom) | ✅ |
| Live feasibility bar in phases 1–3 | ✅ |
| Fix-It panel with auto-fix buttons | 🔜 |
| Interactive plan editing (pin, move, swap, add) | ✅ |
| Re-optimize around pinned sessions | ✅ |
