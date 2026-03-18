# Planner Logic Guide (Human, Non-Technical)

Last updated: March 18, 2026

This document explains exactly how the planner works in simple language.
It is meant for product review, UX review, and day-to-day understanding.
No coding knowledge is required.

---

## 1) What This Planner Is Trying To Do

The planner takes your syllabus + your available time + your rules and turns them into day-wise study sessions.

Its core promise is:

- It should respect your real calendar limits.
- It should avoid nonsense schedules (like putting work on blocked days).
- It should warn you early when the plan cannot fully fit.
- It should block final commit when critical problems still exist.

---

## 2) End-to-End Flow (Big Picture)

```text
Phase 1: Build structure (subjects -> topics)
  -> Phase 2: Set topic parameters (hours, deadlines, dependencies, session length, etc.)
  -> Phase 3: Set global constraints (dates, capacity, off-days, ordering, limits)
  -> Generate plan
      -> Feasibility check
      -> Session placement
      -> Output state (READY / PARTIAL / INFEASIBLE / NO_DAYS / NO_UNITS)
  -> Issue window check (critical/warning issues)
      -> If critical issues exist -> commit stays blocked
      -> If only warnings -> continue allowed
  -> Phase 4: Preview and edit plan
      -> drag, move, pin, swap, delete, manual add
      -> optional re-optimize around pinned/manual sessions
  -> Phase 5: Commit plan (choose keep mode)
  -> Plan snapshot saved + dashboard/calendar refreshed
```

---

## 3) What The User Sets In Each Phase

## Phase 1: Structure

You define:

- Subjects
- Topics inside each subject
- Topic order inside each subject

What the system enforces:

- Duplicate topic names inside the same subject are rejected.
- Topic and subject order can be rearranged and saved.

---

## Phase 2: Topic Parameters

For each topic, the user can define:

- Estimated effort (hours)
- Session length
- Topic deadline
- Earliest start date
- Dependency on another topic
- Rest-after days
- Max sessions/day for that topic
- Study frequency (daily or spaced)

What the system enforces:

- Session length cannot be below minimum.
- Session length cannot exceed maximum.
- Dependency loops are rejected before saving.
  - Example loop: A depends on B, B depends on A.

---

## Phase 3: Global Constraints

You define the planning environment:

- Study start date
- End deadline (exam date)
- Weekday capacity
- Weekend capacity
- Day-of-week overrides
- Date-specific custom capacities
- Off-days
- Plan order preference stack
- Flexibility allowance (extra minutes allowed if needed)
- Max daily ceiling
- Max active subjects/day
- Max topics per subject per day
- Subject ordering mode

What the system enforces:

- Start date must be before end date.
- Capacities cannot be negative.
- Invalid order mode is rejected.
- Values are clamped into safe ranges where needed.

---

## 4) How The Planner Builds Usable Study Days

```text
For each date from Start -> End:
  Is date off-day?
    -> yes: skip
    -> no:
       Capacity source priority:
       1) custom date capacity
       2) day-of-week override
       3) weekday/weekend default

       If base capacity = 0
         -> blocked day (stays blocked, even with flexibility)
       Else
         -> day is usable
            base capacity stored
            flex ceiling stored (base + flexibility, capped by max daily ceiling)
```

Important rule:

- A day explicitly set to zero is always blocked.
- Flex minutes never unlock a blocked day.

---

## 5) Feasibility Check (Before/Alongside Scheduling)

The planner asks two questions:

1. Topic-level: "Can each topic fit its own time window?"
2. Global-level: "Can all required sessions fit total available time?"

Topic health levels:

- safe
- tight
- at_risk
- impossible

Global result types:

- feasible: everything fits in base capacity
- flexFeasible: base is short, but flexibility closes the gap
- infeasible: still short even after flexibility, or impossible topics exist

```text
Topic check:
required minutes in topic window
  -> compare against available minutes in that topic window
  -> assign health level

Global check:
sum(all required minutes)
  -> compare against sum(all day capacities)
  -> add suggestions when short
```

