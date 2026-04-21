# PrepVeda Landing Page — Claude Design Brief

**How to use this file:** open claude.ai/design → **New prototype** → tab **"Other"** (or **High fidelity** prototype) → paste the prompt below as the project brief. Upload the 6 app screenshots from `landing-page/app_screenshots/` as reference assets (Dashboard, Subjects, Calendar, Schedule, Planner_Page1, Planner_Page2).

---

## PASTE THIS PROMPT INTO CLAUDE DESIGN

> I need a **high-fidelity, dark-themed, conversion-focused landing page** for **PrepVeda**, a study-planner web app. Build it as a single responsive page (desktop + mobile). Use a premium atmospheric aesthetic — dark navy/black background with ambient indigo + violet + coral glows, a subtle grid texture, glass cards, and floating sticker-style UI callouts around product screenshots.

### Product one-liner

PrepVeda turns a student's syllabus, deadlines and real daily capacity into a **feasibility-checked day-by-day study schedule**. It flags every chapter as Safe / Tight / At Risk / Impossible *before* the student commits, and tells them exactly what to change to make the plan fit.

**Important:** it is **not** an LLM/AI — it's a deterministic constraint solver. Do NOT use phrases like "AI generates your schedule". Use "feasibility-aware", "constraint-based", "plans that fit your life".

### Brand / visual language

- **Background:** near-black `#07080F` base with ambient blurs of indigo `#6366F1`, violet `#8B5CF6`, coral `#FB7185`, amber `#F59E0B`
- **Surfaces / cards:** `#0F1219` and `#12151E` with `border-white/[0.08]`
- **Primary accent (CTA/links):** indigo `#6366F1`
- **Secondary warm accent (pops, highlights):** coral `#FB7185` + amber `#F59E0B`
- **Success:** `#34D399`
- **Typography:** very large, very bold. Hero headline `text-6xl → text-7xl`, `font-black`, `tracking-tight`. Body copy `font-medium text-white/60`
- **Motif:** floating rounded-2xl **glass stickers** (icon + 1-line label) scattered *around* product screenshots — not on top. Subtle `animate-float` keyframes
- **Shape language:** generous `rounded-3xl` / `rounded-[2.5rem]`, no hard corners
- **Subtle grid overlay:** 56px dot or line grid at 3-5% opacity

### Page structure (in order)

1. **Sticky glass nav** — logo + wordmark "PrepVeda" on left, links (How it works, Features, FAQ) center, "Log in" + white pill CTA "Get Started Free" right. 72px tall, `backdrop-blur-xl bg-[#07080F]/75`.

2. **Hero** — two-column on desktop, stacked on mobile.
   - **Left:** coral sparkle pill eyebrow ("Built for serious exam prep"), headline **"A study plan that actually fits your life."** with *"actually fits"* wrapped in a skewed coral-amber gradient highlight bar. Sub-copy about subjects/chapters/deadlines with the phrase "…and warns you **before** you commit to something impossible." Two CTAs: filled indigo "Start Planning Free" + text "See how it works →". Two tiny checkmark rows: "Free plan forever", "No credit card".
   - **Right:** Dashboard screenshot (`Dashboard.png`) framed as a mac-style browser window (dot lights + fake URL `prepveda.app/overview`), slightly tilted in 3D perspective. Ambient indigo and coral glows behind it. **Three floating sticker callouts orbiting it:**
     - top-left: 🔥 "Streak — 12 days strong" (coral)
     - mid-right: ✅ "Today — 4 of 30 tasks" (emerald)
     - bottom-left: ⚠ "Heads up — Calculus is tight" (amber)

3. **Pain strip ("The real problem")** — centered heading **"Most exam prep fails the same way."** Three hover-lift cards with icon + title + 2-line body:
   - "Plans built on hope" — you set deadlines based on what you wish you could do, not hours you actually have.
   - "Drowning in syllabus" — dozens of subjects, hundreds of chapters, no clear answer to *what do I study right now?*
   - "No early warning" — you only learn the plan was impossible when it's too late.

4. **How it works** — eyebrow "How it works", heading **"Three steps from syllabus chaos to a schedule you trust."** Three-card horizontal storyboard with a faint connector line behind the step numbers:
   - **01 · Intake** (indigo) — *Tell it what you have.* Add subjects, chapters, exam date, weekday vs. weekend minutes. *Image:* `Planner_Page1.png`
   - **02 · Preview** (coral) — *See if it's feasible.* PrepVeda flags chapters Safe / Tight / At Risk / Impossible and tells you exactly what to adjust. *Image:* `Planner_Page2.png`
   - **03 · Confirm** (emerald) — *Commit and start.* Lock the schedule. *Image:* `Schedule_Page.png`

5. **Feasibility wedge (signature section)** — two-column.
   - **Left:** amber eyebrow "The unfair advantage", heading **"The only planner that tells you the truth before you start."** with *"the truth"* in coral. Copy explaining it models against weekday minutes / weekend minutes / flexibility buffer / off-days / hard caps. Below: a vertical legend of the 4 feasibility tiers (Safe < 80%, Tight 80–90%, At risk > 90%, Impossible) — each a pill with a coloured vertical bar.
   - **Right:** a **mocked feasibility preview card** — titled "Feasibility preview / plan #042". Five subject rows (Mathematics 68% safe, Physics 74% safe, Calculus 87% tight, AI & ML 94% at risk, P&S 62% safe) — each with name, progress bar in tier colour, %, and a coloured state pill. Below: an amber warning box: *"AI & ML is 94% of capacity. Add +15 min/day or extend the deadline by 2 days to reach safe."*

