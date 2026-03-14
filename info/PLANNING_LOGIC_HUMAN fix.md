# The Study Planner — Complete Logic for Humans (v2 — Student-First Redesign)

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
    study (your rules)        Lets you drag, pin, lock,         actually works)
  → Your available time       gap, and override anything
  → Your deadlines            Checks feasibility live
```

---

## STAGE 1 — STRUCTURE (What to Study)

### 1.1 — Subject & Topic Hierarchy (same as before)

```
Subject (e.g. "Maths")
  └── Topic 1  (e.g. "Calculus")
  └── Topic 2  (e.g. "Algebra")
  └── Topic 3  (e.g. "Statistics")
```

### 1.2 — Topic Ordering Mode (NEW — replaces the old strict sequential rule)

┌─────────────────────────────────────────────────────────────────────┐
│  PER SUBJECT, the user chooses one of:                              │
│                                                                     │
│  ┌── "Sequential" (old default)                                     │
│  │     Topic 1 must be 100% done before Topic 2 starts.            │
│  │     Strict, no interleaving within this subject.                │
│  │                                                                  │
│  ├── "Flexible Sequential"  (NEW)                                   │
│  │     Topics are still ordered, BUT the next topic can begin      │
│  │     once the previous topic reaches a user-defined threshold.   │
│  │     Default threshold: 80%  (e.g. 8 of 10 sessions done).      │
│  │     User can set per-subject: 50%, 60%, 80%, 100%.              │
│  │     Effect: slight overlap, smoother flow.                      │
│  │                                                                  │
│  ├── "Parallel"  (NEW)                                              │
│  │     ALL topics in this subject can be studied simultaneously.   │
│  │     Scheduler round-robins across them on any given day.        │
│  │     User may still set explicit depends_on for specific pairs.  │
│  │                                                                  │
│  └── "Custom Order"  (NEW)                                          │
│        User DRAGS topics into groups/tiers:                         │
│          Tier 1: [Calculus, Algebra]  ← study these in parallel    │
│          Tier 2: [Statistics]         ← only after Tier 1 done     │
│        Tiers are sequential; within a tier, topics are parallel.   │
│        Gives maximum control while keeping the UI simple.          │
└─────────────────────────────────────────────────────────────────────┘

### 1.3 — Circular Dependency Prevention (moved from Stage 4 to HERE)

```
When user adds a "depends_on" link (Topic B depends on Topic A):

  1. INSTANT graph check: would adding this edge create a cycle?
     (A→B→…→A  detected via DFS on the dependency graph)
  2. If YES → show inline error: "This would create a loop: A → B → A"
     The link is NOT saved. User must remove one edge first.
  3. Dependency dropdown only shows VALID targets (topics not already
     upstream of the current topic). Impossible choices are greyed out.

Result: Circular dependencies CANNOT exist by the time we reach the scheduler.
```

---

## STAGE 2 — TOPIC PARAMETERS (How Much Effort)

┌─────────────────────────────────────────────────────────────────────┐
│  For every topic you enter:                                         │
│                                                                     │
│  ├── Estimated Hours   → "I think this takes 10 hours total"       │
│  │     Input modes: Total hours | Days (×2h default) | Lectures    │
│  │                                                                  │
│  ├── Session Length    → "Each sitting I study for 60 min"         │
│  │     Preset pills: 30m, 45m, 60m, 90m, 120m, custom             │
│  │     → Sessions needed = ceil(Total Hours × 60 / Session Mins)   │
│  │                                                                  │
│  ├── Priority          → 3 levels only:                             │
│  │     🔴 High   — "Must be completed, no compromises"             │
│  │     🟡 Medium — "Important but can shift if needed"             │
│  │     🟢 Low    — "Can be dropped/shortened in a squeeze"         │
│  │     (Internally mapped: High=1, Med=3, Low=5 for scoring)       │
│  │                                                                  │
│  ├── Deadline          → "Must finish by March 20"                 │
│  │     (defaults to Global Deadline if blank)                      │
│  │                                                                  │
│  ├── Earliest Start    → "Don't start this before Feb 1"           │
│  │     (optional — leave blank to start from day 1)                │
│  │                                                                  │
│  ├── Depends On        → (with live cycle detection, see 1.3)      │
│  │                                                                  │
│  ├── Rest After (NEW)  → "After finishing this topic, rest __ days │
│  │     before starting the next topic in this subject"             │
│  │     Default: 0 days. Common: 1-2 days.                          │
│  │     Effect: inserts a gap between this topic's last session     │
│  │     and the next topic's first session in the same subject.     │
│  │                                                                  │
│  ├── Max Sessions Per Day (NEW) → "Never study this topic more     │
│  │     than 2 sessions in one day"                                  │
│  │     Default: no limit. Prevents burnout on heavy topics.        │
│  │                                                                  │
│  └── Study Frequency Preference (NEW) → Per topic:                 │
│        "daily"   → schedule every available day if possible        │
│        "spaced"  → schedule every other day (gaps for retention)   │
│        "dense"   → concentrate sessions in as few days as possible │
│        Default: "daily"                                             │
│        This is a HINT to the scheduler, not a hard constraint.     │
│        If time is tight, the scheduler may override it.            │
└─────────────────────────────────────────────────────────────────────┘

### Duplicate Prevention

```
When user types a topic name that already exists in the same subject:
  → Inline warning: "A topic with this name already exists"
  → Save button disabled until name is changed
  → No duplicates can ever reach the scheduler