---

## 6) Session Placement Logic (How The Calendar Is Filled)

The scheduler fills days with sessions using practical rules.

## 6.1 Pre-cleanup and safety

Before placing sessions, it cleans input:

- Removes duplicate topic IDs (keeps one)
- Removes invalid dependency references
- Handles self-dependency as invalid loop
- If circular dependency remains -> no schedule

## 6.2 Ordering and unlocking

Topic availability depends on:

- Earliest start reached
- Deadline not passed
- Dependencies complete
- Subject ordering mode

Subject ordering modes:

- sequential: next topic starts only after previous is done
- flexible_sequential: next topic can unlock early when progress is high enough
- parallel: multiple topics can run in same subject

Flexible unlock threshold is adaptive by pressure:

- High pressure -> unlock earlier
- Medium pressure -> moderate unlock
- Low pressure -> unlock later

## 6.3 Daily placement behavior

```text
For each usable day:
  -> find active topics
  -> rank by order stack (urgency, deadline, priority, etc.)
  -> apply focus depth limits
  -> place sessions in rounds across subjects
  -> respect per-topic and per-day limits
  -> consume base first, then flex minutes if needed
```

Additional balancing rules:

- Subject gap can be enforced between same-subject days.
- Urgent near-deadline subjects can bypass normal focus limits.
- Same topic can be spaced if frequency is spaced.
- Max daily minutes is a hard cap.

## 6.4 Overflow pass

After normal pass, scheduler tries another pass for delayed topics.

Current safety rule:

- Overflow pass does **not** place sessions after topic deadline.

This prevents "late hidden spill" behavior.

---

## 7) Planner Output States (And What They Mean)

```text
NO_UNITS
  -> nothing with real effort to plan

NO_DAYS
  -> there are no usable days in the configured window

INFEASIBLE
  -> planner cannot place sessions and feasibility says impossible

PARTIAL
  -> planner placed some sessions, but not all required sessions

READY
  -> planner generated a usable schedule
     (can still carry warnings like flex-heavy pressure)
```

How UI reacts:

- READY/PARTIAL -> opens preview phase
- INFEASIBLE/NO_DAYS -> keeps user in constraints/problem-fix path
- Critical issues -> issue window opens, commit blocked

---

## 8) Issue Window Logic (Critical vs Warning)

Issue window is generated from plan status + feasibility + schedule shape.

Rule:

- critical issue exists -> commit locked
- only warnings/info -> commit allowed

Current issue catalog:

## Critical

- no-usable-days
  - No valid day remains after date/capacity/off-day rules
- unscheduled-sessions
  - Some required sessions are missing from output
- topic-window-impossible
  - One or more topics cannot fit before their deadline
- late-sessions
  - Session appears after its topic deadline

## Warning

- flex-heavy
  - Plan fits only because extra flexibility minutes are used
- load-volatility
  - Day-to-day load is too uneven

Issue actions include:

- Jump to exact phase to fix
- Add minutes to weekday/weekend
- Extend deadline by quick delta
- Re-check after adjustments

---

## 9) Phase 4 Preview Editing Rules

Preview is not read-only. User can modify before commit.

Supported actions:

- Move session to another day (drag/drop)
- Pin/unpin session
- Swap two sessions
- Delete a session
- Add manual session

Pinned/manual behavior:

- Manual and pinned sessions are treated as fixed anchors.
- Re-optimize keeps those anchors and rebuilds the rest around them.

Re-optimize output:

- Returns updated schedule
- Reports dropped count if some sessions still cannot be placed
- Can reopen issue window if critical issues still exist

---

## 10) Phase 5 Commit Logic

Commit does not directly do row-by-row ad-hoc writes.
It calls an atomic commit function and records a snapshot.

```text
Commit button
  -> critical issue check
      -> critical found: blocked
      -> no critical: continue
  -> choose keep mode
  -> commit atomic
  -> save snapshot
  -> refresh planner/dashboard/calendar
```

Keep modes:

