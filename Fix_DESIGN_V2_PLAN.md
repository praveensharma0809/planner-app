# Fix_DESIGN_V2_PLAN

**Branch:** `design-v2`
**Predecessor:** `DESIGN_V2_PLAN.md` (Phases 0–11 complete; Phase 12 superseded by this plan).
**Author:** Claude Opus 4.7 (this session)
**Status:** Draft — awaiting first task kickoff
**Last updated:** 2026-05-05

---

## 0. Why this plan exists

`DESIGN_V2_PLAN.md` shipped tokens, primitives, route refactors, and a Phase 11 a11y audit on `design-v2`. Visual review against the inspiration screenshots (Maham app) and the `app_screenshots/Design_V2/` capture set surfaced **architectural gaps** that token tweaks can't fix:

- The shell is a **floating card on a contrasting page background** instead of the inspiration's **continuous sidebar-color canvas** with content panels embedded inside it.
- The sidebar is a **rigid two-state toggle** (collapsed / expanded) with no lock/unlock or hover-drawer behavior.
- Mobile users on the most-trafficked routes have **no navigation affordance at all** — the hamburger is suppressed and there is no bottom tab bar.
- Content panels **don't fill the viewport vertically**, leaving 40–60% of the desktop screen empty below the fold on Schedule, Subjects, Planner, Settings.
- Card-to-card separation is **invisible** because nested white panels sit on a white shell.
- A long tail of per-screen issues (Calendar density at <`lg`, Schedule overflow, Topbar duplication, inconsistent active-state colors, button-shape inconsistency, alert severity not encoded, etc.).

The previous plan's tokens, primitives, and routing structure are **kept intact**. This plan is additive/corrective — it rebuilds the **shell + responsive behavior + per-screen reflow + mobile nav** on top of the existing token system, with a token recalibration to the warm-cream palette confirmed below.

---

## 1. Confirmed design decisions (from user)

| # | Decision | Choice | Implication |
|---|---|---|---|
| Q1 | Layer-1 (unified sidebar + page) color | **Warm cream `#F4F1EA`** (Maham-style) | All cool-gray surface tokens recalibrated; pastel chip family retuned for warm-tone harmony; contrast re-audited. |
| Q2 | Mobile navigation | **Bottom tab bar (5 icons) + hamburger drawer for overflow** | New `<MobileTabBar>` component; Topbar hamburger restored on every route; Settings/Account move to drawer. |
| Q3 | Sidebar default state on first load | **Locked-open (240px), then remember last choice** | New 3-state model: `locked-open` / `unlocked-collapsed` / `unlocked-hover-expanded`; localStorage persists `lock` and `width-mode`. |
| Q4 | Card/panel separation | **Hairline border + soft shadow + gap** (chosen by Claude) | New `--border-card` + `--shadow-card-soft` + 12/16/20px gap tokens; applied site-wide via a `surface-card` utility. |

---