6. **Feature blocks** — eyebrow "Everything you need", heading **"Every tool you need to own your prep — in one workspace."** Four alternating left/right blocks. Each has:
   - Product screenshot in `rounded-[1.5rem]` frame with a subtly-rotated offset decorative panel behind (tinted with the block's accent)
   - 1–2 floating sticker callouts pinned around the screenshot
   - Right side (or left on reverse): numbered eyebrow pill, big bold heading with accent-colored keyword, paragraph, 3-bullet list with icon + text

   Blocks:
   - **01 · Subjects & Chapters** (indigo) — *Your entire syllabus, **structured.*** Image `Subjects_Page.png`. Stickers: "Chapter dependencies", "11 / 50 completed". Bullets: Organise unlimited subjects & chapters / Track per-chapter completion live / Lock prerequisites with dependencies.
   - **02 · The Planner** (coral) — *Schedules that respect your **real life.*** Image `Planner_Page2.png`. Stickers: "Weekend: 420 min", "Flexibility: 60 min". Bullets: Weekday vs. weekend capacity / Flexibility buffer for overflow days / Per-day custom capacity overrides.
   - **03 · Calendar View** (violet) — *See the **whole month** at a glance.* Image `Calendar_Page.png`. Sticker: "April 2026". Bullets: Monthly view of every session / Colour-coded subject filters / Spot busy weeks in advance.
   - **04 · Weekly Schedule** (emerald) — *Drag, reschedule, **done.*** Image `Schedule_Page.png`. Stickers: "Drag-and-drop", "Track streaks". Bullets: One-tap task completion / Drag-and-drop rescheduling / Streak and focus tracking.

7. **Stats strip** — 4 huge coloured numbers:
   - **100+** indigo — Chapters per plan
   - **4** coral — Feasibility tiers
   - **< 2s** amber — Plan generation
   - **0** emerald — Credit card required

8. **FAQ** — centered heading **"Still wondering?"** Six `<details>` accordions with `+` icon that rotates to `×`:
   - *Is this an AI model writing my schedule?* → No. Deterministic constraint solver. Same inputs → same plan, every time. No hallucinations.
   - *Does it work for my specific exam?* → Exam-agnostic. Any prep you can break into subjects + chapters + effort estimates.
   - *What happens when I fall behind?* → Re-run the planner. "Keep previous plan" mode minimises disruption.
   - *Can I edit a generated schedule by hand?* → Yes. Drag in Schedule view, mark complete, add ad-hoc sessions.
   - *Is my data safe?* → Supabase Postgres with row-level security. Only you can read/write your plans. No training on your data.
   - *Is there a free plan?* → Yes. Full planner, subjects, calendar, schedule. No card required.

9. **Final CTA** — big `rounded-[2.5rem]` card with heavy shadow, indigo + coral blurred orbs, faint grid overlay. Eyebrow pill "Ready when you are". Giant heading **"Stop guessing. Start scheduling."** (with "scheduling" in coral). Sub-copy: "Build your first feasibility-checked plan in under 5 minutes." White pill CTA "Create your plan". Tiny line: "No credit card · Free plan forever".

10. **Footer** — logo + wordmark left, © line center, Privacy / Terms / Contact links right. `bg-[#05060B]`.

### Responsive rules

- Mobile: stack all two-column layouts. Hide floating stickers (`hidden sm:flex` or `hidden md:flex`).
- Hero text scales from `text-5xl` → `text-7xl`.
- Feature screenshots always full-width on mobile, half-width ≥ md.
- Nav links hidden < md; CTA button stays visible.

### Motion / polish

- `@keyframes float` 5s ease-in-out on all glass stickers with staggered delays
- CTA buttons: hover-lift (`-translate-y-1`) + shadow boost
- Feature cards: hover-lift + border brighten
- Section transitions use `border-t border-white/[0.06]` (soft hairlines, never dark lines)
- FAQ `+` → rotate 45deg when open

### Non-goals / do NOT

- Do **not** claim "AI" generates schedules
- Do **not** show testimonials with fake names/photos
- Do **not** use stock illustrations — use the real app screenshots (6 of them) wherever a product visual is called for
- Do **not** use emoji in body text (OK in tiny sticker labels if tasteful, but prefer lucide icons)
- Do **not** use hard dividers — always soft hairlines with opacity

### Required assets

Upload these 6 screenshots to Claude Design when starting the project:
- `Dashboard.png` — hero
- `Subjects_Page.png` — feature 01
- `Planner_Page1.png` — how-it-works step 01
- `Planner_Page2.png` — how-it-works step 02 + feature 02
- `Calendar_Page.png` — feature 03
- `Schedule_Page.png` — how-it-works step 03 + feature 04

---

## For reference — working React implementation

The implementation lives at `app/page.tsx` in the PrepVeda repo. Copy the structure, palette, copy and sticker callouts verbatim — it's already polished. The standalone HTML version is at `landing-page/claude-design-export.html` for a one-file reference.
