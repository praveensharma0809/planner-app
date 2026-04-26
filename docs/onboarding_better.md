# Onboarding & First-Time User Retention — Strategy Document

## The Problem

Users complete onboarding, land on the **Subjects page** (`/dashboard/subjects`), and immediately churn. They feel lost, confused, and see a cold 3-column layout with no content. The onboarding hype ("Your System Is Ready To Run") creates an expectation that is shattered by an empty screen demanding more setup.

**Churn point:** `Finish onboarding → /dashboard/subjects → closed within seconds`

---

## Root Cause Analysis

### 1. Expectation-Reality Gap (CRITICAL)

| Onboarding says | User sees |
|---|---|
| "Setup is complete" | Empty 3-column data table |
| "Your System Is Ready To Run" | "No subjects yet. Create your first subject to start building your structure." |
| Celebration animation (rings + checkmark) | Void |

The emotional whiplash is devastating. The onboarding ends on a high note, then drops the user into an empty UI that demands more work. This violates the **Peak-End Rule** (Kahneman) — users remember the ending most strongly, and ours is a letdown.

### 2. Cognitive Overload on First Screen

The Subjects page exposes **three side-by-side columns** (Subject → Chapter → Task), a sidebar with 5 navigation items, archive controls, manage mode, bulk task creation, and drag-and-drop — all at once. A new user has zero mental models for this hierarchy.

**Hick's Law:** Decision time increases logarithmically with the number of choices. Five nav items × three columns = paralysis.

### 3. No Clear Call-to-Action

The "Add Subject" button is just one of several small buttons at the bottom of column 1, competing with "Archive Subject" and "Archived Subjects (0)". Nothing visually says _"START HERE."_

### 4. Onboarding Slides Are Too Fast

The Subjects guided flow has **11 slides auto-advancing at 1.7 seconds each** (~19 seconds total). Users cannot absorb a 3-level hierarchy in 19 seconds of rapid-fire screenshots.

### 5. Tutorial Button Is Hidden

A small ghost "Tutorial" button in the top-right corner is invisible to a confused user. If they need help, they won't find it.

### 6. No Progressive Disclosure

Archive, bulk series, manage mode, drag-and-drop reordering — all visible on the first visit. A first-time user should not see any of this.

---

## Phase 1: Fix the Landing Destination (CRITICAL — Implement First)

### Strategy: Redirect to Dashboard, not Subjects

**What big companies do:**
- Notion drops new users into a **pre-built Getting Started page** with sample content and clear CTAs
- Linear opens with a **single project already created**, with sample issues that demonstrate the workflow
- Duolingo lands users on the **home screen with only one lesson unlocked** — every other feature is locked until progress is made
- Superhuman uses a **"concierge onboarding"** where the first screen already has a real email ready to triage

**Our move:** Change `handleFinish` to redirect to `/dashboard` instead of `/dashboard/subjects`.

**Why Dashboard works as a first screen:**

1. **Warm, personalized greeting** — "Good morning / Good afternoon" sets a human tone
2. **Single focus area** — "Today's Progress" hero card is the only thing to look at
3. **Clear empty state** — "No tasks yet" with a prominent "New Plan" CTA button
4. **Low cognitive load** — No 3-level hierarchy to parse, just a simple overview
5. **Sidebar remains visible** — Users still see all destinations, so they're not blocked from exploring

**Changes:**
```
File: app/components/onboarding/TutorialWizard.tsx
Line 448-451: router.push("/dashboard/subjects") → router.push("/dashboard")
Line 744: "Go to Subjects" → "Go to Dashboard"
```

### Dashboard Empty State Enhancement

The Dashboard empty state should guide the user to their very first action. Current copy is adequate but can be warmer and more directive.

**Current (line 267):**
> "Generate a plan or use quick add when you're ready."

**Proposed (line 336):**
> "Tap **New Plan** to generate your first study schedule — it only takes a minute"

This creates a **single, unambiguous next action** and sets a time expectation ("only takes a minute") which reduces perceived effort.

---

## Phase 2: Progressive Disclosure on Subjects Page

### Strategy: Only Show What's Immediately Actionable

**What big companies do:**
- Figma shows an empty canvas with a **single centered "Create new file" prompt** — no panels, no layers, no tools until you have a file
- Linear's first view is a **single list of issues**, not split-panes — the detail pane opens only when you click an issue
- Arc Browser opens with a **single search/URL bar** — no tabs, no spaces, no split view until content exists
- Loom shows **only the record button** on first launch — editing, library, and sharing features appear only after a recording exists

**The pattern:** _Don't show the tool; show the first action. Reveal complexity only when data exists to justify it._

### Specific Changes to `/dashboard/subjects`

**When `displaySubjects.length === 0` (empty state):**