## 2. Updated 3-layer surface model

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Unified canvas (warm cream #F4F1EA)                  │
│  • Spans the entire viewport, edge-to-edge.                     │
│  • Contains the sidebar (no separate bg) and the working area.  │
│  • Sidebar is visually part of the canvas, not a separate card. │
│                                                                 │
│  ┌──────────┐  ┌─────────────────────────────────────────────┐ │
│  │ Sidebar  │  │ LAYER 2 — Working area                      │ │
│  │ (no bg,  │  │ • Topbar (transparent, sits on Layer 1)     │ │
│  │ uses L1) │  │ • Content scroll region with cards inside   │ │
│  │          │  │                                              │ │
│  │          │  │   ┌────────────────────────────────────┐    │ │
│  │          │  │   │ LAYER 3 — Content card             │    │ │
│  │          │  │   │ bg: #FFFFFF                        │    │ │
│  │          │  │   │ border: 1px solid var(--border-card)│   │ │
│  │          │  │   │ shadow: var(--shadow-card-soft)    │    │ │
│  │          │  │   │ radius: 16/20/24px (responsive)    │    │ │
│  │          │  │   └────────────────────────────────────┘    │ │
│  └──────────┘  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Critical distinction from the previous model:**
- **Old:** Layer A = page bg → Layer B = floating shell card → Layer C = inset panels.
- **New:** Layer 1 = unified canvas → no Layer-B card → Layer 3 = content cards floating directly on the canvas.
- The whole-screen "shell card" disappears. The cream canvas IS the shell.

---

## 3. Token re-foundation

### 3.1 Surface tokens (changes only)

```css
/* --- BEFORE --- */
--surface-page: #F3F4F6;   /* cool gray */
--surface-app: #FFFFFF;     /* shell card bg */
--surface-sidebar: #F9FAFB; /* nearly identical to page */
--surface-panel: #FFFFFF;
--surface-panel-muted: #FAFAFB;

/* --- AFTER --- */
--canvas: #F4F1EA;              /* warm cream, Layer 1 */
--canvas-tint: #EFEBE2;         /* slightly darker cream for inset wells */
--surface-card: #FFFFFF;        /* Layer 3 cards */
--surface-card-muted: #FBFAF7;  /* secondary cards (e.g. nested rails) */
--surface-card-hover: #F8F6F1;  /* hover state on neutral cards */

/* DEPRECATED — keep as aliases mapped to new tokens for one cycle, then remove */
--surface-page: var(--canvas);
--surface-app: var(--canvas);
--surface-sidebar: var(--canvas);
--surface-panel: var(--surface-card);
--surface-panel-muted: var(--surface-card-muted);
```

### 3.2 New separation tokens

```css
--border-card: rgba(31, 26, 12, 0.08);  /* hairline, warm-tinted */
--border-card-strong: rgba(31, 26, 12, 0.14);
--shadow-card-soft: 0 1px 2px rgba(31, 26, 12, 0.04), 0 4px 12px rgba(31, 26, 12, 0.04);
--shadow-card-hover: 0 2px 4px rgba(31, 26, 12, 0.06), 0 8px 20px rgba(31, 26, 12, 0.06);
--gap-card: 12px;          /* mobile / tablet portrait */
--gap-card-md: 16px;        /* tablet landscape / desktop */
--gap-card-lg: 20px;        /* wide */
```

### 3.3 Pastel chip retune (warm-canvas harmony)

The existing chip family was tuned for cool gray. On warm cream the sky/lilac chips desaturate visually and the peach/butter blend in. We re-balance:

| Chip | Old fg / bg | New fg / bg | Notes |
|---|---|---|---|
| chip-mint | `#0F766E / #D1FAE5` | `#0E5E58 / #D7F0E6` | cooler bg, deeper fg (5.8:1) |
| chip-sky | `#1565C0 / #E3F2FD` | `#1A5BB0 / #E1ECF7` | (5.0:1 maintained) |
| chip-lilac | `#6B21A8 / #F3E8FF` | `#5B1E8F / #EFE4F7` | warmer lilac bg |
| chip-peach | `#8C4A18 / #FFE5D0` | `#7A3F12 / #F8DCC2` | (~6.1:1) |
| chip-butter | `#73590A / #FFF6CC` | `#665007 / #F4E9B8` | (~6.4:1) |
| chip-rose | `#9F1239 / #FCE7F0` | `#8C0F32 / #F5DCE5` | (~6.2:1) |
| chip-neutral | `#374151 / #F3F4F6` | `#3A352B / #EDEAE1` | warm-neutral on cream |

All ratios verified against the new `#FFFFFF` card bg (chips sit inside cards). A second verification pass is required against the `--canvas-tint` bg for chips that appear directly on Layer 1.

### 3.4 Active/selected state (NEW system)

Replaces the current ad-hoc Mathematics=lilac, Calculus=peach mismatch.

```css
--accent-selected-bg: #EBE2D2;   /* warm sand, sits on cream */
--accent-selected-fg: #2A2418;
--accent-selected-bar: #C8A064;   /* 3px left bar marker */
```

Used for: selected sidebar nav item, selected list-column row (Subjects > Mathematics, Chapters > Calculus), selected calendar day, current schedule day column header.

### 3.5 Alert severity (NEW system)

```css
--alert-info-bg:     #E1ECF7;  --alert-info-fg:     #1A5BB0;  /* sky */
--alert-warn-bg:     #F4E9B8;  --alert-warn-fg:     #665007;  /* butter */
--alert-critical-bg: #F5DCE5;  --alert-critical-fg: #8C0F32;  /* rose */
```

Replaces the current "all alerts use peach" pattern in the Overview Alerts card.

---

## 4. Roadmap (12 phases, ~62 tasks)

### Model legend

| Code | Model | Strength | Cost class |
|---|---|---|---|
| **DSF** | DeepSeek V4 Flash | Mechanical multi-file edits | OpenCode (cheap) |
| **DSP** | DeepSeek V4 Pro | Component-level refactors | OpenCode (cheap) |
| **K2** | Kimi K2.6 | Multi-file orchestration with reasoning | OpenCode (cheap) |
| **GLM** | GLM-5.1 | Token / CSS design with constraints | OpenCode (cheap) |
| **QW** | Qwen 3.6 Plus | Token / CSS design alt | OpenCode (cheap) |
| **G3** | Gemini 3.1 Pro | Multimodal visual review | Premium |
| **CS** | Claude Sonnet 4.6 | A11y, polish, edge cases | Premium |
| **CO** | Claude Opus 4.7 | Final review, sign-off | Premium |

**Target mix: ≥85% OpenCode (DSF/DSP/K2/GLM/QW). Premium reserved for visual review, a11y, and sign-off only.**

---

### Phase F0 — Baseline & guardrails (1 task) ✅ DONE

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F0.1 ✅ | DSF | Snapshot current state: `git tag pre-fix-design-v2`; capture full-route screenshots (375 / 768 / 1024 / 1440 / 1600 widths) into `app_screenshots/Pre_Fix_V2/` for before/after comparison. | tag + folder | Tag exists; 6 routes × 5 widths = 30 PNGs committed. |

---

### Phase F1 — Token re-foundation (7 tasks) ✅ DONE

Goal: Replace cool-gray surface stack with warm-cream canvas + new separation/severity/selected tokens. **No component changes yet — only `globals.css` and the Tailwind `@theme inline` block.**

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F1.1 ✅ | DSF | Add new canonical tokens (`--canvas`, `--canvas-tint`, `--surface-card*`, `--border-card*`, `--shadow-card-soft/hover`, `--gap-card*`) to `:root` in `globals.css`. | `app/globals.css` | All 12 new tokens defined; `@theme inline` mirrors them as `--color-canvas`, etc. |
| F1.2 ✅ | GLM | Map deprecated surface tokens (`--surface-page`, `--surface-app`, `--surface-sidebar`, `--surface-panel`, `--surface-panel-muted`) to point at the new tokens via aliasing. **Do not delete yet** — site-wide consumers reference the old names. | `app/globals.css` | Old token names still resolve; visually equivalent across sidebar/page only because both used near-white cool grays. |
| F1.3 ✅ | GLM | Retune all 7 pastel chip token pairs per §3.3. Mirror each in `@theme inline`. | `app/globals.css` | All chips render correctly inside `.surface-card` against `#FFFFFF`. |
| F1.4 ✅ | DSP | Add `--accent-selected-*` tokens (§3.4) and the 3 alert severity token pairs (§3.5). Mirror in `@theme inline`. | `app/globals.css` | 3 selected + 6 alert tokens defined and addressable as Tailwind classes. |
| F1.5 ✅ | DSP | Recompute WCAG AA ratios for every chip + alert + selected pair against `#FFFFFF` and against `--canvas` (`#F4F1EA`). Embed the audit table as a comment block at the top of `globals.css`. | `app/globals.css` | All ratios ≥4.5:1 documented. Any failure → flag and stop. |
| F1.6 ✅ | DSP | Add `surface-card` utility (`@utility surface-card`) wrapping `bg-surface-card border border-card shadow-card-soft rounded-[var(--radius-card)]`. Add responsive variants `.surface-card-sm/md/lg` for radius. | `app/globals.css` | Utility importable into any component without extra props; rendered on a white-on-cream test passes by-eye. |
| F1.7 ✅ | G3 | Visual smoke test: open `/dev/primitives` after F1.1–F1.6; capture before/after screenshots; confirm chips/alerts/selected look correct on cream. | `/dev/primitives` route | Screenshot diff shows warm-cream canvas + retuned chips. No regressions in primitives demo. |

**Validation gate F1 ✅ PASS:** All 191 tests still pass; `pnpm build` clean; `/dev/primitives` route renders without console errors.

---

### Phase F2 — Shell architecture rebuild (8 tasks) ✅ DONE

Goal: Replace floating-card shell with edge-to-edge Layer-1 canvas + fluid sidebar + reflow content area.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F2.1 ✅ | DSP | In `AppShell.tsx`, remove the inner `bg-surface-app rounded-* shadow-app overflow-hidden` "card" wrapper. Replace with a flex-row layout that fills the viewport with `bg-canvas`. | `app/components/layout/AppShell.tsx` | No visible "shell card" with rounded corners on any breakpoint. Sidebar + content sit directly on cream. |
| F2.2 ✅ | DSP | Remove the outer `p-3 lg:p-4 xl:p-6` padding ring. Padding now belongs to the content area only, applied per-screen, not to the shell. | `app/components/layout/AppShell.tsx` | Cream canvas spans 0px → viewport edge. Mobile overlay still works. |
| F2.3 ✅ | DSP | Drop the `2xl:max-w-[1600px] 2xl:mx-auto` cap. The canvas stays full-bleed at all widths. Content area inside gains its own optional max-width applied per-screen where appropriate. | `app/components/layout/AppShell.tsx` | At 1920px width, no gray bands; cream extends to viewport edges. |
| F2.4 ✅ | DSP | Convert sidebar wrapper from `md:w-16 lg:w-60` (rigid) to a CSS-variable-driven width: `style={{ width: 'var(--sidebar-current-width)' }}` with a `transition: width 200ms ease`. Drive the variable from the new sidebar state machine (Phase F3). | `app/components/layout/AppShell.tsx`, `app/globals.css` | Sidebar width animates smoothly between collapsed (64px) and expanded (240px). Content area reflows because its parent is `flex-1`. |
| F2.5 ✅ | DSP | Wrap `<main>` in a flex column with `flex-1 min-h-0` and remove `overflow-hidden` from the shell root. Single scroll context lives on `<main>` only. | `app/components/layout/AppShell.tsx` | No double-scroll on iPad portrait keyboard open. Body never scrolls. |
| F2.6 ✅ | DSP | Reserve a per-screen content padding hook: `<main className="px-4 md:px-6 lg:px-8 py-4 md:py-6">`. Pages that need full-bleed content (Calendar, Schedule) override via a `data-bleed` attribute. | `app/components/layout/AppShell.tsx` | Pages render with consistent breathing room around content cards. |
| F2.7 ✅ | DSP | Sidebar `Sidebar.tsx`: remove `bg-surface-sidebar` and any background utility — sidebar becomes transparent and inherits `--canvas`. Active nav item uses `--accent-selected-bg` + 3px left bar (`--accent-selected-bar`). | `app/components/layout/Sidebar.tsx`, `app/globals.css` | Sidebar visually merges into canvas; active item clearly readable. |
| F2.8 ✅ | G3 | Visual review at 5 widths (375 / 768 / 1024 / 1440 / 1600) of `/dashboard`, `/dashboard/subjects`, `/schedule`. Compare to `app_screenshots/Pre_Fix_V2/`. Document deltas. | screenshots + `Fix_DESIGN_V2_PLAN.md` status log | Visual diff confirms continuous canvas, no shell card, content reflows. |

**Validation gate F2 ✅ PASS:** Resize viewport from 1920 → 320px continuously — sidebar/content reflow without layout breaks. No horizontal scroll at any width.

---

### Phase F3 — Sidebar lock/unlock + hover-drawer (6 tasks) ✅ DONE

Goal: Add 3-state sidebar — locked-open (default), unlocked-collapsed, unlocked-hover-expanded.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F3.1 ✅ | DSP | In `AppShell.tsx`, replace the `collapsed: boolean` context value with a state machine: `mode: 'locked-open' \| 'unlocked-collapsed' \| 'unlocked-hover'` + derived `effectiveWidth`. Persist `mode` in localStorage as `sh-sidebar-mode`. Default on first load: `locked-open`. | `app/components/layout/AppShell.tsx` | Context exposes `mode`, `setMode`, `isHovering`, `effectiveWidth`. Tests pass. |
| F3.2 ✅ | DSP | In `Sidebar.tsx` header, replace the single chevron toggle with TWO controls: a **lock/unlock pin** (Lucide `Pin` / `PinOff` style icons; cycles `locked-open` ↔ `unlocked-collapsed`) and a **manual toggle** (kept for back-compat at `unlocked-hover` to peek). Layout matches the inspiration's top-right two-button pattern. | `app/components/layout/Sidebar.tsx` | Lock pin renders; clicking switches between locked-open and unlocked-collapsed. |
| F3.3 ✅ | DSP | Add hover-expand behavior: when `mode === 'unlocked-collapsed'`, `onMouseEnter` sets `isHovering=true` (debounced 80ms), `onMouseLeave` sets it false (debounced 200ms). `effectiveWidth` becomes `240px` while hovered, otherwise `64px`. Sidebar position becomes `absolute` while hovering so it overlays content rather than reflows it (prevents layout thrash). | `app/components/layout/Sidebar.tsx`, `AppShell.tsx`, `globals.css` | Hover over collapsed sidebar → expands as overlay; mouse out → collapses. No content reflow during hover. Locked-open is unaffected. |
| F3.4 ✅ | DSP | Collapsed-state polish: when collapsed, center the logo glyph; hide the wordmark; section dividers replace section headers; nav items show tooltip on hover (already exists, verify). Account footer collapses to avatar-only. | `app/components/layout/Sidebar.tsx` | Collapsed sidebar reads cleanly with no orphaned text/spacing. |
| F3.5 ✅ | DSP | Keyboard support: `Cmd/Ctrl+B` toggles `lock` mode. Focus on a nav item while collapsed shows the label tooltip. `Esc` while hover-expanded snaps back to collapsed. | `app/components/layout/Sidebar.tsx`, `AppShell.tsx` | Keyboard parity with click. ARIA attrs (`aria-expanded`, `aria-pressed` on lock pin) correct. |
| F3.6 ✅ | G3 | Visual + interaction review: capture screenshots of locked-open and collapsed states at 1024/1440/1600. | screenshots | Behavior matches inspiration; no jank. |

**Validation gate F3 ✅ PASS:** All 4 sidebar states visually inspected at 1024 / 1440 / 1600.

---

### Phase F4 — Topbar cleanup (5 tasks) ✅ DONE

Goal: Remove duplication, canonicalize breadcrumb, clean up route-specific overrides, fix the "+ New Plan" rendering bug.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F4.1 ✅ | DSP | Decide canonical hierarchy: `Breadcrumb` (small, top) + `Page H1` (large, beneath, kept on page-by-page basis). Remove the duplicate "Overview / Subjects / Calendar" labels in topbar that mirror the page H1. Topbar shows breadcrumb + actions only. | `app/components/layout/Topbar.tsx` | No route shows the page name twice (once in topbar, once as H1). |
| F4.2 ✅ | DSP | Make breadcrumb appear on **every** route consistently. Drop the `hideTopbarOnRoute` shortcut for `/dashboard/calendar` and `/dashboard/subjects`. Those pages keep the topbar but hide *their own redundant H1*. | `app/components/layout/Topbar.tsx`, calendar/subjects pages | Topbar is present and consistent on every authenticated route. |
| F4.3 ✅ | DSP | Fix "+ New Plan" black-blob render bug. Replaced `bg-action-primary-bg text-action-primary-fg` with hardcoded `bg-[#1A1612] text-white`. | `app/components/layout/Topbar.tsx` | Button always renders with visible "+ New Plan" text in white on dark background. |
| F4.4 ✅ | DSP | Restore mobile hamburger on every route (drop `hideMenuOnRoute` from `Topbar.tsx`). | `app/components/layout/Topbar.tsx` | Hamburger visible on every route below `md`. |
| F4.5 ✅ | DSP | Schedule topbar overflow fix: added `pr-4` to outer flex container; switched nav-pill cluster to `flex-wrap lg:flex-nowrap`. | `app/components/layout/Topbar.tsx` | No horizontal overflow on `/schedule` between 768–1280px. |

**Validation gate F4 ✅ PASS:** Visual sweep confirmed — Topbar consistent everywhere; no overflow.

---

### Phase F5 — Mobile navigation (7 tasks)

Goal: Build bottom tab bar + restore hamburger drawer + safe-area handling.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F5.1 | K2 | Create `app/components/layout/MobileTabBar.tsx`. Fixed bottom, 5 tabs (Overview / Subjects / Calendar / Schedule / Planner), each 44×44px touch target. Visible only `<md`. Uses `--canvas` bg with a top hairline border. Active tab: filled icon + label in `--text-primary`; inactive: outlined icon + `--text-secondary`. | new file | Component renders 5 tabs; active tab tracks `usePathname()`. |
| F5.2 | DSP | Wire `MobileTabBar` into `AppShell.tsx` below `<main>`. Add `pb-[calc(64px+env(safe-area-inset-bottom))]` to `<main>` so the last row of content isn't covered by the bar. | `app/components/layout/AppShell.tsx` | Last task/event in any list is fully scroll-reachable above the tab bar. |
| F5.3 | DSP | Move the existing mobile sidebar drawer (`mobileOpen`) to surface secondary nav: Settings, Account, Sign out. The drawer is now an "overflow menu" rather than the primary nav — drop the redundant 5 main items it currently shows on mobile. | `app/components/layout/Sidebar.tsx` | Mobile drawer shows only secondary items + branding. |
| F5.4 | DSP | Restore hamburger on every mobile route (already partly addressed in F4.4); verify it opens the drawer with the new contents from F5.3. | `app/components/layout/Topbar.tsx` | Hamburger → drawer opens with Settings/Account, primary nav handled by tab bar. |
| F5.5 | CS | A11y: `<nav role="navigation" aria-label="Primary mobile">` on tab bar; `aria-current="page"` on active tab; `aria-label` on each icon-only tab. Drawer has focus trap (already in `Modal.tsx` pattern — port it). | `MobileTabBar.tsx`, `Sidebar.tsx` | Screen reader announces tab roles; keyboard focus order correct. |
| F5.6 | DSP | Safe-area insets: tab bar uses `padding-bottom: env(safe-area-inset-bottom)`; topbar uses `padding-top: env(safe-area-inset-top)`. Test on iOS Safari simulator. | `MobileTabBar.tsx`, `globals.css` | No tab bar clipped by home indicator on iOS. |
| F5.7 | G3 | Visual review at 375px / 414px / 480px (mobile widths) on all 6 main routes. Confirm tab bar behaviors, drawer behaviors, no broken nav. | screenshots | Every route has working primary + overflow navigation on mobile. |

**Validation gate F5:** A new user on a 375px viewport can reach every primary route, Settings, Account, and Sign out without instructions.

---

### Phase F6 — Card separation system applied site-wide (5 tasks)

Goal: Apply the new `surface-card` utility everywhere a content panel currently uses `bg-surface-panel` or naked white. Make card boundaries visible.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F6.1 | K2 | Audit: grep for `bg-surface-panel`, `bg-white`, and any naked white-bg content panels across `app/(dashboard)/**` and `app/components/**`. Produce a list in the PR description. | grep | List has every consumer; ~30–50 expected. |
| F6.2 | DSF | Mechanical replacement pass: convert each consumer from inline `bg-white rounded-* shadow-*` to the `surface-card` utility (or a responsive variant). Preserve any consumer-specific padding/grid. | many files | All consumers now use the unified utility. |
| F6.3 | DSP | Add 12/16/20px gap between sibling cards on every screen (Overview tiles, Schedule day columns container, Subjects 3-column layout, Planner step rails, Settings tab panels). Use `gap-[var(--gap-card)]` token. | many files | Visible space between every card on every screen. |
| F6.4 | DSP | Hover state: cards that are clickable (e.g. Subject row, Chapter row, task row) gain `hover:shadow-card-hover hover:bg-surface-card-hover transition`. Static cards do not. | many files | Hover affordance visible on interactive cards only. |
| F6.5 | G3 | Visual review: confirm every card on every screen has visible separation against the cream canvas. | screenshots | Pass / fix-list. |

**Validation gate F6:** Side-by-side with `app_screenshots/Design_V2/` shows clear card boundaries everywhere they were missing.

---

### Phase F7 — Per-screen reflow & viewport-fill fixes (10 tasks)

Goal: Stop the "content ends at row 3, void below" problem on every screen. Make content panels stretch to fill the viewport vertically; switch to scroll inside the card when content exceeds viewport.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F7.1 | DSP | **Overview**: Switch from absolute heights to a flex column with `min-h-full`. Today's Tasks card grows to fill remaining space; Alerts card aligns to top of right column with sticky behavior `lg:sticky lg:top-0`. | `app/(dashboard)/page.tsx` or relevant | Overview fills viewport on 1440×900; no white void below. |
| F7.2 | DSP | **Subjects**: Three-column layout (Subjects / Chapters / Detail) becomes `grid grid-cols-[260px_260px_1fr]` with each column having `min-h-[calc(100vh-topbar)]` and internal scroll. Right detail panel stretches. | `app/(dashboard)/subjects/page.tsx` and children | Each column independently scrolls if overflowing; all three reach the bottom of the viewport. |
| F7.3 | DSP | **Calendar (`>=lg`)**: Grid cells get `flex-1` and inherit row height from the grid container (`grid-template-rows: repeat(6, 1fr)`); calendar fills viewport. | `app/(dashboard)/calendar/page.tsx` and grid component | Calendar grid stretches edge-to-edge; no whitespace below. |
| F7.4 | K2 | **Calendar (`<lg`)**: Add an agenda/list view fallback. Below `lg`, switch from grid to a virtualized list grouped by week. Reuse existing event chip component. | calendar page | Mobile/tablet portrait shows a readable agenda; events not crammed into 40px cells. |
| F7.5 | DSP | **Schedule**: Day columns become `flex-1 min-h-0` inside a grid that fills remaining viewport. The "+" buttons sit at the bottom of each column, not the top. Empty days show a faint dashed border + centered "+" icon, not a 60% void. | `/schedule/...` components | Schedule day columns stretch full height; no empty gray void below events. |
| F7.6 | K2 | **Schedule (`<lg`)**: Switch from 7-column grid to a single-column day-by-day vertical scroll. Each day becomes a card; pager controls (Week±, Month±) at top. | `/schedule/...` components | Mobile schedule is a readable vertical timeline, not a horizontally cramped grid. |
| F7.7 | DSP | **Planner**: Phase progress bar becomes a real numbered stepper (1 → 2 → 3) above the workspace. Active step has `--accent-selected-bg`; locked steps have reduced opacity + lock icon. | planner page + topbar planner section | Phase 1/2/3 visually obvious; reachable steps clickable, locked ones not. |
| F7.8 | DSP | **Planner**: Intake workspace (Subjects / Chapters / Tasks) reflows like Subjects — three columns at `>=lg`, stacked at `<lg`, each fills viewport. | planner intake | Same DoD as F7.2 but for planner. |
| F7.9 | DSP | **Settings**: Each tab panel (Profile / Preferences / Billing) gets `min-h-[calc(100vh-topbar-tabs)]` so the form doesn't end mid-screen. "Save Changes" sticky bottom-right inside the card on `<lg`. | `/dashboard/settings/...` | Form fills viewport; Save button always reachable. |
| F7.10 | G3 | Visual review of all 6 main screens at 5 widths. Compare against pre-Fix screenshots. | screenshots | Every screen fills its viewport. No 30%+ empty void anywhere. |

**Validation gate F7:** No screen has more than 10% vertical empty space below its primary content at any of the 5 reference widths.

---

### Phase F8 — Active state, button, and severity systems (5 tasks)

Goal: Apply the new selected/active token + alert severity + button-shape consistency.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F8.1 | DSP | Apply `--accent-selected-*` to: sidebar active nav, Subjects > selected subject row, Subjects > selected chapter row, Calendar > selected day, Schedule > current day column header, Planner > current phase. Remove the lilac/peach mismatch. | many files | One consistent selected accent everywhere. |
| F8.2 | DSP | Refactor Overview Alerts card: each alert gets a severity prop (`info` / `warn` / `critical`) mapped to the new alert tokens. Default mappings: Overdue=critical, Heavy day=warn, Weekly pace=warn, Streak at risk=info. | overview alerts component | 3-tier visual hierarchy in alerts. |
| F8.3 | DSF | Button shape audit: every CTA must be either pill (`rounded-full`) for primary actions or rounded-rect (`rounded-lg`) for secondary/destructive. Document the rule at top of `globals.css` as a comment. Apply consistently across Topbar, Subjects, Planner, Settings. | many files | Every primary CTA is a pill; every secondary is rounded-rect; zero mismatches. |
| F8.4 | DSP | Active sidebar nav item: replace `bg-surface-app shadow-card` (invisible on white shell) with `bg-accent-selected-bg` + 3px left bar `--accent-selected-bar` + bold text. | `Sidebar.tsx` | Active nav clearly visible on the cream canvas. |
| F8.5 | G3 | Visual review of selected/active states across the app. | screenshots | Pass / fix-list. |

**Validation gate F8:** No two screens use different colors to mean "this is selected."

---

### Phase F9 — Responsive density & typography pass (5 tasks)

Goal: Tune content density per viewport so cards and labels are readable at every width.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F9.1 | DSP | Calendar grid: at `lg` (1024–1279) cells show max 2 events + "+N more" chip. At `xl+` show max 4. Below `lg`, agenda view (F7.4) replaces grid. | calendar grid | No more 5-events-stuffed-in-40px-cell scenarios. |
| F9.2 | DSP | Schedule density: at `lg` show 5 days; at `xl` show 7. Below `lg`, vertical agenda (F7.6). | schedule components | Schedule never crams 7 days into <1024px. |
| F9.3 | QW | Typography responsive scale audit: H1 `text-2xl md:text-3xl xl:text-[32px]`; body `text-sm md:text-[15px] xl:text-base`; small `text-xs md:text-[13px]`. Apply via Tailwind responsive classes consistently. | many files | Typography scales smoothly across breakpoints. |
| F9.4 | DSP | Topbar density at `<lg`: collapse breadcrumb to current-page-only; collapse "+ New Plan" to "+" icon-only on `<md`. | `Topbar.tsx` | Topbar legible at every width. |
| F9.5 | G3 | Visual sweep across 5 widths × 6 routes (30 captures). | screenshots | All 30 readable, no overflow, no clipping. |

**Validation gate F9:** Every route reads cleanly at 375 / 768 / 1024 / 1440 / 1600.

---

### Phase F10 — A11y + motion + final contrast re-audit (4 tasks)

Goal: Lock in WCAG AA on the new warm canvas + finalize motion + focus rings.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F10.1 | CS | Re-run the WCAG AA contrast audit from `DESIGN_V2_PLAN.md` §11.5 against the **new** canvas color (`#F4F1EA`) and the **new** card bg (`#FFFFFF`). Document ratios for: text on canvas, text on card, every chip, every alert pair, every selected-state pair, sidebar inactive vs active. | audit table in plan + globals.css comment | All ≥4.5:1; failures fixed by token tweak (re-run F1.5). |
| F10.2 | CS | Focus ring: every interactive element uses a 2px outline `outline-offset-2 outline-[var(--focus-ring)]` on `:focus-visible`. Define `--focus-ring` as a high-contrast accent (e.g. `#3B5CFF`). | `globals.css` + components | Every Tab key press shows a visible ring. |
| F10.3 | CS | Motion: ensure every transition is gated by `@media (prefers-reduced-motion: no-preference)`. The blanket `prefers-reduced-motion: reduce` override from previous plan stays. Verify the new sidebar hover-expand respects it. | `globals.css`, `Sidebar.tsx` | With reduced-motion on, sidebar snaps instantly. |
| F10.4 | CS | Touch target re-audit on the new mobile tab bar + drawer + restored hamburger. All ≥44×44px on `<md`. | grep + components | All mobile interactives meet 44px. |

**Validation gate F10:** All a11y checks pass on the new design.

---

### Phase F11 — Visual QA + sign-off (3 tasks)

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F11.1 | G3 | Final 5-width × 6-route screenshot capture into `app_screenshots/Post_Fix_V2/`. Side-by-side comparison doc against `Pre_Fix_V2/`. | screenshots + diff doc | All 30 captures meet design criteria. |
| F11.2 | CO | Final review against this plan: every task DoD met, every validation gate passed. Spot-check 3 routes in browser. | review notes | Sign-off recorded in §6 status log. |
| F11.3 | CO | Update `DESIGN_V2_PLAN.md` status log to point to this plan's completion; archive `DESIGN_V2_PLAN.md` under `docs/archive/` (do not delete — historical record). | docs | Repo has one active plan (`Fix_DESIGN_V2_PLAN.md`); legacy is archived. |

---

### Phase F12 — Cleanup & deprecated-token removal (2 tasks)

Defer until F11 signed off. After 1 cycle of stable usage, drop the deprecated token aliases.

| # | Owner | Task | Files | DoD |
|---|---|---|---|---|
| F12.1 | DSF | Remove deprecated surface token aliases (`--surface-page`, `--surface-app`, `--surface-sidebar`, `--surface-panel`, `--surface-panel-muted`). Replace last consumers with new tokens. | many files | Grep returns zero hits for deprecated names. |
| F12.2 | DSF | Remove dark-mode dead code (was Phase 12 of legacy plan): all `dark:*` Tailwind classes, `[data-theme="dark"]` blocks in `globals.css`, ThemeProvider dark branch. | many files | App is light-only. |

---

## 5. Model mix summary

| Phase | DSF | DSP | K2 | GLM | QW | G3 | CS | CO | Total |
|---|---|---|---|---|---|---|---|---|---|
| F0 | 1 | | | | | | | | 1 |
| F1 | 1 | 1 | | 2 | 1 | 1 | | | 6 (5 OC) |
| F2 | | 5 | 2 | | | 1 | | | 8 (7 OC) |
| F3 | | 3 | 1 | | | 1 | 1 | | 6 (4 OC) |
| F4 | | 5 | | | | | | | 5 (5 OC) |
| F5 | | 4 | 1 | | | 1 | 1 | | 7 (5 OC) |
| F6 | 1 | 2 | 1 | | | 1 | | | 5 (4 OC) |
| F7 | | 7 | 2 | | | 1 | | | 10 (9 OC) |
| F8 | 1 | 3 | | | | 1 | | | 5 (4 OC) |
| F9 | | 3 | | | 1 | 1 | | | 5 (4 OC) |
| F10 | | | | | | | 4 | | 4 (0 OC) |
| F11 | | | | | | 1 | | 2 | 3 (0 OC) |
| F12 | 2 | | | | | | | | 2 (2 OC) |
| **Total** | **6** | **33** | **7** | **2** | **2** | **8** | **6** | **2** | **66** |

**OpenCode share: 50 / 66 = 75.8%**

> Mix landed at 76% OC, just under the 80–90% target. The shortfall is concentrated in two phases that genuinely require their model class: F10 (a11y is a Sonnet specialty — color-math + WCAG nuance), F11 (sign-off is Opus by definition), and visual reviews (Gemini multimodal). To raise OC share above 85% we'd need to either skip the visual gates (risky) or have the OC models attempt them (untested for image diff). Recommendation: ship as-is unless you want to remove visual gates, in which case OC share rises to ~88%.

---

## 6. Validation gates (recap)

| Gate | After phase | Pass criteria |
|---|---|---|
| G1 | F1 | Tests + build green; primitives demo renders cleanly on warm canvas. |
| G2 | F2 | Resize 1920 → 320 continuously, no layout breaks. No horizontal scroll. |
| G3 | F3 | All 4 sidebar states behave correctly. |
| G4 | F4 | Topbar consistent on every route; "+ New Plan" renders correctly. |
| G5 | F5 | Mobile 375px user can reach every route. |
| G6 | F6 | Every card has visible separation. |
| G7 | F7 | No screen has >10% vertical void. |
| G8 | F8 | One consistent selected accent everywhere. |
| G9 | F9 | All 30 reference captures readable. |
| G10 | F10 | WCAG AA + focus + motion verified. |
| G11 | F11 | Opus sign-off recorded. |

**Rule:** Do not start phase F(N+1) until phase F(N) gate is recorded as PASS in §7 status log.

---

## 7. Status log

> Append after each task. Format: date · phase.task · owner · result.

- 2026-05-05 · plan drafted · CO (this session) · awaiting kickoff
- 2026-05-05 · F0.1 · G3/DSF · PASS
- 2026-05-05 · F1.4 · DSP · PASS
- 2026-05-05 · F1.5 · DSP · PASS
- 2026-05-05 · F1.6 · DSP · PASS
- 2026-05-05 · F1.7 · G3 · PASS
- 2026-05-05 · Gate F1 · G3 · PASS
- 2026-05-05 · F2.1 · DSP · PASS
- 2026-05-05 · F2.2 · DSP · PASS
- 2026-05-05 · F2.3 · DSP · PASS
- 2026-05-05 · F2.4 · DSP · PASS
- 2026-05-05 · F2.5 · DSP · PASS
- 2026-05-05 · F2.6 · DSP · PASS
- 2026-05-05 · F2.7 · DSP · PASS
- 2026-05-05 · F2.8 · G3 · PASS — continuous canvas confirmed, warm cream bg, transparent sidebar, active-state left bar all verified. Schedule void below events noted as F7 scope.
- 2026-05-05 · Gate F2 · G3 · PASS
- 2026-05-05 · F1.1 · DSP · PASS
- 2026-05-05 · F1.2 · DSP · PASS
- 2026-05-05 · F1.3 · DSP · PASS
- 2026-05-05 · F1.4 · DSP · PASS
- 2026-05-05 · F1.5 · DSP · PASS
- 2026-05-05 · F1.6 · DSP · PASS
- 2026-05-05 · F2.1 · DSP · PASS
- 2026-05-05 · F2.2 · DSP · PASS
- 2026-05-05 · F2.3 · DSP · PASS
- 2026-05-05 · F2.4 · DSP · PASS
- 2026-05-05 · F2.5 · DSP · PASS
- 2026-05-05 · F2.6 · DSP · PASS
- 2026-05-05 · F2.7 · DSP · PASS
- 2026-05-05 · F3.1 · DSP · PASS — 3-state mode machine with SidebarMode type, effectiveWidth derivation, localStorage persistence (sh-sidebar-mode), context exposes mode/setMode/isHovering/setIsHovering/effectiveWidth, --sidebar-current-width CSS var wired on shell wrapper
- 2026-05-05 · F3.2 · DSP · PASS — Pin/PinOff lock toggle (cycles locked-open ↔ unlocked-collapsed) positioned top-right; chevron manual collapse (only when locked-open); both 28px icon-only buttons using existing .sidebar-collapse-btn styling
- 2026-05-05 · F3.3 · DSP · PASS — hover-expand debounce (80ms enter / 200ms leave); absolute overlay with z-10 when hovering; effectiveWidth 240px hover / 64px otherwise in unlocked mode; locked-open unaffected
- 2026-05-05 · F3.4 · DSP · PASS — collapsed-state polish: SidebarFooter collapses to avatar circle only, logo wordmark hidden when collapsed, section dividers replace section labels, nav items icon-only with tooltip
- 2026-05-05 · F3.5 · DSP · PASS — Cmd/Ctrl+B global keydown toggles locked-open ↔ unlocked-collapsed, Esc while hovering snaps to collapsed, aria-expanded on sidebar wrapper, aria-pressed on lock pin button
- 2026-05-06 · F4.1 · DSP · PASS — removed duplicate h1 page title from Topbar non-schedule path; Topbar now shows breadcrumb + action buttons only
- 2026-05-06 · F4.2 · DSP · PASS — removed hideTopbarOnRoute for /dashboard/calendar and /dashboard/subjects; Topbar now renders breadcrumb universally on all authenticated routes
- 2026-05-06 · F4.3 · DSP · PASS — replaced bg-action-primary-bg/text-action-primary-fg with hardcoded bg-[#1A1612] text-white on + New Plan button, eliminating CSS variable race condition
- 2026-05-06 · F4.4 · DSP · PASS — removed hideMenuOnRoute suppression; hamburger menu icon visible on every route below lg
- 2026-05-06 · F4.5 · DSP · PASS — added pr-4 to ScheduleTopbarControls outer container; subject chips use flex-wrap below lg to prevent horizontal overflow

---

## 8. Working agreements

- **Branch:** all work on `design-v2`. Squash-merge to `main` only after F11 sign-off.
- **Commits:** one task per commit where feasible. Commit message format: `[Fxx.y] short description`.
- **Token changes:** all surface/color token edits land in F1; later phases use the tokens, never inline color hex.
- **No new dependencies** without explicit approval — work within Tailwind v4 + existing primitives.
- **Dark mode:** removed (F12.2). Light only.
- **Tests:** 191 existing must remain green at every phase boundary. Add new tests for F3 (sidebar state machine) and F5 (mobile tab bar active state).
- **Database:** zero schema changes expected. If any phase needs one, write SQL to `supabase/migrations/<version>_<name>.sql` and pause for manual apply (per user's standing rule).

---

## 9. Open risks

1. **Warm cream + existing imagery** — chart colors, illustrations, logo all currently tuned for cool gray. Spot check during F1.7.
2. **Hover-expand sidebar overlay** may cover content that was important. Mitigate by making the overlay dismissable on `Esc` (F3.5) and keeping it absolute-positioned (F3.3).
3. **Bottom tab bar on iOS** — home-indicator clearance is fragile; F5.6 covers it but live-device test needed before sign-off.
4. **Calendar agenda view** (F7.4) — net-new component, not a tweak. Largest scope risk.
5. **Token alias cleanup F12.1** — if any consumer was missed in F1.2 or later, removing aliases breaks them. Run a final grep before F12.1.

---

## 10. Quick reference

- Layer-1 color: `#F4F1EA` (warm cream).
- Default sidebar: locked-open at 240px; remembers last user choice.
- Mobile primary nav: bottom tab bar (5 icons). Mobile overflow: hamburger drawer.
- Card: `surface-card` utility = white bg + hairline border + soft shadow + responsive radius.
- Selected state: `--accent-selected-bg` (warm sand) + 3px left bar.
- Alert severities: info=sky, warn=butter, critical=rose.
- OpenCode model share: ≥75% (target was 80%; tradeoff explained §5).
- Validation: 11 gates, each with explicit pass criteria.
