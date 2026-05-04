# Design v2 — Plan & Execution Tracker

> **Branch:** `design-v2`
> **Goal:** Adapt the inspiration aesthetic (light, airy, "windowed", pastel-accented, pill-button) to the existing planner-app feature set. **No new features** are being added from the inspiration; only existing features are restyled.
> **Source of truth:** This file. Every session reads this first; every completed task ticks the relevant checkbox here.

---

## 0. Stack snapshot (already in place)

- **Next.js 16.1.6** + **React 19.2.3** (App Router, route groups under `app/(dashboard)/...`)
- **Tailwind CSS v4** with `@theme inline` token block in `app/globals.css`
- **Existing token namespaces:** `--sh-*` (shared), root + `[data-theme="light"]` overrides via `ThemeProvider`
- **Existing UI primitives:** `app/components/ui/` — Badge, Button, Card, Checkbox, Dropdown, Input, Modal, Progress, Tabs
- **Existing layout primitives:** `app/components/layout/` — AppShell, ContentGrid, PageHeader, SectionCard, Sidebar, StatsRow, Topbar
- **Routes (dashboard group):** dashboard, calendar, schedule, subjects, timetable, planner, settings
- **Backend:** Supabase (via `@supabase/ssr` + `@supabase/supabase-js`)

> **Implication:** We are *refactoring* tokens and primitives, not starting fresh. Every phase below specifies which existing files are touched.

---

## 1. Design Principles (binding)

1. **Light mode only.** The dark theme is being removed (not just toggled off — see Phase 12). Any `dark:*` Tailwind class or `[data-theme="dark"]` rule is fair game for deletion.
2. **Three-layer surface model**, not two:
   - **Layer A — Page background** `#F3F4F6` (Gray 100). The browser viewport.
   - **Layer B — App shell** `#FFFFFF` (sidebar half subtly tinted to `#F9FAFB`). Floating, `rounded-[28px]`, `16–24px` margin from viewport edges, very soft diffused shadow.
   - **Layer C — Inset content panel** `#FFFFFF` with a hairline `#F3F4F6` border or a slightly cooler tint, `rounded-2xl`, sitting **inside** Layer B's main content area.
3. **Borders are the exception, not the rule.** Use background contrast (Layer B vs. Layer C) and whitespace before reaching for a border. When borders are needed, they are `1px solid #F3F4F6` or `#E5E7EB` — never darker.
4. **Pills everywhere interactive.** Buttons, chips, status badges, segment selectors, tab headers — `rounded-full`. Cards stay `rounded-2xl`.
5. **Pastel accents only** for tags / event blocks / progress / status. Never for primary actions. Primary action = pure black pill with white text. Secondary action = white pill with `#E5E7EB` border, black text.
6. **Typography is medium-weight, not bold.** Headings use `font-medium` or `font-semibold` max. The inspiration's "Good Morning, Amirbaghian" is medium, not bold — replicate that.
7. **Responsive-first, not responsive-after.** Every screen must work on mobile, iPad portrait, iPad landscape, desktop, and wide. Designs are validated against the §3.1 matrix before a phase is signed off. The inspiration shots are desktop-only; mobile/tablet behavior is *our* design decision and must be made explicitly per screen, not improvised.
8. **No new features from inspiration.** See Section 4 for the explicit exclusion list.

---

## 2. Design System Specification

### 2.1 Color tokens (semantic + raw)

These extend (and partially replace) the existing `--sh-*` tokens in `app/globals.css`.

#### Surface tokens (semantic)

| Token | Value | Purpose |
|---|---|---|
| `--surface-page` | `#F3F4F6` | Outermost browser background (Layer A) |
| `--surface-app` | `#FFFFFF` | App shell main area (Layer B) |
| `--surface-sidebar` | `#F9FAFB` | Sidebar tint inside Layer B |
| `--surface-panel` | `#FFFFFF` | Inset content cards (Layer C) |
| `--surface-panel-muted` | `#FAFAFB` | Subtle alternative panel tint |
| `--surface-hover` | `#F3F4F6` | Default hover wash |

#### Text tokens

| Token | Value | Purpose |
|---|---|---|
| `--text-primary` | `#111827` | Headings, primary body |
| `--text-secondary` | `#6B7280` | Labels, supporting copy |
| `--text-muted` | `#9CA3AF` | Placeholders, disabled, timestamps |
| `--text-on-dark` | `#FFFFFF` | Text on black pill buttons |

#### Border tokens

| Token | Value | Purpose |
|---|---|---|
| `--border-hairline` | `#F3F4F6` | Default panel edge (almost invisible) |
| `--border-subtle` | `#E5E7EB` | Input borders, secondary buttons |
| `--border-strong` | `#D1D5DB` | Focus rings, active separators |

#### Pastel accent palette (custom, NOT Tailwind `*-100`)

The inspiration's pastels are softer than Tailwind's `*-100` scale. Define a custom set:

| Token | Background | Text-on-pastel | Use |
|---|---|---|---|
| `--pastel-mint` | `#E8F5E9` | `#1F6F3F` | Success, completed tasks |
| `--pastel-sky` | `#E3F2FD` | `#1565C0` | Information, neutral events |
| `--pastel-lilac` | `#EDE7F6` | `#5E35B1` | Primary accent (replaces purple brand) |
| `--pastel-peach` | `#FFE8D6` | `#B25C1F` | Warning, pending |
| `--pastel-butter` | `#FFF4C2` | `#8A6D00` | Highlight, "today" |
| `--pastel-rose` | `#FCE4E4` | `#B22A2A` | Danger, missed, overdue |

Each pastel pairs **bg + matching dark text** so chips and event blocks always meet WCAG AA.

#### Action tokens