Replace the 3-column layout with a **single centered welcome card:**

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   [Study plan illustration or icon]              │
│                                                  │
│   Let's build your study plan                    │
│                                                  │
│   Start by creating your first subject — it's    │
│   the foundation of your entire study system.    │
│   Think of a subject as a folder for one exam    │
│   or course you're preparing for.                │
│                                                  │
│   How it works:                                  │
│                                                  │
│   ①  Create a Subject                            │
│      (e.g. "JEE Mathematics")                    │
│                                                  │
│   ②  Add Chapters inside it                      │
│      (e.g. "Calculus", "Algebra", "Trigonometry")│
│                                                  │
│   ③  Add Tasks to each Chapter                   │
│      (e.g. "Solve 10 integration problems")      │
│                                                  │
│          ┌──────────────────────────────┐        │
│          │  ✦  Create Your First Subject  │      │
│          └──────────────────────────────┘        │
│                                                  │
│   Takes less than 30 seconds.                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Key design principles:**
1. The CTA button is **the only colored/primary element** on the page — everything else is muted
2. The 1-2-3 guide provides a **mental map** before asking for commitment
3. A concrete example ("JEE Mathematics") helps users who struggle with blank-slate problem
4. "Takes less than 30 seconds" reduces perceived effort
5. The Chapters and Task columns are **not rendered at all** when subjects.length === 0