- future (default): replace generated future work
- until: keep work before new plan start
- merge: keep existing work and add new
- none: full replacement

---

## 11) Missed-Work Recovery (Reschedule Missed Plan)

Used when generated tasks are pending and need redistribution.

```text
Load pending generated unfinished tasks
  -> if none: NO_PLAN_TASKS
Load capacity, constraints, off-days
  -> if no usable capacity: NO_CAPACITY
Reserve already-used time (manual + completed)
Rebuild pending sessions with current rules
  -> preserve dependency ordering
  -> produce dropped reasons if not all can fit
Delete old pending generated tasks
Insert new redistributed tasks
Save snapshot
```

Possible outcomes:

- UNAUTHORIZED
- NO_PLAN_TASKS
- NO_CAPACITY
- ERROR
- SUCCESS (with moved count, unscheduled count, dropped reasons)

---

## 12) Full Edge-Case Catalog (Current Behavior)

This section is intentionally exhaustive and human-readable.

## A) Structure and parameter validation

- Empty/duplicate topic names inside same subject -> rejected
- Session length below minimum -> rejected
- Session length above maximum -> rejected
- Dependency cycle -> rejected before writing
- Unauthorized user -> operation blocked

## B) Calendar and capacity edges

- All days off -> no schedule
- Day-of-week override applies when set
- Custom date override has highest priority
- Zero-capacity day remains blocked, even with flexibility
- Max daily ceiling always enforced
- Flex only extends allowed days; it does not create new days

## C) Scheduling edges

- Empty topic list -> empty schedule
- Zero-effort topic -> skipped
- Duplicate topic IDs in input -> deduplicated
- Orphan dependency (missing referenced topic) -> cleaned gracefully
- Self-dependency -> treated as loop -> no schedule
- Circular dependencies -> no schedule
- Sessions never placed before earliest start
- Sessions never placed after topic deadline
- Overflow pass also respects topic deadline
- Per-day capacity never exceeded
- Session too long for any day -> that work remains unscheduled
- Sequential order inside subject is respected
- Later topic cannot start while earlier one is blocked
- Phase-1 topic order remains stable even under deadline pressure
- Multi-subject plans interleave day by day
- Rest-after delays starting new topic
- Already-started topic can continue during rest block
- Max sessions per day per topic is respected
- Spaced frequency leaves day gaps between same-topic sessions
- Legacy dense input is treated as normal daily behavior
- Parallel mode allows side-by-side topics
- Flexible mode unlocks next topic early based on pressure
- Adaptive threshold changes with pressure level
- Legacy tier field is ignored (sequential flow remains)
- Subject-gap rule can separate same-subject days
- Max topics-per-subject-per-day is enforced
- Priority criterion can affect ranking when different priorities exist
- Reserved time blocks are respected before placing free sessions

## D) Plan-level output edges

- NO_UNITS when nothing is plannable
- NO_DAYS when no usable calendar days exist
- INFEASIBLE when no viable placement and feasibility fails
- PARTIAL when some sessions placed but full coverage not possible
- READY when schedule exists and planner can continue
- READY can still include warning-level pressure (for example flex-heavy)

## E) Issue-window edges

- Critical issues lock commit
- Warning/info issues do not lock commit
- Issues are re-computed whenever constraints/sessions/feasibility change
- Re-check can reopen issue window if still critical

## F) Commit and recovery edges

- Commit blocked for unauthorized user
- Commit blocked if critical issues remain
- Commit supports multiple keep strategies
- Missed-work recovery can return NO_CAPACITY
- Missed-work recovery can return dropped reasons
- Missed-work recovery preserves dependency order while rebuilding

---

## 13) Human Summary

```text
You define what to study + how much time you have
  -> planner checks if it can fit
  -> planner builds the best valid schedule it can
  -> planner clearly marks what could not fit and why
  -> issue window tells you exactly what to fix
  -> you can edit preview manually
  -> commit only after critical blockers are resolved
```

That is the current planning logic in plain language, including flow states and real edge behaviors.