```

### Session Length Validation

```
Session length must be ≥ 15 minutes and ≤ 240 minutes.
If user enters 0 → show error, do not save.
(Old behavior of silently forcing to 1 min is gone — explicit is better.)
```

---

## STAGE 3 — TIME & CONSTRAINTS (Your Schedule)

### 3.1 — Planning Window

```
├── Study Start Date     → When do you begin? (e.g. Feb 1)
├── Global Deadline      → When does everything need to be done?
│     (Replaces "Exam Date" — more general. Could be an exam,
│      a project due date, end of semester, etc.)
│
│   Derived: Total Planning Days = Global Deadline − Study Start Date
│            Shown as a badge: "47 days total"
```

### 3.2 — Day Capacity (NEW Mini-Block Calendar Interface)

┌─────────────────────────────────────────────────────────────────────┐
│  CAPACITY SETUP — a visual, interactive mini-block:                 │
│                                                                     │
│  ┌── DEFAULT CAPACITIES (scrollable hour selector)                  │
│  │     Weekday default:  [0.5h] [1h] [1.5h] [2h] [3h] [4h] ...   │
│  │     Weekend default:  [0.5h] [1h] [1.5h] [2h] [3h] [4h] ...   │
│  │     Shown in hours, stored as minutes internally.               │
│  │                                                                  │
│  ├── PER-DAY-OF-WEEK OVERRIDES (NEW)                                │
│  │     Optional expandable section:                                 │
│  │     Monday:    [2h]  ← "I have a free afternoon on Mondays"    │
│  │     Tuesday:   [1h]                                              │
│  │     Wednesday: [0h]  ← "Zero capacity = recurring off day"     │
│  │     Thursday:  [1h]                                              │
│  │     Friday:    [1.5h]                                            │
│  │     Saturday:  [3h]                                              │
│  │     Sunday:    [3h]                                              │
│  │     If not set, falls back to weekday/weekend defaults.         │
│  │                                                                  │
│  ├── MINI CALENDAR (NEW visual component)                           │
│  │     Shows planning window as a grid of date cells.              │
│  │     Default color: capacity-based (green = high, yellow = low)  │
│  │     Click a date → toggle OFF day (greyed out)                  │
│  │     Long-press / right-click a date → set CUSTOM hours for     │
│  │       that specific day (overrides all defaults)                │
│  │     Drag to select multiple dates → bulk set off / custom      │
│  │     Visual indicators:                                           │
│  │       ⬜ Off day (0 capacity)                                    │
│  │       🟩 Normal capacity                                        │
│  │       🟨 Reduced custom capacity                                │
│  │       🟦 Increased custom capacity                               │
│  │                                                                  │
│  └── LIVE STATS BAR (always visible)                                │
│        Total study days: 39                                         │
│        Total available hours: 72.5h                                 │
│        Average per day: 1.86h                                       │
│        Updated instantly as the user makes any change.             │
└─────────────────────────────────────────────────────────────────────┘

### 3.3 — Flexibility Allowance (replaces Buffer %)

```
OLD: "Buffer 10%" → silently reduces EVERY day by 10%.
     Problem: Student never sees the reduction. Confusing.

NEW: "Flexibility: Allow increasing any day's capacity by up to __ minutes
      if the planner needs it."

     Default: 30 min
     Range: 0 – 120 min (in 15-min steps)

     Effect: The scheduler's BASE capacity uses the user's set hours.
             If the plan doesn't fit at base capacity, the scheduler
             may add up to [flexibility] extra minutes on any day.
             Each day that gets extended is flagged with a "⚡ +15m"
             marker so the student sees where they'll need to push harder.

     This is MORE intuitive:
       "I set 2h/day, but I'm okay with going up to 2h30 if needed"
       instead of: "10% buffer means... wait, does 10% make my 2h into 1h48?"
```

### 3.4 — Focus Depth (expanded)

```
├── Max Subjects Per Day (same as before)
│     0 = no limit;  2, 3, 4 = cap
│     Subjects with deadline ≤ 7 days always bypass this limit.
│
├── Max Topics Per Subject Per Day (NEW)
│     Default: 1 (finish one topic at a time within the daily slot)
│     Options: 1, 2, 3, unlimited
│     Effect: if set to 2 and a subject has Topics A and B both
│     active (in Parallel/Flexible mode), the scheduler can place
│     sessions for BOTH in the same day. If set to 1, only Topic A
│     (the earliest/most urgent) gets sessions that day.
│
├── Min Gap Between Same Subject (NEW — anti-fatigue rule)
│     "Don't schedule the same subject two days in a row"
│     Options: "No gap" | "1 day gap" | "2 day gap"
│     Default: No gap.
│     Effect: if set to 1, Maths on Monday → no Maths on Tuesday.
│     Overridden if deadline is ≤ 3 days (emergency override).
```

### 3.5 — Plan Order Builder (NEW — replaces 4 radio buttons)

┌─────────────────────────────────────────────────────────────────────┐
│  PLAN ORDER BUILDER — interactive mini-interface                    │
│                                                                     │
│  Instead of choosing one of 4 fixed modes, the student builds      │
│  a PRIORITY STACK of ordering rules. The scheduler applies them    │
│  top-to-bottom as tie-breakers.                                    │
│                                                                     │
│  Example stacks:                                                    │
│                                                                     │
│  Stack A (deadline-focused student):                                │
│    1. ⏰ Deadline (soonest first)                                    │
│    2. 🔴 Priority (highest first)                                   │
│    3. 📚 Subject order (entry order)                                │
│                                                                     │
│  Stack B (priority-focused student):                                │
│    1. 🔴 Priority (highest first)                                   │
│    2. ⚡ Urgency (sessions needed ÷ days left)                     │
│    3. ⏰ Deadline (soonest first)                                    │
│                                                                     │
│  Stack C (subject-block student — studies one subject at a time):  │
│    1. 📚 Subject order                                              │
│    2. 🔴 Priority                                                   │
│                                                                     │
│  Available sort criteria (drag to build your stack):               │
│    ⏰ Deadline proximity (soonest deadline first)                    │
│    🔴 Priority level (High > Med > Low)                             │
│    ⚡ Urgency score (dynamic: remaining work ÷ remaining time)     │
│    📚 Subject order (Phase 1 entry order)                           │
│    📊 Effort remaining (most work left first)                       │
│    🎯 Completion % (closest to done first — momentum strategy)     │
│                                                                     │
│  DEFAULT stack (if user doesn't customize):                        │
│    1. Urgency  2. Priority  3. Deadline                            │
│    (This is effectively the old "balanced" mode)                   │
│                                                                     │
│  PRESETS (one-click):                                               │
│    [Balanced] [Deadline-first] [Priority-first] [One-subject]     │
│    Clicking a preset populates the stack; user can then tweak.    │
└─────────────────────────────────────────────────────────────────────┘

### 3.6 — Session Preferences (NEW global section)

```
├── Preferred Session Gap (NEW)
│     "I want at least __ minutes between study sessions on the same day"   ++++ I dont want this feature.
│     Default: 0 (sessions are back-to-back)
│     Options: 0, 10, 15, 30 minutes
│     Effect: Gap time is subtracted from day capacity when
│     computing how many sessions fit. Shown visually in the schedule.
│     (e.g., two 60-min sessions with 15-min gap = needs 135 min of capacity)
│
├── Max Total Study Hours Per Day (NEW — hard ceiling)
│     Default: 8 hours (480 min)
│     User can lower it: "Never schedule more than 4 hours in one day"
│     Effect: absolute cap that overrides everything, including
│     flexibility allowance and burn-rate scaling.
```

---

## STAGE 4 — BUILDING THE CALENDAR OF USABLE DAYS

```
START: Study Start Date
  │
  ▼