**After the first subject is created:**
- Show columns 1 and 2 (Subjects + Chapters)
- Column 3 (Tasks) shows "Select a chapter to add tasks" until a chapter is selected
- Archive controls remain visible (they're low-priority and non-distracting)

**When 1+ tasks exist in a chapter:**
- Full 3-column layout becomes available
- "Manage" mode, bulk creation become relevant

**Page header enhancement:**
```tsx
<PageHeader
  title="Subjects"
  subtitle="The foundation of your study system — organize what you're learning"
  actions={
    <FlowTutorialButton ... buttonLabel="Need help?" />
  }
/>
```

---

## Phase 3: Slow Down Onboarding Slides

### Strategy: Respect the User's Processing Time

**What big companies do:**
- Apple's product onboarding uses **manually advanced slides** (user taps "Continue") — never auto-advance for instructional content
- Duolingo onboarding uses **interactive micro-lessons** — the user must complete each step before advancing
- Linear's onboarding is **interactive and task-based** — you create a real issue, not watch a slideshow
- Notion's tutorials are **click-through popovers** that appear contextually — not a pre-game slideshow

**The problem with our auto-advance:** 1.7 seconds per slide with 11 slides. That's 19 seconds to teach a 3-level hierarchy with screenshots. No human can process this.

### Specific Changes

```
File: app/components/onboarding/TutorialWizard.tsx
Line 209: GUIDED_FLOW_INTERVAL_MS = 1700 → 4000

File: app/components/onboarding/FlowTutorialButton.tsx
Line 9: AUTOPLAY_INTERVAL_MS = 1700 → 4000
```

**4 seconds per slide** is the minimum for users to:
1. Read the slide title
2. Scan the description
3. Register the screenshot
4. Map it to their mental model

### Future Enhancement (not part of this phase):
Consider making the guided flow **manually advanced** with a prominent "Next" button, rather than auto-playing. The trade-off is that manual advancement requires user effort, but it ensures they've actually absorbed each step. Duolingo and Linear both use interruptive, task-completion-based advancement successfully.

---

## Phase 4: Improve Empty-State Copy Everywhere

### Strategy: Speak Like a Human, Show the Value

**What big companies do:**
- Loom: "Record your first video — it's free and takes 30 seconds"
- Linear: "Create your first issue" (not "No issues have been created yet")
- Notion: Empty page says "Press / for commands" with a live command palette — it's an invitation, not a status report
- Figma: Empty canvas has a T-board with 3 starter templates and "Import file" — multiple paths, no blank slate anxiety

**The pattern:** Empty states should be **invitations to act**, not **status reports of emptiness.**

### Copy Changes

**Subjects empty state** (`subjects-data-table.tsx`, ~line 1102):
```
BEFORE: "Create your first subject to start building your structure."
AFTER:  "Each subject is like a folder for one exam or course you're preparing for — add one to begin."
```

**Subjects detail panel empty** (`subjects-data-table.tsx`, ~line 1308):
```
BEFORE: "No tasks in this view yet."
AFTER:  "No tasks yet — click Add Task to start filling this chapter."
```

**Dashboard empty state** (`dashboard/page.tsx`, ~line 336):
```
BEFORE: "Start by generating a plan or using quick add above"
AFTER:  "Tap New Plan to generate your first study schedule — it only takes a minute."
```

**Dashboard no-subjects sidebar** (`dashboard/page.tsx`, ~line 518):
```
BEFORE: "No subjects" / "Add subjects to start tracking progress"
AFTER:  "No subjects yet" / "Create your first subject to see your progress here"
```

---

## Industry Best Practices We're Adopting

### 1. The "Aha Moment" Must Happen Fast

Facebook found that users who added **7 friends in 10 days** were retained. For Dropbox, it was **uploading 1 file**. For Slack, it was **2,000 messages sent**.

**Our Aha Moment:** User creates 1 subject, adds 1 chapter, adds 1 task, and sees it generate a study plan. We must get them there in under 2 minutes.

**How we enable this:** Phase 1 (redirect to Dashboard) puts the "New Plan" button front and center. Phase 2 makes Subjects creation dead-simple. Together, they should collapse time-to-value.

### 2. Progressive Disclosure (Nielsen Norman Group)

> "Show only what is necessary for the current step. Reveal complexity as the user demonstrates readiness."

Applied: Hide empty columns, hide archive controls, hide manage mode until relevant data exists. The first screen should have exactly **one** thing to do.

### 3. Von Restorff Effect (Isolation Effect)

> "When multiple similar objects are present, the one that differs from the rest is most likely to be remembered."

Applied: The primary CTA ("Create Your First Subject" / "New Plan") must be the **only visually distinctive element** on the empty state. Everything else should be visually muted.

### 4. The Zeigarnik Effect

> "People remember uncompleted or interrupted tasks better than completed ones."

Applied: Show a **progress indicator** once the user starts — "1/3 subjects created", "2/5 tasks added" — so they feel compelled to finish. Not implemented in this phase, but should be planned for a follow-up.

### 5. The Peak-End Rule (Kahneman)

> "People judge an experience based on how they felt at its peak and at its end, not the sum of every moment."

Applied: The onboarding must end on a **real, tangible win** — not a slideshow saying "you're ready." The Dashboard delivers this: a warm greeting, a personal progress card, and a clear next step.

### 6. Hick's Law

> "The time it takes to make a decision increases with the number and complexity of choices."

Applied: Phase 2 reduces the first-screen decision from "5 nav items × 3 columns × 6 buttons × bulk/single toggle × manage mode × DnD" to "1 button: Create Your First Subject."

---

## Success Metrics to Track After Implementation

| Metric | Current (estimated) | Target | How to measure |
|---|---|---|---|
| **Post-onboarding bounce rate** | ~70% (users who close within 60s of landing) | < 30% | Page visibility API + time-on-page tracking |
| **Time to first subject created** | N/A (many never create one) | < 60 seconds after landing | Timestamp diff between onboarding_completed and first subjects row |
| **Onboarding completion → first plan** | Very low | > 40% within first session | Session tracking: onboarding → subject → planner → commit |
| **Day 1 retention** | Very low | > 50% | Users who return within 24h of creating an account |
| **Day 7 retention** | Near zero | > 20% | Users active 7 days after signup |

### Instrumentation We Need (follow-up task):
- Track `page_landed` events with timestamp and page name
- Track `first_subject_created` event
- Track `first_plan_generated` event
- Track session duration post-onboarding
- Instrument the empty state CTAs to measure click-through rate

---

## Implementation Summary

| Phase | Files Changed | Lines | Effort | Impact |
|-------|-------------|-------|--------|--------|
| 1: Redirect to Dashboard | 1 file, 2 lines | 2 | 5 min | **HIGH** |
| 2: Progressive disclosure on Subjects | 1 file, ~80 lines | ~80 | 1-2 hrs | **HIGH** |
| 3: Slow down onboarding slides | 2 files, 2 lines | 2 | 2 min | **MEDIUM** |
| 4: Improve empty-state copy | 2 files, ~6 lines | ~6 | 5 min | **MEDIUM** |

**Total:** 4 files changed, ~90 lines of code, ~2 hours of work.

### Rollout Recommendation

1. **Deploy Phases 1, 3, 4 together** — they're trivial changes with no visual risk
2. **Deploy Phase 2 after 24h** — it's the biggest visual change and needs QA review
3. **Monitor bounce rate** for 1 week after each deploy
4. **A/B test Phase 2** if possible — half users get progressive disclosure, half get current layout

---

## What We're NOT Doing (Yet)

These are valid strategies but require more investment. They should be evaluated after Phases 1-4 ship:

- **Interactive onboarding tasks** (Duolingo-style): Have the user actually create their first subject during onboarding, not just watch slides
- **Pre-populated sample data** (Notion-style): Seed the user's account with a sample subject, chapter, and tasks so they can explore before building their own
- **Contextual popover tours** (Intercom-style): Inline tooltips that appear when hovering over UI elements, with a progress bar and skip button
- **Empty state templates** (Figma-style): Offer "Start from a template" as an alternative to blank-slate creation
- **The Zeigarnik progress bar:** Track and display setup progress ("2/3 steps complete") to encourage completion
- **Email drip campaign:** If a user signs up but doesn't create a subject within 24h, send a helpful email with a direct link to create one
- **Reduced sidebar for new users:** Show only Overview + Subjects in the sidebar until the user has created content (Linear does this — features unlock as you use them)