| Token | Value | Purpose |
|---|---|---|
| `--action-primary-bg` | `#000000` | Primary pill button bg |
| `--action-primary-fg` | `#FFFFFF` | Primary pill button text |
| `--action-primary-bg-hover` | `#1F2937` | Primary hover (Gray 800) |
| `--action-secondary-bg` | `#FFFFFF` | Secondary pill bg |
| `--action-secondary-fg` | `#111827` | Secondary pill text |
| `--action-secondary-border` | `#E5E7EB` | Secondary pill border |
| `--focus-ring` | `#111827` | Focus ring base; rendered with 2px offset + 30% opacity |

### 2.2 Radii

| Token | Value | Use |
|---|---|---|
| `--r-app` | `28px` | App shell outer container |
| `--r-card` | `20px` | Major cards, calendar event blocks |
| `--r-card-sm` | `12px` | Small cards, list rows |
| `--r-input` | `12px` | Text inputs, date pickers |
| `--r-pill` | `9999px` | Buttons, chips, tabs, segments, status badges |

### 2.3 Shadows

All shadows are **diffused and low-opacity**. No neon glows, no hard offsets.

| Token | Value | Use |
|---|---|---|
| `--shadow-app` | `0 24px 60px -20px rgba(17, 24, 39, 0.08), 0 8px 24px -8px rgba(17, 24, 39, 0.04)` | App shell float |
| `--shadow-card` | `0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 12px -4px rgba(17, 24, 39, 0.04)` | Inset panels |
| `--shadow-pop` | `0 8px 24px -8px rgba(17, 24, 39, 0.12)` | Hover lift, dropdowns |
| `--shadow-none` | `0 0 0 transparent` | Default (most things) |

### 2.4 Typography

- **Family:** Geist Sans (already loaded). Fallback: `system-ui`.
- **Heading scale (medium weight, responsive):**

  | Role | Mobile (`<md`) | Tablet (`md/lg`) | Desktop (`xl+`) |
  |---|---|---|---|
  | `display` (page title) | `text-2xl font-medium tracking-tight` | `text-3xl font-medium tracking-tight` | `text-4xl font-medium tracking-tight` |
  | `h1` | `text-xl font-medium` | `text-2xl font-medium` | `text-3xl font-medium tracking-tight` |
  | `h2` (card titles) | `text-base font-semibold` | `text-lg font-semibold` | `text-xl font-semibold` |
  | `h3` | `text-sm font-semibold` | `text-base font-semibold` | `text-base font-semibold` |

  Express in Tailwind via responsive prefixes: `text-2xl md:text-3xl xl:text-4xl font-medium tracking-tight`.

- **Body:**
  - `body`: `text-sm leading-relaxed text-[--text-primary]`
  - `body-sm`: `text-xs leading-relaxed text-[--text-secondary]`
  - `label`: `text-xs uppercase tracking-wide text-[--text-secondary]` (sparingly)
- **Reading width:** body copy capped at `max-w-prose` to keep line lengths readable across viewports.

### 2.5 Spacing

Tailwind defaults (`4px` base) are fine. The aesthetic shift is **using more of them**, not new tokens. Page padding inside Layer B = `p-8` to `p-10`. Card internal padding = `p-6`. Reduce row spacing inside dense lists from current values by 10-20%.

### 2.6 Iconography

- **Library:** Standardize on **Heroicons outline** (or `lucide-react` outline if preferred). Pick one and convert.
- **Stroke width:** 1.5px.
- **Active sidebar item:** icon switches to **filled** variant, but only via background color of the pill, not by switching icon set. Stroke stays the same.

### 2.7 Component primitives spec (binding for Phase 3)

Each existing primitive in `app/components/ui/` will be rewritten against the new tokens. Specs:

#### Button
- Variants: `primary` (black pill), `secondary` (white pill, hairline border), `ghost` (no bg, black text, hover = `--surface-hover`), `danger` (rose pastel pill)
- Sizes: `sm` (`h-8 px-3 text-xs`), `md` (`h-10 px-4 text-sm`), `lg` (`h-11 px-5 text-sm`)
- All `rounded-full`. No shadows. Focus ring: 2px offset, `--focus-ring` at 30% opacity.
- Loading state: spinner replaces leading icon; disabled = 40% opacity.
- **Touch targets:** when rendered on mobile (`<md`), enforce a minimum hit area of `44×44px` via `min-h-[44px] min-w-[44px]` even if the visual pill is smaller — pad with transparent space. `sm` size auto-bumps to `md` height on mobile.

#### Badge / Chip
- Variants: one per pastel token (`mint`, `sky`, `lilac`, `peach`, `butter`, `rose`) + `neutral` (`#F3F4F6` bg, `#374151` text).
- Always `rounded-full`, `px-2.5 py-0.5 text-xs font-medium`.
- Optional leading dot (4px solid circle, same color family as text).

#### Card
- Default: `bg-[--surface-panel] rounded-2xl shadow-[--shadow-card] p-6`
- `flat` variant: same but no shadow (used inside Layer B without inset).
- `interactive` variant: hover → `--shadow-pop`, very subtle lift.

#### Input / Select / DatePicker
- Default: `h-10 rounded-[12px] bg-[--surface-page] border border-transparent px-3 text-sm`
- Focus: `bg-white border-[--border-strong]`
- Label sits above input, `text-xs text-[--text-secondary] mb-1.5`.
- No floating labels.

#### Tabs / Segmented control
- Pill-shaped track: `rounded-full bg-[--surface-page] p-1`
- Active item: white pill, `--shadow-card`, black text.
- Inactive: transparent, `--text-secondary`.

#### Progress bar
- Track: `h-1.5 rounded-full bg-[--surface-page]`
- Fill: pastel of choice (default `--pastel-lilac`), `rounded-full`.

#### Modal
- Overlay: `bg-black/30 backdrop-blur-[2px]`
- Sheet: `rounded-3xl bg-white shadow-[--shadow-app] max-w-lg p-8`
- **Mobile (`<md`):** the modal becomes a bottom sheet — `rounded-t-3xl rounded-b-none`, anchored to viewport bottom, full-width, drag-down-to-dismiss optional. Avoid centered modals on phones.