Is this date ≤ Global Deadline?
  │
  ├── NO  → STOP. No more scheduling days.
  │
  └── YES → Is this date a user-marked OFF DAY?
             (either from mini-calendar or recurring off-day rules)
                │
                ├── YES → Skip this day. Move to next day.
                │
                └── NO  → Determine this day's BASE capacity:
                            │
                            ├── Does this specific date have a CUSTOM capacity?
                            │     └── YES → Base Capacity = custom value
                            │
                            ├── Does this day-of-week have an override?
                            │     └── YES → Base Capacity = day-of-week override
                            │
                            └── NO  → Is Sat/Sun?
                                        ├── YES → Base Capacity = weekend default
                                        └── NO  → Base Capacity = weekday default
                            │
                            ▼
                Is Base Capacity > 0?
                            │
                            ├── NO  → Skip day
                            └── YES → Add to calendar with this capacity.
                                       Also store: Flex Capacity = Base + Flexibility Allowance
                                       (The scheduler may use up to Flex Capacity if needed,
                                        but BASE is the preferred target.)

  Repeat for every day until the window ends.
```

**Result:** A list of "usable study days", each with a base capacity AND a flex ceiling.

---

## STAGE 5 — LIVE FEASIBILITY (Continuous — Not a Separate Step)

> *"Feasibility is no longer a gate between 'fill in params' and 'generate'.
> It runs CONTINUOUSLY as the student fills in data, updating in real time."*

### 5.1 — Live Indicators (shown while student is STILL filling in phases 1-3)

```
As student types/changes anything, a persistent status bar shows:

  ┌──────────────────────────────────────────────────────────────────┐
  │  📊 Plan Health:  ✅ Feasible  |  Total: 85h needed / 105h available  │
  │  ─── or ───                                                      │
  │  📊 Plan Health:  ⚠️ 12h short  |  3 topics at risk              │
  │  ─── or ───                                                      │
  │  📊 Plan Health:  🔴 Impossible  |  "Calculus" has no time window │
  └──────────────────────────────────────────────────────────────────┘

This bar updates after every input change (debounced 500ms).
It runs the lightweight feasibility check in the background.
```

### 5.2 — Per-Topic Status (shown in Phase 2 parameter table)

```
Next to each topic row, a small dot/icon:

  🟢  Safe       (ratio ≤ 0.80)
  🟡  Tight      (ratio ≤ 0.90)
  🟠  At Risk    (ratio > 0.90)
  🔴  Impossible (ratio > 1.00 or no time window)

Hovering the dot shows: "Needs 10 sessions, has capacity for 8. Short by 2 sessions."
```

### 5.3 — Detailed Feasibility (per topic)

```
FOR EACH TOPIC:

  Sessions Needed = ceil(Estimated Minutes ÷ Session Length)
  Minutes Needed  = Sessions Needed × Session Length

  Available Minutes = sum of usable-day capacities in
                      [max(earliest_start, study_start) … deadline]
                      accounting for: off days, custom capacities,
                      rest gaps, and session-gap overhead

  Ratio = Minutes Needed ÷ Available Minutes

  ┌──────────────────────────────────────────────────────────────┐
  │  Ratio ≤ 0.80  →  SAFE                                      │
  │  Ratio ≤ 0.90  →  TIGHT                                     │
  │  Ratio > 0.90  →  AT RISK                                   │
  │  Ratio > 1.00  →  IMPOSSIBLE                                 │
  │  Available = 0  →  IMPOSSIBLE                                │
  └──────────────────────────────────────────────────────────────┘
```

### 5.4 — Global Feasibility

```
  Total Minutes Needed  = sum of all topics' Minutes Needed
  Total Base Capacity   = sum of all usable-day BASE capacities
  Total Flex Capacity   = sum of all usable-day FLEX capacities (base + flexibility)

  Plan is FEASIBLE if:
    Total Needed ≤ Total Base Capacity  AND  no topic is IMPOSSIBLE
    → shown as ✅

  Plan is FLEX-FEASIBLE if:
    Total Needed > Total Base Capacity  BUT  Total Needed ≤ Total Flex Capacity
    → shown as ⚠️ "Fits if you use your flexibility allowance on some days"

  Plan is INFEASIBLE if:
    Total Needed > Total Flex Capacity  OR  any topic is IMPOSSIBLE
    → shown as 🔴
```

### 5.5 — The Fix-It Panel (NEW — shown when problems exist)

```
When there are IMPOSSIBLE topics or a global gap:

  ┌────────────────────────────────────────────────────────────────────┐
  │  🔴 PLAN ISSUES — 2 problems found                                │
  │                                                                    │
  │  ┌─ Problem 1: "Statistics" is impossible                          │
  │  │  Needs 15 sessions (15h) but only 8h available before deadline │
  │  │  Gap: 7 hours                                                   │
  │  │                                                                 │
  │  │  Suggestions:                                                   │
  │  │    [🔧 Auto-fix: Extend deadline by 5 days]                    │
  │  │    [🔧 Auto-fix: Reduce effort to 8 hours]                     │
  │  │    [🔧 Auto-fix: Add 45 min/day on weekdays]                   │
  │  │    [✏️  Edit manually]  ← opens inline editor right here       │
  │  │                                                                 │
  │  ├─ Problem 2: Global gap of 3 hours                               │
  │  │  Total needed: 78h | Available: 75h                             │
  │  │                                                                 │
  │  │  Suggestions:                                                   │
  │  │    [🔧 Auto-fix: Use flexibility allowance (+30m on 6 days)]   │
  │  │    [🔧 Auto-fix: Extend Global Deadline by 2 days]              │
  │  │    [🔧 Auto-fix: Reduce lowest-priority topic by 3h]           │
  │  │    [✏️  Edit manually]                                          │
  │  │                                                                 │
  │  └─ [🔧 Fix ALL automatically]  ← applies the top suggestion for │
  │       each problem in one click                                    │
  └────────────────────────────────────────────────────────────────────┘

  Auto-fix buttons APPLY the change instantly (update the form fields).
  User sees the change reflected and can undo or adjust further.
  The feasibility bar at top re-calculates immediately.


```

---

## STAGE 6 — SCHEDULING (Building the Day-by-Day Plan)

### 6.1 — Pre-Scheduling Validation

```
Zero topics with effort > 0?
  → Show prominent message: "Add topics and set their study hours to generate a plan."
  → Do NOT silently return empty. Keep the user on the same page with a call-to-action.

All inputs already validated:
  - No circular dependencies (prevented in Stage 1)
  - No duplicate topics (prevented in Stage 1)
  - No zero-length sessions (prevented in Stage 2, minimum 15 min)
  - No zero-capacity plans (prevented by live feasibility in Stage 5)
```

### 6.2 — Capacity Strategy (replaces old Burn Rate Scaling)

```
Total Work (minutes) = sum of all (sessions × session_length) for every topic
Total Base Capacity = sum of all day BASE capacities
Total Flex Capacity = sum of all day FLEX capacities

CASE 1: Total Work ≤ Total Base Capacity
  → Use base capacities. Comfortable fit.
  → Mark plan as "Relaxed Fit" (no days need stretching)

CASE 2: Total Work > Total Base Capacity  AND  ≤ Total Flex Capacity
  → Distribute overflow proportionally across days using flexibility:
    Overflow = Total Work − Total Base Capacity
    For each day:
      Extra = min(FlexAllowance, ceil(Overflow × (DayBase / TotalBase)))
      DayCapacity = DayBase + Extra
    → Mark affected days with "⚡ +Xm" in the schedule preview
  → Mark plan as "Snug Fit" (some days need a push)

CASE 3: Total Work > Total Flex Capacity
  → Use full flex capacities on all days (best effort)
  → Hard ceiling per day = user's Max Total Study Hours
  → Plan will be incomplete — report which topics/sessions got dropped
  → Mark plan as "Overloaded — not everything fits"
  → Show Fix-It Panel (Stage 5.5)
```

### 6.3 — Oversized Sessions

```
Find the biggest day capacity (after flex) across all days.

For each topic:
  Is session_length > biggest day flex capacity?
  └── YES → WARNING (not silent skip).
             Show: "Topic X has 3-hour sessions but your longest day is 2.5h.
                    Either shorten the session or increase that day's capacity."
             [🔧 Auto-fix: Split into 2 × 90min sessions]
             [🔧 Auto-fix: Increase Tuesday to 3h]
             [✏️  Edit manually]

  These are NOT silently skipped. The student decides.