#### Universal touch & input rules
- **Min touch target 44×44px** on `<md`. Applies to icon buttons, checkboxes, list-row chevrons, calendar cells.
- **Tap states** must be visible (`active:bg-[--surface-hover]`); never rely solely on hover.
- **No hover-only affordances.** Tooltips, hover-reveal actions must have a tap-to-reveal fallback on touch.
- **Avoid `position: sticky` traps** on iOS — sticky topbars must use `top: env(safe-area-inset-top)` to account for browser chrome.

---

## 3. App Shell layout (binding)

```
┌─────────────────────────────────────────────────────┐
│ Layer A: page bg #F3F4F6, padding 16-24px            │
│  ┌───────────────────────────────────────────────┐   │
│  │ Layer B: white shell, rounded-[28px],          │   │
│  │ shadow-app, overflow-hidden                     │   │
│  │  ┌───────────┬───────────────────────────────┐ │   │
│  │  │ Sidebar   │ Main area                      │ │   │
│  │  │ #F9FAFB   │ Topbar (breadcrumb + search)   │ │   │
│  │  │           │ ┌────────────────────────────┐ │ │   │
│  │  │           │ │ Layer C: inset panels      │ │ │   │
│  │  │           │ │ rounded-2xl, shadow-card    │ │ │   │
│  │  │           │ └────────────────────────────┘ │ │   │
│  │  └───────────┴───────────────────────────────┘ │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 3.1 Canonical responsive matrix

This is the **single source of truth** for breakpoints. Every screen phase below references this matrix. Aligned with Tailwind v4 default prefixes so we can express rules as `md:`, `lg:`, `xl:`, `2xl:`.

| Tier | Tailwind | Range | Target devices |
|---|---|---|---|
| **Mobile** | (none) | `<768px` | Phones (portrait + landscape), small phones |
| **Tablet portrait** | `md:` | `768–1023px` | iPad portrait, small tablets |
| **Tablet landscape / small laptop** | `lg:` | `1024–1279px` | iPad landscape, 11–13" laptops |
| **Desktop** | `xl:` | `1280–1535px` | Standard laptops/desktops |
| **Wide** | `2xl:` | `≥1536px` | Large monitors, ultrawide |

#### Per-tier shell behavior

| Tier | Layer A padding | Layer B radius | Sidebar | Topbar | Content max width |
|---|---|---|---|---|---|
| Mobile | `0` (full-bleed) | `0` | Off-canvas drawer (hamburger trigger) | Sticky, condensed (logo + breadcrumb + drawer toggle) | `100%` |
| Tablet portrait | `12px` | `20px` | Icon rail (64px) by default; expandable on tap | Sticky, full | `100%` |
| Tablet landscape | `16px` | `24px` | Full sidebar (240px) | Sticky, full | `100%` |
| Desktop | `24px` | `28px` | Full sidebar (240px) | Sticky, full | `100%` |
| Wide | `24px` | `28px` | Full sidebar (240px) | Sticky, full | `max-w-[1600px] mx-auto` (don't stretch ugly) |

#### Per-tier content patterns (cross-screen defaults)

| Pattern | Mobile | Tablet portrait | Tablet landscape+ |
|---|---|---|---|
| Metric/stat row (4 cards) | 1 col stack | 2 cols | 4 cols |
| 3-pane workspace (Subjects, Planner) | Tabbed (one pane visible) | 2 panes side-by-side, third in drawer/modal | 3 panes side-by-side |
| Calendar month grid | **Replaced by agenda list** (see Phase 6.1) | Compact 7-col grid, max 1 event per cell + "+N more" | Full 7-col grid, max 2 events + "+N more" |
| Schedule timetable | **Day view** with horizontal day-tabs at top | 3-day rolling view | Full 7-day week view |
| Forms (Planner intake) | Full-width single column | Two-column where logical | Full multi-column |
| Modal | Bottom sheet | Centered modal | Centered modal |

#### Other responsive rules

- **Safe areas:** Layer A padding respects `env(safe-area-inset-*)` on iOS so notched devices don't clip the shell.
- **Sticky topbar on mobile** uses `top: env(safe-area-inset-top)`.
- **Orientation flip:** test phone landscape (e.g., 812×375) — the sidebar drawer must still work; the schedule day view should keep its horizontal day-tab strip visible.
- **No horizontal scroll** at any tier except inside opt-in scrollers (schedule day strip, calendar weekday header on mobile).
- **Hit-target enforcement** per §2.7: every interactive element gets `min-h-[44px] min-w-[44px]` below `md`.

---

## 4. Inspiration: include / exclude list

**Adopted (visual language):**
- Three-layer surface model
- Pill buttons everywhere
- Pastel event/status blocks
- Breadcrumb header pattern (`Section > Subsection`)
- Sidebar with `Main menu` and `Settings and news` groupings
- "Account" tile at bottom of sidebar (avatar + name + plan)
- Mini-month calendar widget paired with event list
- Filter chip with count badge

**Rejected (do NOT introduce):**
- AI assistant panel (right column with chat input)
- "Pro Account" upsell pill in topbar
- Multi-account tabs across the very top of the window (Amir / Leila / Nick)
- "School News," "What's New," "Reports," "Analytics," "Class Preparation," "Messages" sidebar items
- Teacher/student attendance metaphors (Present/Absent/Delayed)
- Comments/replies on items
- Public/Private event distinction (unless we already have it)

**Open questions (defer until first hit):**
- Do we add a topbar search? (Inspiration has it; we currently don't.) — **Default: no, until we have content to search.**
- Do we add a notifications bell? (Inspiration has it.) — **Default: no, until we have notifications.**

---

## 5. Model roster & assignment heuristic

### 5.1 Available models

**OpenCode Go (target ~70%+ of work):**
- **DeepSeek V4 Pro** — top-tier code reasoner, default for component refactors
- **DeepSeek V4 Flash** — cheap/fast, default for mechanical bulk edits
- **Kimi K2.6 (3x limits)** — long context, default for multi-file orchestrations
- **GLM-5.1** — solid generalist, default for token/system design tasks
- **Kimi K2.5** — fallback long-context

**OpenCode Zen:**
- **MiniMax M2.5 Free** — free tier, use for trivial bulk replacements where quality bar is low

**Other OpenCode models (use as needed):**
- **MiMo V2.5 Pro** — reasoning, good for design decisions and trade-off calls
- **MiMo V2.5 / V2 Pro** — middle tier
- **MiniMax M2.5 / M2.7** — generalists
- **Qwen3.5 Plus / Qwen3.6 Plus** — strong coders, middle-upper tier

**Claude (premium — use sparingly for highest-leverage work):**
- **Claude Opus 4.7** — final architectural calls, contested decisions, complex visual judgment
- **Claude Sonnet 4.6** — nuanced UI work, a11y review, final polish
- **Claude Haiku 4.5** — quick verification, lint passes, sanity checks

**Antigravity:**
- **Gemini 3.1 Pro** — multimodal; use when visual review against inspiration screenshots matters

### 5.2 Assignment heuristic (defaults — override per-task as needed)

| Task shape | Default model |
|---|---|
| Mechanical class swap (e.g., `bg-gray-900` → `bg-white` across 30 files) | **DeepSeek V4 Flash** |
| Component refactor (rewrite a primitive against new tokens, preserve behavior) | **DeepSeek V4 Pro** |
| Multi-file feature restyle (e.g., entire Dashboard) | **Kimi K2.6** (long context) |
| Token system design / Tailwind v4 `@theme` block authoring | **GLM-5.1** or **Qwen3.6 Plus** |
| Trivial deletions (kill unused dark-mode CSS classes) | **MiniMax M2.5 Free** or **DeepSeek V4 Flash** |
| Design trade-off / architectural decision | **MiMo V2.5 Pro** or **Claude Sonnet 4.6** |
| Visual fidelity check vs inspiration screenshot | **Gemini 3.1 Pro** (multimodal) |
| Accessibility review (focus rings, contrast, keyboard nav) | **Claude Sonnet 4.6** |
| Final polish + edge cases on a phase | **Claude Sonnet 4.6** |
| Contested call / dispute resolution | **Claude Opus 4.7** |
| Quick verify (typecheck passes, lint clean) | **Claude Haiku 4.5** |

> **Rule of thumb:** Start with the cheapest OpenCode model that can plausibly do the task. Escalate one tier if output quality is poor. Reserve Claude/Gemini for the last 20-30% where judgment matters more than throughput.

---

## 6. Phased Roadmap

> Each phase has: **Goal**, **Tasks** (with model + Definition of Done), **Files touched**, **Validation gate**.
> Tick `[x]` when complete. Update notes inline.

### Phase 0 — Audit & Setup
**Goal:** Map the dark-mode footprint and lock the working agreement before touching code.

- [ ] **0.1 Audit `dark:` class usage** — grep every `dark:` Tailwind class and `[data-theme="dark"]` reference. Output: a count + file list. **Model:** DeepSeek V4 Flash. **DoD:** committed report at `docs/design-v2/dark-mode-audit.md`.
- [ ] **0.2 Audit existing token surface** — list every `--sh-*` and `--background/--foreground/--card/...` reference across `app/`, document which are still needed vs. replaced. **Model:** Kimi K2.6 (needs full repo scan). **DoD:** report at `docs/design-v2/token-audit.md`.
- [ ] **0.3 Capture baseline screenshots** — start dev server, take screenshots of all 7 routes for before/after comparison. **Model:** N/A (manual / Claude Haiku). **DoD:** `docs/design-v2/baseline/` with PNGs.
- [ ] **0.4 Decide icon library** — confirm Heroicons outline vs. lucide-react. **Model:** MiMo V2.5 Pro (decision aid). **DoD:** decision recorded in this file under §2.6.
- [ ] **0.5 Set up Vercel preview for `design-v2` branch** — for validation gates. **Model:** N/A (user action / Claude Haiku to verify config). **DoD:** preview URL pasted here.

**Validation gate:** Audits reviewed; no surprises (e.g., dark-mode classes in 200+ files). Sign-off before Phase 1.

---

### Phase 1 — Token system & Tailwind v4 theme
**Goal:** Replace the existing `--sh-*` and dark-default tokens with the new semantic system from §2.

- [ ] **1.1 Rewrite `app/globals.css` token block** — implement all tokens from §2.1–2.3 inside a single `@theme inline` declaration. Keep dark-mode rules in place (we strip them in Phase 12) but add new tokens additively first. **Model:** GLM-5.1. **DoD:** `app/globals.css` typechecks; new tokens are referenceable as `bg-[--surface-app]` etc.
- [ ] **1.2 Add Tailwind utility shortcuts** — define `@utility` rules for `pill`, `panel`, `chip-mint`, `chip-sky`, etc. so components stay clean. **Model:** GLM-5.1. **DoD:** utilities available via simple class names.
- [ ] **1.3 Strip `glass-card`, `gradient-card`, `emerald-card`, `danger-card`, `warning-card` rules** from globals.css (or mark deprecated). **Model:** DeepSeek V4 Flash. **DoD:** rules removed; broken usages flagged.
- [ ] **1.4 Document tokens** in `docs/design-v2/tokens.md` for future reference. **Model:** DeepSeek V4 Pro. **DoD:** doc committed.

**Files touched:** `app/globals.css`, `docs/design-v2/tokens.md`.
**Validation gate:** Typecheck + lint pass. No visual change yet (tokens defined but not used).

---

### Phase 2 — App Shell (the floating window)
**Goal:** Implement the three-layer surface model in `AppShell.tsx`. After this, every screen gains the windowed look automatically.

- [ ] **2.1 Refactor `app/components/layout/AppShell.tsx`** — outer Layer A bg, inner Layer B card with `rounded-[28px]`, `shadow-app`, sidebar slot at `--surface-sidebar`, main slot at `--surface-app`. **Model:** DeepSeek V4 Pro. **DoD:** all 7 dashboard routes render inside the new shell without overflow / scroll bugs.
- [ ] **2.2 Update `app/(dashboard)/layout.tsx`** if needed to wire the new AppShell props. **Model:** DeepSeek V4 Pro. **DoD:** routes still resolve.
- [ ] **2.3 Implement the §3.1 responsive matrix in AppShell** — five tiers, sidebar transforms (drawer/rail/full), Layer A padding & Layer B radius per tier, safe-area insets on iOS. **Model:** Qwen3.6 Plus. **DoD:** all 5 viewports (375 / 768 / 1024 / 1440 / 1920) render correctly + iOS Safari safe-area test on real device or simulator.
- [ ] **2.4 Visual review against inspiration** — compare side-by-side with `WhatsApp...1.40.48 PM.jpeg`. **Model:** Gemini 3.1 Pro (multimodal). **DoD:** delta notes + fixes applied.

**Files touched:** `app/components/layout/AppShell.tsx`, `app/(dashboard)/layout.tsx`, possibly `app/globals.css`.
**Validation gate:** User confirms shell looks right on Vercel preview. Backend untouched.

---

### Phase 3 — Component primitives
**Goal:** Refactor every primitive in `app/components/ui/` to the new spec (§2.7) so screens just consume them in later phases.

- [ ] **3.1 Button.tsx** — variants per spec; rounded-full; black primary. **Model:** DeepSeek V4 Pro. **DoD:** all current call sites compile (props-compatible refactor); visual matches spec.
- [ ] **3.2 Badge.tsx** — pastel variants. **Model:** DeepSeek V4 Flash. **DoD:** chip variants render in a Storybook-style demo route at `/dev/primitives` (temp route, deleted in Phase 12).
- [ ] **3.3 Card.tsx + SectionCard.tsx** — flat / interactive variants. **Model:** DeepSeek V4 Pro. **DoD:** existing usages keep working.
- [ ] **3.4 Input.tsx** — new flat field style. **Model:** Qwen3.6 Plus. **DoD:** date-picker, text, search variants.
- [ ] **3.5 Checkbox.tsx** — minimal black/white style with rounded square. **Model:** DeepSeek V4 Flash. **DoD:** matches inspiration's checkbox.
- [ ] **3.6 Dropdown.tsx** — pill trigger + soft popover. **Model:** DeepSeek V4 Pro. **DoD:** keyboard nav preserved.
- [ ] **3.7 Modal.tsx** — `rounded-3xl`, soft overlay. **Model:** DeepSeek V4 Pro. **DoD:** focus trap retained.
- [ ] **3.8 Progress.tsx** — pill bar with pastel fill prop. **Model:** DeepSeek V4 Flash. **DoD:** API allows color choice.
- [ ] **3.9 Tabs.tsx** — pill segment look. **Model:** Qwen3.6 Plus. **DoD:** active state animates.
- [ ] **3.10 PageHeader.tsx + breadcrumb pattern** — add breadcrumb above page title. **Model:** DeepSeek V4 Pro. **DoD:** new prop `breadcrumb?: Array<{label, href?}>`.
- [ ] **3.11 Build temp `/dev/primitives` page** showcasing every variant. **Model:** Kimi K2.6. **DoD:** route deployed to preview.
- [ ] **3.12 Polish pass on all primitives** — focus rings, hover states, disabled states. **Model:** Claude Sonnet 4.6. **DoD:** a11y check + visual check both pass.

**Files touched:** `app/components/ui/*.tsx`, `app/components/layout/PageHeader.tsx`, `app/components/layout/SectionCard.tsx`, new `app/(dashboard)/dev/primitives/page.tsx`.
**Validation gate:** User reviews `/dev/primitives` route on preview. Sign-off → Phase 4.

---

### Phase 4 — Sidebar & Topbar
**Goal:** Bring navigation chrome to spec.

- [ ] **4.1 Refactor `Sidebar.tsx`** — `--surface-sidebar` bg, group headings (`Main menu`, `Settings`), pill active state (white pill on gray bg with `--shadow-card`), Heroicons outline @ 1.5px stroke. **Model:** DeepSeek V4 Pro. **DoD:** matches inspiration sidebar at structural level.
- [ ] **4.2 Add account tile at sidebar bottom** — avatar + name + plan. **Model:** Qwen3.6 Plus. **DoD:** uses real auth user.
- [ ] **4.3 Refactor `Topbar.tsx`** — breadcrumb left, optional notification/search icons right. Per §4 we leave bell + search out for now. **Model:** DeepSeek V4 Pro. **DoD:** breadcrumb consumes PageHeader prop.
- [ ] **4.4 Mobile drawer for sidebar** at `< 768px`. **Model:** Qwen3.6 Plus. **DoD:** drawer opens via topbar hamburger; backdrop closes it.
- [ ] **4.5 Visual review** vs inspiration sidebars (multiple shots). **Model:** Gemini 3.1 Pro. **DoD:** delta notes resolved.

**Files touched:** `app/components/layout/Sidebar.tsx`, `app/components/layout/Topbar.tsx`.
**Validation gate:** User signs off on chrome on preview.

---

### Phase 5 — Dashboard / Overview
**Goal:** First feature screen brought into the new aesthetic. This becomes the reference for remaining screens.

- [ ] **5.1 Audit current Dashboard** — list every section and its data source (UI-only refactor must preserve data wiring). **Model:** Kimi K2.6. **DoD:** inventory in this file under Phase 5 notes.
- [ ] **5.2 Restyle "Good Morning" header** — medium weight, breadcrumb above. **Model:** DeepSeek V4 Pro. **DoD:** header renders with current time-based greeting.
- [ ] **5.3 Restyle metrics row (Today's Progress, Tasks counts)** — pastel progress bars, pill stat cards. **Model:** DeepSeek V4 Pro. **DoD:** real values bound.
- [ ] **5.4 Restyle "Today's Tasks" widget** — soft Card variant, pastel status chips, line icons. **Model:** Kimi K2.6 (touches multiple subcomponents). **DoD:** task list interactive (mark done / open detail).
- [ ] **5.5 Restyle "Alerts" widget** — pastel rose/peach for warnings, pill variants. **Model:** DeepSeek V4 Pro. **DoD:** matches inspiration alert tone (no harsh red).
- [ ] **5.6 Restyle "Subjects" sidebar widget at bottom** — chips with mint/sky variants. **Model:** DeepSeek V4 Flash. **DoD:** chip count matches subject count.
- [ ] **5.7 Cross-screen visual sweep** — typography weights, spacing, radii consistent. **Model:** Claude Sonnet 4.6. **DoD:** punch list resolved.
- [ ] **5.R Responsive pass — Dashboard** — apply §3.1 matrix: stat row 1→2→4 col, "Today's Tasks" + "Alerts" stack on mobile, "Subjects" widget moves below tasks on mobile. Touch targets verified. Page title scales per §2.4. **Model:** Qwen3.6 Plus (impl) + Claude Sonnet 4.6 (cross-viewport QA). **DoD:** screenshots at 375 / 768 / 1024 / 1440 committed to `docs/design-v2/screens/dashboard/`.
- [ ] **5.8 Visual review vs inspiration overview** (`WhatsApp...1.40.48 PM.jpeg`, `(2).jpeg`). **Model:** Gemini 3.1 Pro. **DoD:** delta notes resolved.

**Files touched:** `app/(dashboard)/dashboard/page.tsx` and any `app/(dashboard)/dashboard/*.tsx` subcomponents, plus shared widgets the dashboard uses.
**Validation gate:** **User explicitly signs off on dashboard look + responsive behavior before Phase 6.** This is the reference screen.

---

### Phase 6 — Calendar
**Goal:** Restyle the month grid + event blocks.

- [ ] **6.1 Decide grid density (per tier)** — current app stacks 4-5 events per cell; inspiration shows max 2. Per §3.1: mobile = agenda list (no grid), tablet portrait = grid w/ 1 event + "+N more", tablet landscape+ = grid w/ 2 events + "+N more". Confirm or revise this default. **Model:** Claude Sonnet 4.6 (judgment call). **DoD:** per-tier decision recorded inline; user signs off.
- [ ] **6.2 Restyle grid** — remove heavy lines; subtle dividers via background tint or 1px hairline. **Model:** DeepSeek V4 Pro. **DoD:** grid renders correctly across month boundary.
- [ ] **6.3 Restyle event blocks** — pastel by subject; rounded; `text-xs` content. Map subject → pastel deterministically. **Model:** DeepSeek V4 Pro. **DoD:** subject color mapping documented in `docs/design-v2/subject-colors.md`.
- [ ] **6.4 Style "today" cell** — `--pastel-butter` ring or fill. **Model:** DeepSeek V4 Flash. **DoD:** today cell visually distinct.
- [ ] **6.5 Style filter chip + count badge** — match inspiration's `Filter [1]` pattern. **Model:** Qwen3.6 Plus. **DoD:** filter UI works.
- [ ] **6.6 Style legend at bottom** (currently colored pills for subjects). **Model:** DeepSeek V4 Flash. **DoD:** legend uses pastel chips.
- [ ] **6.R Responsive pass — Calendar** — implement the per-tier strategy from 6.1: mobile agenda list (chronological, grouped by date, with month-jump pill at top), tablet portrait compact grid, tablet landscape+ full grid. Filter/legend reflows. Day-cell tap on mobile opens a sheet with full event list. **Model:** Kimi K2.6 (multi-file responsive impl). **DoD:** screenshots at 375 / 768 / 1024 / 1440 committed; agenda view interactive.
- [ ] **6.7 Visual review** vs `WhatsApp...1.40.48 PM (3).jpeg` and `(2).jpeg`. **Model:** Gemini 3.1 Pro. **DoD:** delta resolved.

**Files touched:** `app/(dashboard)/dashboard/calendar/*` (or wherever Calendar lives), event-block component, filter component.
**Validation gate:** User signs off.

---

### Phase 7 — Schedule (timetable)
**Goal:** Bring the dense timetable into the soft aesthetic without losing density.

- [ ] **7.1 Audit current density** — count events per day in worst case. **Model:** DeepSeek V4 Flash. **DoD:** number recorded; informs Task 7.2.
- [ ] **7.2 Restyle day columns** — light `--surface-page` backdrop, no harsh dividers. **Model:** DeepSeek V4 Pro. **DoD:** columns render at 7-day view.
- [ ] **7.3 Restyle event blocks** — pastel by subject (reuse mapping from Phase 6.3), rounded, status chip on bottom (Pending → peach, Confirmed → mint, Missed → rose). **Model:** Kimi K2.6 (multi-state component). **DoD:** all status states render.
- [ ] **7.4 Restyle current-time indicator** — thin black line with small black circle at left. **Model:** DeepSeek V4 Flash. **DoD:** indicator updates per minute.
- [ ] **7.5 Restyle topbar segment selector** (Month/Week/Day, subject filters). **Model:** Qwen3.6 Plus. **DoD:** uses Tabs primitive from Phase 3.
- [ ] **7.6 Restyle "Add Event" pill** (primary black). **Model:** DeepSeek V4 Flash. **DoD:** matches Button primary spec.
- [ ] **7.R Responsive pass — Schedule** — per §3.1: mobile = day view with horizontal day-tab strip (`Mon Tue Wed...`) at top, swipe-friendly; tablet portrait = 3-day rolling view; tablet landscape+ = full 7-day week. Time-axis labels stay readable at all tiers (consider hiding half-hour labels on mobile). Event blocks remain tappable (44px min). **Model:** Kimi K2.6 (impl) + Claude Sonnet 4.6 (QA). **DoD:** screenshots + interactive test at 375 / 768 / 1024 / 1440.
- [ ] **7.7 Visual review** vs `WhatsApp...1.40.49 PM.jpeg` and `(1).jpeg`. **Model:** Gemini 3.1 Pro. **DoD:** delta resolved.

**Files touched:** `app/(dashboard)/schedule/*`, `app/(dashboard)/timetable/*` if separate, `app/components/layout/ScheduleTopbarContext.tsx`.
**Validation gate:** User signs off.

---

### Phase 8 — Subjects
**Goal:** Move from bordered table rows to airy lists.

- [ ] **8.1 Restyle subject list panel (left)** — pastel chip per subject, lecture count. **Model:** DeepSeek V4 Pro. **DoD:** existing subject CRUD still works.
- [ ] **8.2 Restyle chapter list panel (middle)** — same chip pattern. **Model:** DeepSeek V4 Flash. **DoD:** works.
- [ ] **8.3 Restyle lectures table (right)** — replace bordered rows with airy list items, status checkbox left, pill action right. **Model:** Kimi K2.6 (touches `subjects-data-table` folder). **DoD:** `app/components/subjects-data-table/*` updated.
- [ ] **8.4 Restyle "Add Subject / Add Chapter / Add Task" buttons** to primary pill. **Model:** DeepSeek V4 Flash. **DoD:** done.
- [ ] **8.5 Restyle archive views** to match. **Model:** DeepSeek V4 Pro. **DoD:** parity with main view.
- [ ] **8.R Responsive pass — Subjects** — three-pane (Subjects / Chapters / Lectures) layout transforms per §3.1: mobile = pill-tab navigation between panes (one visible at a time, swipe or tap to switch); tablet portrait = master-detail (Subjects+Chapters left, Lectures right OR Subjects left, Chapters+Lectures stacked right); tablet landscape+ = full three-pane. Lecture rows use comfortable touch height on mobile. **Model:** Kimi K2.6 (impl) + Claude Sonnet 4.6 (QA). **DoD:** all three navigation modes work; screenshots committed.
- [ ] **8.6 Visual review.** **Model:** Gemini 3.1 Pro. **DoD:** delta resolved.

**Files touched:** `app/(dashboard)/dashboard/subjects/*`, `app/components/subjects-data-table/*`.
**Validation gate:** User signs off.

---

### Phase 9 — Planner (intake form)
**Goal:** Multi-step intake form with flat, high-padding inputs and pill step indicators.

- [ ] **9.1 Restyle step indicator** (`Phase 1 — Intake / Preview / Confirm`) — pill segment selector. **Model:** Qwen3.6 Plus. **DoD:** matches Tabs primitive.
- [ ] **9.2 Restyle intake form left/middle panels** (Subjects/Chapters with pastel chips). **Model:** DeepSeek V4 Pro. **DoD:** parity with Subjects screen patterns.
- [ ] **9.3 Restyle Tasks Overview panel** — list rows with chips, pill actions. **Model:** DeepSeek V4 Pro. **DoD:** add/edit task interactions preserved.
- [ ] **9.4 Restyle Step-2 (dates, capacity, flexibility minutes)** — flat Input primitive, mini-calendar for date picker. **Model:** Kimi K2.6 (form is large). **DoD:** all controls bound.
- [ ] **9.5 Restyle Custom Capacity calendar** — pastel highlight on selected days. **Model:** DeepSeek V4 Pro. **DoD:** selection state visible.
- [ ] **9.6 Restyle Preview / Confirm steps** to match. **Model:** Kimi K2.6. **DoD:** plan preview readable.
- [ ] **9.R Responsive pass — Planner** — multi-step intake reflows per §3.1: mobile = single-column form, step indicator becomes a compact pill + progress dots, sticky bottom action bar with "Back / Next" pills (44px+); tablet portrait = two-column where logical (e.g., Subjects+Chapters left, Tasks Overview right with the third pane in a sheet); tablet landscape+ = full three-column. Custom-capacity calendar is full-width on mobile. **Model:** Kimi K2.6 (impl) + Claude Sonnet 4.6 (QA). **DoD:** the full intake → preview → confirm flow completes on a real phone; screenshots committed.
- [ ] **9.7 Visual review.** **Model:** Gemini 3.1 Pro. **DoD:** delta resolved.

**Files touched:** `app/(dashboard)/planner/*`.
**Validation gate:** User signs off.

---

### Phase 10 — Settings
**Goal:** Restyle the settings page to match.

- [ ] **10.1 Restyle settings sections** as inset Cards. **Model:** DeepSeek V4 Pro. **DoD:** all settings still editable.
- [ ] **10.2 Restyle theme toggle** if kept — currently allows dark; per Phase 12 we remove dark, so this becomes either a no-op section or is deleted. **Model:** Claude Sonnet 4.6 (decision included). **DoD:** decision recorded.
- [ ] **10.R Responsive pass — Settings** — full-width single-column on mobile with collapsible section headers; tablet+ = sectioned cards. Form fields full-width on mobile, max `max-w-md` on tablet+. **Model:** Qwen3.6 Plus. **DoD:** screenshots at 375 / 768 / 1024 / 1440 committed.
- [ ] **10.3 Visual sweep.** **Model:** DeepSeek V4 Flash. **DoD:** done.

**Files touched:** `app/(dashboard)/dashboard/settings/*`, `app/components/SettingsFounderMessageButton.tsx`, `app/components/FounderMessageModal.tsx`, `app/components/Toast.tsx`, `app/components/ThemeProvider.tsx`.
**Validation gate:** User signs off.

---

### Phase 11 — Polish, motion, a11y
**Goal:** Elevate to "premium" with subtle motion and accessibility hardening.

- [ ] **11.1 Page transitions** — fade + 4px slide on route change. **Model:** Qwen3.6 Plus. **DoD:** transitions work; no layout jank.
- [ ] **11.2 Hover micro-interactions** — pill buttons subtle scale (0.98 active, 1.0 rest); cards subtle shadow lift. **Model:** Qwen3.6 Plus. **DoD:** consistent across primitives.
- [ ] **11.3 Reduced-motion support** — respect `prefers-reduced-motion`. **Model:** Claude Sonnet 4.6. **DoD:** all motion gated.
- [ ] **11.4 Focus ring audit** — every interactive element has visible focus. **Model:** Claude Sonnet 4.6. **DoD:** keyboard tab through every page passes.
- [ ] **11.5 Contrast audit** — every chip / button / text combo passes WCAG AA. **Model:** Claude Sonnet 4.6. **DoD:** report at `docs/design-v2/contrast-audit.md`.
- [ ] **11.6 Cross-viewport QA (full app)** — every route at every §3.1 tier (375 / 768 / 1024 / 1440 / 1920). Plus phone-landscape (812×375) and iOS Safari real-device or simulator pass for safe-area / sticky-topbar / bottom-sheet behavior. **Model:** Claude Sonnet 4.6 + manual. **DoD:** screenshot grid committed to `docs/design-v2/qa/`; real-device test recorded.
- [ ] **11.7 Touch & gesture QA** — every interactive element ≥44×44 on mobile; no hover-only affordances; sidebar drawer swipe-to-close; calendar/schedule horizontal scrollers snap correctly. **Model:** Claude Sonnet 4.6. **DoD:** punch list resolved.

**Files touched:** Wide. Mostly small additions to existing files; possibly a `lib/motion.ts` helper.
**Validation gate:** User signs off; preview deploy looks production-ready.

---

### Phase 12 — Dark-mode removal & cleanup
**Goal:** Permanently remove the dark theme and dead code.

- [ ] **12.1 Strip `dark:*` classes** based on Phase 0.1 audit. **Model:** DeepSeek V4 Flash (mechanical). **DoD:** zero `dark:` matches in repo.
- [ ] **12.2 Remove `[data-theme="dark"]` rules** from globals.css. **Model:** DeepSeek V4 Flash. **DoD:** removed.
- [ ] **12.3 Simplify `ThemeProvider`** to a no-op or remove if unused. **Model:** DeepSeek V4 Pro. **DoD:** decision recorded; if removed, references cleaned.
- [ ] **12.4 Remove dead `glass-card`/`gradient-card` etc.** if not removed in Phase 1.3. **Model:** DeepSeek V4 Flash. **DoD:** done.
- [ ] **12.5 Remove temp `/dev/primitives` route** (from Phase 3.11). **Model:** DeepSeek V4 Flash. **DoD:** route deleted.
- [ ] **12.6 Update `docs/` and README** to reflect light-only design. **Model:** DeepSeek V4 Pro. **DoD:** docs current.
- [ ] **12.7 Final review.** **Model:** Claude Opus 4.7. **DoD:** sign-off; ready to merge `design-v2` → `main`.

**Files touched:** Wide cleanup pass.
**Validation gate:** All tests pass (`npm run ci:check`); user merges branch.

---

## 7. Validation gates (how we sign off)

Each phase ends with a gate. Mechanism:

1. **Push to `design-v2` branch** → Vercel preview rebuilds.
2. **User reviews preview URL** (and screenshot diff against inspiration if relevant).
3. **User says "approved"** in chat → tick checkboxes in this file → next phase.
4. **If rejected** → record blocker inline under the phase, address, re-gate.

> Important: **Do not start Phase N+1 until Phase N is approved.** Each phase explicitly confirms with the user before proceeding.

---

## 8. Working agreements

- **No new features** introduced during this redesign. If something looks like a feature gap, log it under §4 "Open questions" or as a follow-up; don't merge it into design-v2.
- **No Supabase schema changes** during design-v2. Per global memory rule: any DB migration goes to `supabase/migrations/<version>_<name>.sql` and pauses for manual apply.
- **Backend wiring stays intact.** UI refactors are props-compatible against existing data hooks unless explicitly noted.
- **Tests must keep passing.** Every phase ends with `npm run ci:check` green. If a test asserts on dark-mode classes or old token names, update the test as part of the phase that broke it.
- **Commit hygiene:** one commit per task (or per logical sub-task), prefixed `design-v2(phaseN.M):`. Example: `design-v2(3.1): rewrite Button primitive against new tokens`.

---

## 9. Status log (update each session)

| Date | Phase/Task | Model used | Notes |
|---|---|---|---|
| 2026-05-04 | Plan authored | Claude Sonnet 4.6 | Initial plan committed. |
| 2026-05-04 | Plan rev: responsive matrix added | Claude Sonnet 4.6 | Added principle #7 (responsive-first), §2.4 responsive type scale, §2.7 touch-target rules, §3.1 canonical responsive matrix (5 tiers + per-tier shell + per-tier content patterns), and a `.R` responsive sub-task in every screen phase (5–10). Phase 11 split into cross-viewport QA + touch/gesture QA. |
|  |  |  |  |

---

## 10. Quick reference (read this every session)

1. Check Section 9 for last task done.
2. Find next unchecked `[ ]` task in Section 6.
3. Use the **assigned model** for that task. Override only with reason logged in Section 9.
4. Implement → run `npm run ci:check` → push to `design-v2`.
5. Update the checkbox in Section 6 + add a row in Section 9.
6. If gate reached, ping user for sign-off before proceeding.