```

### 6.4 — Urgency Score (improved formula)

```
For each active topic on a given day:

  Days Left = max(1,  ceil((Deadline − Today) in days))

  Completion Ratio = Sessions Placed ÷ Total Sessions
  Remaining Ratio  = Sessions Remaining ÷ Days Left

  Priority Weight:
    High (1)   → 3.0
    Medium (3) → 2.0
    Low (5)    → 1.0

  Urgency = Remaining Ratio × Priority Weight × (1 + (1 − Completion Ratio))

  Intuition:
    - More sessions left + fewer days → high urgency (same as before)
    - Higher priority → stronger multiplier (simplified from old 6-N scale)
    - Topics that haven't started yet get a boost (1 + 1.0 = 2x)
    - Topics that are 80% done get less boost (1 + 0.2 = 1.2x)
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
  │  Also: For "Flexible Sequential" subjects:                      │
  │    If previous topic completion ≥ threshold (e.g. 80%),         │
  │    the NEXT topic is also UNLOCKED.                             │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP B: Identify Active Topics                                 │
  │                                                                 │
  │  For each subject, based on its ordering mode (see Stage 1.2): │
  │                                                                 │
  │  "Sequential":                                                  │
  │    → First unfinished topic that is unlocked + in date window. │
  │    → Only ONE active topic per subject.                         │
  │                                                                 │
  │  "Flexible Sequential":                                         │
  │    → First unfinished topic always active.                      │
  │    → ALSO next topic if previous ≥ threshold% complete.         │
  │    → Up to max_topics_per_subject_per_day active.               │
  │                                                                 │
  │  "Parallel":                                                    │
  │    → ALL unfinished topics in date window and unlocked.         │
  │    → Capped by max_topics_per_subject_per_day.                  │
  │                                                                 │
  │  "Custom Order (Tiers)":                                        │
  │    → Current tier's topics are parallel.                        │
  │    → Next tier only starts when ALL topics in current tier      │
  │      are complete.                                              │
  │                                                                 │
  │  For ALL modes:                                                 │
  │    ✓ Topic must have sessions remaining                         │
  │    ✓ Today ≥ topic's earliest_start                             │
  │    ✓ Today ≤ topic's deadline                                   │
  │    ✓ Rest-after gap from predecessor must have elapsed          │
  │      (e.g., predecessor finished on Monday, rest=2 → earliest  │
  │       this topic can start is Thursday)                         │
  │    ✓ Subject gap rule met (min gap between same subject days)   │
  │    ✓ Max sessions per day for this topic not exceeded           │
  │    ✓ Study frequency preference honored where possible:         │
  │      "spaced" → skip if this topic was studied yesterday       │
  │      "dense"  → prefer this topic over others if already active│
  │                                                                 │
  │  No valid topics → subject is IDLE today                        │
  └─────────────────────────────────────────────────────────────────┘

  Zero active subjects today? → Skip day.

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP C: Order Subjects Using the Priority Stack               │
  │                                                                 │
  │  Apply the user's ordering stack (from Stage 3.5) as a         │
  │  multi-level sort:                                              │
  │                                                                 │
  │  For each pair of subjects (A, B):                              │
  │    Compare using Rule 1 from the stack.                         │
  │    If tied → compare using Rule 2.                              │
  │    If still tied → compare using Rule 3.                        │
  │    If still tied → use subject entry order (stable fallback).   │
  │                                                                 │
  │  Example with stack [Urgency, Priority, Deadline]:              │
  │    Maths urgency=4.2, Physics urgency=4.2 → tied               │
  │    Maths priority=High, Physics priority=Med → Maths first     │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP D: Focus Depth Filter                                     │
  │                                                                 │
  │  If max_active_subjects > 0:                                    │
  │    URGENT subjects (deadline ≤ 7 days): always kept.            │
  │    Regular slots = max(0, limit − count of urgents)             │
  │    Final list = [urgents] + [top N regulars from Step C order]  │
  │                                                                 │
  │  Also apply max_topics_per_subject_per_day within each subject. │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP E: Session Placement (Round-Robin with Constraints)      │
  │                                                                 │
  │  Compute available minutes:                                     │
  │    Effective Capacity = day's capacity (base or flex, see 6.2)  │
  │                                                                 │
  │  Per-subject daily cap:                                         │
  │    If multiple subjects active:                                 │
  │      Max per subject = ceil(Effective Capacity × 0.60)          │
  │      (no one subject takes more than 60% of the day)            │
  │    If only 1 subject active:                                    │
  │      No cap (gets the whole day)                                │
  │                                                                 │
  │  Account for session gaps:                                      │
  │    If session_gap > 0 and sessions already placed today:        │
  │      Remaining -= session_gap (for the gap before this session) │
  │                                                                 │
  │  ROUND-ROBIN LOOP:                                              │
  │    Cycle through ordered subject list, 1 session per subject    │
  │    per round. For each subject in each round:                   │
  │                                                                 │
  │      Skip if:                                                   │
  │        ✗ Subject hit 60% daily cap                              │
  │        ✗ No active topic for this subject today                 │
  │        ✗ Topic hit its max_sessions_per_day limit               │
  │        ✗ Remaining day time < session_length + gap              │
  │        ✗ Adding session would exceed 60% cap (for 2nd+ session) │
  │                                                                 │
  │      Otherwise:                                                 │
  │        Place the session:                                       │
  │          Record: subject, topic, date, duration, session #/total│
  │          Subtract (session_length + gap) from remaining minutes │
  │          Add session_length to subject's daily usage tally      │
  │          If topic now fully done:                                │
  │            Mark topic as complete                               │
  │            Record completion date (for rest-after gap calc)     │
  │            Next round: subject may advance to next topic        │
  │                                                                 │
  │    If zero sessions placed in an entire round → STOP this day  │
  └─────────────────────────────────────────────────────────────────┘

  Move to next day.
```

---

## STAGE 7 — OVERFLOW RECOVERY (Catching Late Topics — Improved)

```
After the main pass, some topics may have remaining sessions because:
  (a) Sequencing delay — an earlier topic took all the calendar space.
  (b) Rest-after gap pushed them past their original deadline.
  (c) Study frequency spacing reduced available slots.

RECOVERY PASS:

  REPEAT up to (Total Unplaced Sessions + 1) times:

    Find CANDIDATES — topics that are:
      ✓ Still have sessions remaining
      ✓ Not oversized (user chose not to fix oversized issue)
      ✓ All prerequisites met
      ✓ The reason they weren't placed is provably a scheduling
        bottleneck, NOT "there was never enough time in the first place"
        (i.e., at least one predecessor in the same subject IS completed,
         OR the topic is in Parallel mode but ran out of daily slots)

    Are there zero candidates? → STOP.

    Sort candidates by:
      (Remaining Sessions ÷ Total Sessions) DESC  ← most behind first
      Then by priority (High → Low)

    For each candidate, scan days from study_start to global_deadline:
      ├── Skip if day capacity < session_length
      ├── Skip if day is before earliest_start
      ├── Skip if rest-after gap from predecessor not elapsed
      ├── NO DEADLINE CHECK here (deadline is relaxed for overflow)
      └── Place session, subtract from day's remaining capacity.

    If ANY session placed → loop again.
    If NONE placed in full pass → STOP.

  Report: X sessions rescued via overflow recovery.
```

---

## STAGE 8 — FINAL SORT & ENRICHMENT

```
All placed sessions sorted by:
  1. Date ASC (earliest first)
  2. User's priority stack top criterion (e.g., urgency DESC)
  3. Subject entry order (stable tie-breaker)

Session metadata enriched with:
  - session_number / total_sessions ("Session 3 of 10")
  - is_flex_day: boolean (was this day's capacity extended?)
  - flex_extra_minutes: how much extra was used
  - topic_completion_after: "After this session, topic is 70% done"
  - is_topic_final_session: boolean (useful for UI celebration)
```

---

## STAGE 9 — PLAN PREVIEW & INTERACTIVE EDITING (NEW — Major Upgrade)

> *"The old preview was read-only with limited delete. The new preview
>  is a fully interactive editing surface."*

### 9.1 — What the Student Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  PLAN PREVIEW — a calendar-style view of the generated schedule    │
│                                                                     │
│  Each day shows:                                                    │
│    [Subject A – Topic X (3/10)] [60 min] ⚡                        │
│    [Subject B – Topic Y (1/5)]  [45 min]                           │
│    Day total: 1h 45m / 2h capacity                                 │
│                                                                     │
│  Color-coded by subject. ⚡ = flex day.                             │
│  Sessions with is_topic_final_session get a 🎯 marker.            │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 — What the Student Can DO (Post-Generation Editing)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ACTION: DELETE SESSION                                             │
│    Click ✕ on any session → removed from preview.                  │
│    Remaining sessions for that topic re-number automatically.      │
│    Feasibility bar updates instantly.                               │
│                                                                     │
│  ACTION: MOVE SESSION (drag-and-drop)                               │
│    Drag a session from Day X to Day Y.                              │
│    If Day Y has capacity → session moves.                          │
│    If Day Y is full → prompt: "Day Y is full. Use flex? [Yes/No]" │
│                                                                     │
│  ACTION: PIN SESSION (NEW)                                          │
│    Right-click → "Pin this session"                                │
│    Pinned sessions are LOCKED to their date. If the student        │
│    re-generates the plan later, pinned sessions stay put.          │
│    Use case: "I know I'll study Calculus on March 15 because       │
│    my tutor is available that day."                                 │
│                                                                     │
│  ACTION: ADD REST DAY (NEW)                                         │
│    Click on a day → "Mark as rest day"                              │
│    All sessions on that day are redistributed to surrounding days. │
│    Day is added to off-days for future regenerations.              │
│                                                                     │
│  ACTION: SWAP SESSIONS (NEW)                                        │
│    Select two sessions → "Swap these"                              │
│    Sessions exchange dates. Capacity validated for both days.      │
│                                                                     │
│  ACTION: ADD MANUAL SESSION (NEW)                                   │
│    Click "+" on any day → pick a subject/topic → add a session.   │
│    This becomes a pinned session. Useful for one-off study plans.  │
│                                                                     │
│  ACTION: REGENERATE AROUND EDITS (NEW)                              │
│    After making manual edits, click "Re-optimize remaining"        │
│    → Pinned/moved sessions stay. Unmodified sessions are           │
│      re-scheduled optimally around the fixed ones.                 │
│    → This is a partial regeneration, not a full redo.              │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 — Plan Analysis (shown alongside the preview)

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 PLAN ANALYSIS                                                   │
│                                                                     │
│  ├── Total: 85 sessions across 42 days (127.5 hours)               │
│  ├── Subjects: 5  |  Topics: 14                                    │
│  ├── Fit: ✅ Relaxed (12% buffer remaining)                        │
│  │   — or —                                                         │
│  ├── Fit: ⚡ Snug (3 days need extra 15-30 minutes)                │
│  │                                                                  │
│  ├── Load Distribution:                                             │
│  │     Lightest day: Mon Feb 3 (1h)                                │
│  │     Heaviest day: Sat Feb 8 (3h)                                │
│  │     Std deviation: 0.4h (very even) — or — 1.2h (uneven)       │
│  │                                                                  │
│  ├── Topic Completion Timeline:                                     │
│  │     Calculus:    Feb 1 ──████████── Feb 14 ✅                   │
│  │     Algebra:     Feb 15 ──██████── Feb 25 ✅                    │
│  │     Statistics:  Feb 26 ──████── Mar 5 ✅                       │
│  │     (visual timeline bars showing when each topic runs)         │
│  │                                                                  │
│  ├── Dropped Sessions (if any):                                     │
│  │     ⚠️ 3 sessions of "Organic Chemistry" could not be placed   │
│  │     Reason: deadline March 10, but capacity exhausted by Mar 8  │
│  │     [🔧 Extend deadline] [🔧 Reduce effort] [✏️ Edit]          │
│  │                                                                  │
│  └── Warnings:                                                      │
│        ⚠️ No rest days between "Calculus" ending and "Algebra"     │
│           starting — consider adding a 1-day gap.                  │
│           [Add gap]                                                 │
│        ⚠️ Wednesday has 0 study sessions every week — intended?    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## STAGE 10 — OUTCOMES (What Can Happen)

```
generatePlan() outcome tree:

  Zero topics with effort > 0?
  └──► Status: NO_UNITS
       Show: "Add topics and set study hours" with link to Phase 1.
       DO NOT silently return empty.

  No usable days in planning window?
  └──► Status: NO_DAYS
       Show: "All days are marked as off or have 0 capacity."
       [🔧 Quick fix: set weekday capacity to 2h]

  Schedule is empty + not feasible?
  └──► Status: INFEASIBLE
       Show: Fix-It Panel (Stage 5.5) with all problems + suggestions.
       Also show: best-effort partial schedule (so user can see
       which topics DO fit and which don't).

  Schedule partially filled (some sessions dropped)?
  └──► Status: PARTIAL
       Show: full schedule + explicit list of dropped sessions.
       Show: Fix-It Panel for dropped topics only.

  Everything fits?
  └──► Status: READY
       Show: full schedule + analysis + editing tools.

  In ALL non-empty cases: the schedule is returned with the feasibility
  report. The student always sees something actionable.
```

---

## STAGE 11 — COMMITTING (Saving the Plan)

```
Student reviews the plan preview. Makes any edits (move, pin, delete, add).

Choose how to handle OLD plan tasks:

  ┌────────────────────────────────────────────────────────────────┐
  │  "Fresh Start"  → Delete ALL old generated tasks.              │
  │                    New plan is the only plan.                   │
  │                                                                │
  │  "Keep Past"    → Keep completed tasks and tasks before        │
  │                    today. Delete only future generated tasks.   │
  │                    (Preserves your history.)                    │
  │                                                                │
  │  "Merge"  (NEW) → Keep ALL existing tasks. Add new sessions   │
  │                    only for topics/dates where no task exists.  │
  │                    (Useful for partial re-plans.)               │
  └────────────────────────────────────────────────────────────────┘

Then:
  1. Delete old tasks per chosen mode.
  2. Insert all new sessions as tasks (pinned sessions marked accordingly).
  3. Save a snapshot (plan_version) with full schedule + config + edits.
  4. Calendar and dashboard automatically refresh.
  5. Show success confirmation with summary:
     "Created 85 tasks across 42 days. 3 pinned sessions preserved."
```

---

## STAGE 12 — RESCHEDULE MISSED (Emergency Recovery — Improved)

> *"You fell behind. This rescues your incomplete sessions intelligently."*

```
1. Find ALL incomplete generated tasks (past + future).
   Sort by: priority (High first), then scheduled date ASC.

2. Build available calendar from TODAY → Global Deadline.
   (Same capacity rules as normal scheduling.)

3. Reserve time already taken by:
   - Manual tasks (not generated by planner)
   - Completed sessions
   - PINNED sessions (these don't move)

4. SMART RE-PLACEMENT (improved over greedy first-fit):
   - Group missed tasks by subject.
   - Re-run a mini scheduling pass (Stage 6 logic) on only the
     missed tasks, respecting:
     ✓ Topic ordering mode (sequential/parallel/etc.)
     ✓ Rest-after gaps
     ✓ Subject gap rules
     ✓ Study frequency preferences
     ✓ Focus depth limits
   - This produces a better schedule than blind first-fit.

5. Delete old incomplete generated tasks.
6. Insert newly placed tasks.
7. Report:
   ├── X sessions rescheduled successfully
   ├── Y sessions could not fit (with reasons: "no capacity" / "past deadline")
   ├── Z completed sessions kept in place
   └── Suggestions if sessions couldn't fit:
       [🔧 Extend global deadline by 3 days]
       [🔧 Increase daily capacity by 30 min]
       [🔧 Drop 2 low-priority sessions]
```

---

## DECISION MAP — EVERY POSSIBLE PATH

```
Student enters the Planner
│
├─► Phase 1: Structure
│     Build subjects → topics → subtopics
│     Set ordering mode per subject (sequential/flexible/parallel/custom)
│     Cycle detection prevents impossible dependency chains
│     │
│     Live health bar starts updating once any effort is entered ↓
│
├─► Phase 2: Parameters
│     Set effort, priority, session length, dependencies, rest gaps, etc.
│     Per-topic feasibility dots appear as parameters are filled
│     Duplicates/cycles/invalid values blocked at input time
│
├─► Phase 3: Constraints
│     Set planning window, day capacities, focus depth, ordering stack
│     Mini calendar for off-days and custom capacity days
│     Live health bar now fully accurate
│     │
│     Problems detected?
│     ├── YES → Fix-It Panel shown. Student can:
│     │           [Auto-fix] → values updated, panel closes
│     │           [Edit manually] → inline editing, re-check
│     │           [Ignore & Generate Anyway] → student accepts partial plan
│     └── NO  → "Generate Plan" button enabled
│
├─► Phase 4: Generation
│     Build calendar of usable days
│     Apply capacity strategy (relaxed / snug / overloaded)
│     Run main day loop with full constraint set
│     Run overflow recovery
│     Sort + enrich sessions
│     │
│     Result:
│     ├── NO_UNITS  → Redirect to Phase 1 with message
│     ├── NO_DAYS   → Redirect to Phase 3 with fix suggestions
│     ├── INFEASIBLE → Show Fix-It Panel + best-effort partial schedule
│     ├── PARTIAL    → Show schedule + dropped sessions + targeted fixes
│     └── READY      → Show full schedule + analysis
│
├─► Phase 5: Preview & Edit
│     Student reviews, moves, pins, deletes, adds, swaps sessions
│     Can "Re-optimize remaining" to re-schedule around fixed edits
│     Plan analysis shown alongside
│
├─► Phase 6: Commit
│     Choose keep mode (Fresh / Keep Past / Merge)
│     Plan written to DB
│     Dashboard + Calendar refresh
│
└─► Post-Commit:
      Student can always:
        → Reschedule Missed (emergency recovery)
        → Re-enter planner to adjust and re-commit
        → Pin completed work so it persists across re-generations
```

---
---

## APPENDIX: NEW FEATURES & LOGIC WE SHOULD ADD

> *Features and ideas that will make this planner truly student-first.
> Ordered by impact (highest first).*

### A — HIGH IMPACT (should build)

1. **Topic Ordering Modes (Sequential / Flexible / Parallel / Custom Tiers)**
   - This is the single biggest gap. Every student thinks differently about topic order.
   - A Biology student may want Cells → Genetics → Evolution strictly sequential.
   - A History student may want Ancient Rome and Ancient Greece in parallel.
   - Currently we force sequential on everyone. This must change.

2. **Rest-After-Topic Gap**
   - Students need mental breaks between finishing one topic and starting the next.
   - "I just finished 10 sessions of Calculus. Don't throw Algebra at me the next morning."
   - Simple 0-2 day cooldown per topic. Huge quality-of-life improvement.

3. **Per-Day-of-Week Capacity Overrides + Mini Calendar**
   - "I have club on Wednesdays, can only study 30 min." Currently impossible to express.
   - The mini calendar with click-to-toggle off-days and custom hours makes this visual and easy.

4. **Plan Order Priority Stack (drag-to-rank criteria)**
   - Replaces the rigid 4-radio-button approach. Students think in combinations:
     "Deadlines first, but break ties by priority." This is that.

5. **Interactive Plan Editing (Pin, Move, Swap, Add, Delete)**
   - After generation, the student currently has almost no control. This is the #1 complaint.
   - Pin = "keep this session no matter what." Move = "I want to study this on Saturday instead."
   - Re-optimize around edits = best of both worlds (manual + algorithmic).

6. **Live Feasibility Bar + Fix-It Panel**
   - Problems should never be a surprise at the end. Catch them as the student types.
   - Auto-fix buttons eliminate the "okay, now what?" moment when something is impossible.

7. **Study Frequency Preferences (daily / spaced / dense)**
   - Some students want distributed practice (every other day) for retention.
   - Others want to power through a topic in 3 concentrated days.
   - An easy hint system that the scheduler respects when time allows.

### B — MEDIUM IMPACT (should consider)

8. **Session Gap / Break Time Between Sessions**
   - "Don't schedule sessions back-to-back, I need a 15-min break."
   - Simple configuration, accounts for real human needs.

9. **Max Sessions Per Day Per Topic**
   - "Don't make me do 4 sessions of Organic Chemistry in one day."
   - Prevents topic fatigue. Currently no per-topic daily limit exists.

10. **Min Gap Between Same Subject Days (Anti-Fatigue)**
    - "Don't schedule Maths every single day, alternate it."
    - Spacing improves retention and prevents burnout.

11. **Merge Commit Mode**
    - "I already manually moved some tasks around. Don't delete everything, just fill in gaps."
    - Respects the student's manual work. Currently: any recommit wipes generated tasks.

12. **Partial Re-Generation (around pinned sessions)**
    - Student pins 5 sessions → clicks regenerate → only unpinned sessions are rescheduled.
    - Preserves intentional manual overrides.

13. **Topic Completion Timeline (Visual Gantt-ish Bars)**
    - Show when each topic starts and ends as colored bars on a timeline.
    - Instant visual understanding of the plan shape.

14. **Flexibility Allowance (replaces Buffer %)**
    - "I'm okay studying 30 extra minutes some days if needed."
    - More intuitive than "10% buffer" which nobody understands intuitively.

### C — NICE TO HAVE (future iterations)

15. **Energy-Level Tagging**
    - Tag topics as "High Energy" (Calculus) or "Low Energy" (Reading).
    - Tag days/times as "High Energy" (morning) or "Low Energy" (evening).
    - Scheduler matches: hard topics on high-energy days.

16. **Weekly Pattern Templates**
    - "Every week should look roughly like: Mon=Maths, Tue=Physics, Wed=off, Thu=Maths..."
    - Student sets a template. Scheduler fills in specific sessions.

17. **Progress-Adaptive Rescheduling**
    - After a week of actual studying, compare plan vs reality.
    - "You're 2 sessions behind in Physics. Want to auto-adjust the rest of the plan?"
    - Continuous plan refinement, not just one-shot generation.

18. **Exam/Deadline Countdown Mode**
    - Switch to intensive mode in final 7 days: higher capacity, priority-only topics.
    - Show a special "crunch time" view with countdown and focus recommendations.

19. **Subject Affinity Grouping**
    - "Don't schedule Physics and Maths on the same day — they're both heavy."
    - "Schedule French and Spanish together — they pair well."
    - Student defines subject compatibility; scheduler respects it.

20. **Plan Comparison**
    - Generate 2-3 alternative plans with different strategies.
    - "Plan A: Balanced across all days. Plan B: Front-loaded deadlines. Plan C: Subject blocks."
    - Student picks the one that looks best.

21. **Recurring Off-Day Patterns**
    - "Every Wednesday is off" should be a single toggle, not clicking 12 Wednesdays.
    - "First Saturday of every month is off." Pattern-based off-days.

22. **Session Time-of-Day Preferences**
    - "I prefer studying Maths in the morning and History in the evening."
    - Not strict scheduling by hour (too complex), but ordering within a day.
