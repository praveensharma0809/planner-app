# Token Audit Report — Phase 0.2

> **Scope:** Every custom CSS property (`--*`) defined in `app/globals.css`, referenced in `app/components/onboarding/onboarding.css`, and consumed by all `.tsx` / `.ts` / `.css` files under `app/`.
> **Date:** 2026-05-04
> **Source of truth for replacement mapping:** `DESIGN_V2_PLAN.md` §2.1

---

## 1. Executive Summary

| Category | Count | Notes |
|---|---|---|
| **Total unique custom properties defined** | 57 | All live in `app/globals.css` |
| **`--sh-*` tokens** | 25 | Shared component namespace; heavily referenced across JSX |
| **Legacy surface tokens** | 7 | `--background`, `--foreground`, `--card`, `--card-border`, `--card-hover`, `--accent`, `--accent-glow`, `--emerald`, `--emerald-glow` |
| **Layout / chrome tokens** | 24 | Sidebar, topbar, nav-item, tooltip, user-area tokens |
| **Tailwind v4 `@theme inline` aliases** | 2 | `--color-background`, `--color-foreground` (mirror `--background` / `--foreground`) |
| **`var(--sh-*)` call sites in JSX/CSS** | ~560 | Spread across 40+ files |

**Key takeaway:** The `--sh-*` namespace is the dominant token surface. The new Design System Specification (§2.1) replaces almost every `--sh-*` value with a semantic token (e.g. `--surface-panel`, `--text-primary`, `--border-hairline`). A small number of layout-dimension tokens (`--sidebar-width`, `--topbar-height`) are **not** being replaced because they describe geometry, not color.

---

## 2. Complete Token Inventory

### 2.1 `--sh-*` shared component tokens

| Token | Defined in | `var()` reference count | Primary consumers |
|---|---|---|---|
| `--sh-border` | `globals.css` root + light | **130** | 28 files (Dashboard, Planner, Schedule, Subjects, UI primitives, globals.css classes) |
| `--sh-text-muted` | `globals.css` root + light | **108** | 29 files (same broad spread) |
| `--sh-text-secondary` | `globals.css` root + light | **80** | 18 files (Dashboard, Planner, Schedule, UI primitives, onboarding.css) |
| `--sh-text-primary` | `globals.css` root + light | **70** | 25 files (Dashboard, Planner, Schedule, Subjects, UI primitives, onboarding.css) |
| `--sh-card` | `globals.css` root + light | **44** | 20 files (all major routes + UI primitives) |
| `--sh-primary-glow` | `globals.css` root + light | **27** | 11 files (Subjects data-table, onboarding.css, TutorialWizard) |
| `--sh-primary` | `globals.css` root + light | **21** | 17 files (Calendar, Subjects, Schedule, onboarding, TutorialWizard) |
| `--sh-primary-light` | `globals.css` root + light | **13** | 8 files (Subjects data-table, onboarding.css) |
| `--sh-primary-muted` | `globals.css` root + light | **12** | 8 files (Subjects data-table, onboarding.css) |
| `--sh-shadow-sm` | `globals.css` root + light | **11** | 5 files (Schedule error/loading, Subjects data-table, globals.css) |
| `--sh-success` | `globals.css` root | **8** | 5 files (Subjects task-rows & data-table, globals.css) |
| `--sh-radius` | `globals.css` root | **5** | 1 file (globals.css only — consumed by `.ui-card`, `.stats-chip`, etc.) |
| `--sh-radius-sm` | `globals.css` root | **4** | 1 file (globals.css only — `.ui-btn`, `.ui-input`, `.ui-tabs-list`) |
| `--sh-shadow-lg` | `globals.css` root + light | **3** | 3 files (Modal, Schedule modal, globals.css) |
| `--sh-shadow` | `globals.css` root + light | **3** | 8 files (Dropdown, Modal, Schedule, Subjects, globals.css) |
| `--sh-card-hover` | `globals.css` root + light | **3** | 1 file (globals.css only — `.ui-card-interactive:hover`, `.overview-task-row:hover`) |
| `--sh-card-border` | `globals.css` root + light | **0** *(defined but no `var()` usage found in JSX)* | 0 files — only referenced inside `globals.css` itself via `.ui-card` and `.section-card` |
| `--sh-radius-lg` | `globals.css` root | **2** | 1 file (globals.css only — `.section-card`, `.empty-state`) |
| `--sh-primary-dark` | `globals.css` root | **0** | 0 files — defined but unreferenced |
| `--sh-warning` | `globals.css` root | **0** | 0 files — defined but unreferenced |
| `--sh-danger` | `globals.css` root | **0** | 0 files — defined but unreferenced |

### 2.2 Legacy surface / accent tokens (non `--sh-*`)

| Token | Defined in | `var()` reference count | Notes |
|---|---|---|---|
| `--background` | `globals.css` root + light + `@theme inline` | **8** | Used by `body`, onboarding.css, `DayColumn.tsx`, `onboarding.css` |
| `--foreground` | `globals.css` root + light + `@theme inline` | **14** | Used by `body`, `btn-ghost`, `color-mix()` in AddTaskButton, data-table nav, DayColumn |
| `--card` | `globals.css` root + light | **1** | Used only by `.glass-card` in globals.css |
| `--card-border` | `globals.css` root + light | **2** | Used by `.glass-card`, `.btn-ghost` in globals.css |
| `--card-hover` | `globals.css` root + light | **2** | Used by `.glass-card:hover`, `.btn-ghost:hover` in globals.css |
| `--accent` | `globals.css` root + light | **1** | Used by `DayColumn.tsx` drag-over background |
| `--accent-glow` | `globals.css` root + light | **0** | Defined but unreferenced in JSX/CSS |
| `--emerald` | `globals.css` root + light | **0** | Defined but unreferenced in JSX/CSS |
| `--emerald-glow` | `globals.css` root + light | **0** | Defined but unreferenced in JSX/CSS |

### 2.3 Layout / chrome tokens (sidebar, topbar, tooltip, user area)

> **Important:** These are consumed **almost exclusively inside `globals.css`** by their corresponding component CSS classes. They do **not** appear as inline `style={{}}` props in JSX.

| Token | Reference count in `app/` | Where referenced |
|---|---|---|
| `--sidebar-width` | 2 | `.sidebar-root`, `AppShell.tsx` margin-left class |
| `--sidebar-collapsed-width` | 2 | `.sidebar-root.sidebar-collapsed`, `AppShell.tsx` margin-left class |
| `--topbar-height` | 2 | `.sidebar-header`, `.topbar-root` |
| `--sidebar-bg` | 1 | `.sidebar-root` |
| `--sidebar-border-color` | 1 | `.sidebar-root`, `.sidebar-header`, `.sidebar-footer`, `.sidebar-section-divider` |
| `--sidebar-section-color` | 1 | `.sidebar-section-label` |
| `--sidebar-divider-color` | 1 | `.sidebar-section-divider` |
| `--nav-item-color` | 1 | `.sidebar-nav-item`, `.topbar-icon-btn` |
| `--nav-item-hover-color` | 1 | `.sidebar-nav-item:hover`, `.sidebar-logo-text`, `.topbar-icon-btn:hover` |
| `--nav-item-hover-bg` | 1 | `.sidebar-nav-item:hover`, `.topbar-icon-btn:hover`, `.ui-btn-ghost:hover` |
| `--nav-item-active-color` | 1 | `.sidebar-nav-item-active`, `.sidebar-nav-item-active::before` |
| `--nav-item-active-bg` | 1 | `.sidebar-nav-item-active` |
| `--user-email-color` | 1 | `.sidebar-user-name` |
| `--user-avatar-bg` | 1 | `.sidebar-avatar` |
| `--user-avatar-color` | 1 | `.sidebar-avatar` |
| `--signout-hover-color` | 1 | `.sidebar-signout-btn:hover` |
| `--signout-hover-bg` | 1 | `.sidebar-signout-btn:hover` |
| `--topbar-bg` | 1 | `.topbar-root`, `.schedule-topbar-controls` |
| `--topbar-border-color` | 1 | `.topbar-root`, `.schedule-topbar-section-subjects`, `.schedule-topbar-section-actions` |
| `--topbar-title-color` | 1 | `.topbar-page-title` |
| `--tooltip-bg` | 1 | `.sidebar-tooltip` |
| `--tooltip-color` | 1 | `.sidebar-tooltip` |
| `--tooltip-border` | 1 | `.sidebar-tooltip` |

### 2.4 `@theme inline` aliases (Tailwind v4)

| Token | Mapped to | Usage |
|---|---|---|
| `--color-background` | `var(--background)` | Tailwind `bg-background` class |
| `--color-foreground` | `var(--foreground)`` | Tailwind `text-foreground` class |

---

## 3. Token Usage Heat-Map (by file group)

| File group | `--sh-*` refs | Notes |
|---|---|---|
| `app/globals.css` | ~200 | Defines every token; contains `.ui-*`, `.sidebar-*`, `.topbar-*`, `.overview-*`, `.dashboard-*` classes that consume them |
| `app/components/onboarding/onboarding.css` | ~25 | Heavy consumer of `--sh-primary*`, `--sh-text-*` |
| `app/(dashboard)/planner/subjects-data-table.tsx` | ~45 | Modal, task rows, empty states, dependency lists |
| `app/(dashboard)/planner/subjects-data-table.*.tsx` | ~40 | Navigation, modals, task composer, dependencies |
| `app/(dashboard)/dashboard/subjects/subjects-data-table*.tsx` | ~25 | Same pattern as planner data-table |
| `app/(dashboard)/schedule/schedule-page.*.tsx` | ~20 | Cards, modal, day column |
| `app/(dashboard)/dashboard/page.tsx` | ~15 | Dashboard hero, stats, task groups, alerts |
| `app/components/ui/*.tsx` | ~15 | Modal, Input, Dropdown, Checkbox, Progress |
| `app/(dashboard)/planner/SubjectDrawer.tsx` | ~10 | Drawer chrome |
| `app/(dashboard)/dashboard/subjects/SubjectDrawer.tsx` | ~8 | Drawer chrome |
| `app/components/tasks/AddTaskButton.tsx` | ~8 | Inline `color-mix()` with `--sh-card` / `--foreground` |
| Other route files | ~20 | Calendar MonthView, PlanHistory, schedule error/loading, etc. |

---

## 4. Replacement Mapping — Old → New Semantic Tokens

Based on `DESIGN_V2_PLAN.md` §2.1 (Color tokens, Radii, Shadows).

### 4.1 Surface tokens

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--background` (dark: `#050510`) | `--surface-page` (`#F3F4F6`) | Outermost viewport background. Dark value is deleted per Phase 12. |
| `--background` (light: `#f0f2f5`) | `--surface-page` (`#F3F4F6`) | Same role; value updated to Gray 100. |
| `--card` | `--surface-panel` (`#FFFFFF`) | Generic panel background. |
| `--card-hover` | `--surface-hover` (`#F3F4F6`) | Hover wash state. |
| `--sh-card` | `--surface-panel` (`#FFFFFF`) | Main card/panel surface (Layer C). |
| `--sh-card-hover` | `--surface-hover` (`#F3F4F6`) | Card hover state. |
| `--card-border` / `--sh-card-border` | `--border-hairline` (`#F3F4F6`) | Invisible panel edge. |
| `--sh-border` | `--border-hairline` or `--border-subtle` | Most existing usages are decorative 1px borders; map to `--border-hairline`. Inputs and secondary buttons map to `--border-subtle`. |
| *N/A* (new concept) | `--surface-app` (`#FFFFFF`) | Layer B app shell (new token, no direct predecessor). |
| *N/A* (new concept) | `--surface-sidebar` (`#F9FAFB`) | Layer B sidebar tint (new token). |
| *N/A* (new concept) | `--surface-panel-muted` (`#FAFAFB`) | Subtle alternative panel tint. |

### 4.2 Text tokens

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--foreground` | `--text-primary` (`#111827`) | Primary body/heading text. |
| `--sh-text-primary` | `--text-primary` (`#111827`) | Headings, primary copy. |
| `--sh-text-secondary` | `--text-secondary` (`#6B7280`) | Labels, supporting copy. |
| `--sh-text-muted` | `--text-muted` (`#9CA3AF`) | Placeholders, disabled, timestamps. |
| *N/A* | `--text-on-dark` (`#FFFFFF`) | Text on black pill buttons (new token). |

### 4.3 Border tokens

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--sh-border` (default usage) | `--border-hairline` (`#F3F4F6`) | Panel edges, dividers where contrast is already provided by background layers. |
| `--sh-border` (input/button usage) | `--border-subtle` (`#E5E7EB`) | Input borders, secondary buttons, focus-ring substrate. |
| `--card-border` | `--border-hairline` (`#F3F4F6`) | Same as above. |
| *N/A* | `--border-strong` (`#D1D5DB`) | Focus rings, active separators. |

### 4.4 Accent / primary action tokens (purple brand → black pill)

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--sh-primary` | `--action-primary-bg` (`#000000`) | Old purple gradient primary is gone. Primary action is now a black pill. |
| `--sh-primary-light` | `--action-primary-fg` (`#FFFFFF`) | Text on primary action. |
| `--sh-primary-dark` | `--action-primary-bg-hover` (`#1F2937`) | Hover state for primary action. |
| `--sh-primary-muted` | *Deprecated / pastel replacement* | Used for subtle tinted backgrounds; replace with `--surface-hover` or appropriate `--pastel-*` token. |
| `--sh-primary-glow` | *Deleted* | Glow effects are removed per Design Principle #5 (no neon). |
| `--accent` / `--accent-glow` | *Deleted* | Indigo/violet accent brand is removed. |

### 4.5 Pastel status tokens (replace raw color values)

| Old token / raw value | New token(s) | Rationale |
|---|---|---|
| `--sh-success` / `#34D399` / `#10B981` | `--pastel-mint` bg + text | Success, completed tasks. |
| `--sh-warning` / `#F59E0B` / `#D97706` | `--pastel-peach` bg + text | Warning, pending. |
| `--sh-danger` / `#EF4444` / `#DC2626` | `--pastel-rose` bg + text | Danger, missed, overdue. |
| `#6366f1` / `#818cf8` (indigo) | *Deleted* | Purple brand accents removed. |
| `#A89EFF` / `#8677EE` (light purple) | *Deleted* | Same as above. |
| `#B794F4` (lavender) | `--pastel-lilac` bg + text | Replaces purple brand as primary pastel accent. |
| Raw amber/yellow for "today" | `--pastel-butter` bg + text | Highlight, "today" indicator. |
| Raw sky blue for info | `--pastel-sky` bg + text | Information, neutral events. |

### 4.6 Shadow tokens

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--sh-shadow-lg` | `--shadow-app` | App shell float (largest shadow). |
| `--sh-shadow` | `--shadow-card` | Inset panels, cards. |
| `--sh-shadow-sm` | `--shadow-none` or `--shadow-card` | Most existing `shadow-sm` usages become `--shadow-none` because Layer B vs Layer C contrast removes the need for a shadow. Elevation is provided by the floating shell, not individual cards. |
| `.glass-card` / `.gradient-card` / `.emerald-card` / `.danger-card` / `.warning-card` | *Deleted* | These gradient/glow card styles conflict with the new flat, airy aesthetic. |

### 4.7 Radius tokens

| Old token(s) | New token(s) | Rationale |
|---|---|---|
| `--sh-radius` (`12px`) | `--r-card` (`20px`) | Major cards now use `20px` (rounded-2xl). |
| `--sh-radius-lg` (`16px`) | `--r-card` (`20px`) | Same. |
| `--sh-radius-sm` (`8px`) | `--r-card-sm` (`12px`) | Small cards, list rows. |
| *N/A* | `--r-app` (`28px`) | App shell outer container (new). |
| *N/A* | `--r-input` (`12px`) | Text inputs, date pickers (new). |
| *N/A* | `--r-pill` (`9999px`) | Buttons, chips, tabs, badges (new). |

### 4.8 Layout / geometry tokens (KEEP — not replaced)

| Token | Decision | Rationale |
|---|---|---|
| `--sidebar-width` (240px) | **Keep** | Geometry token; value may change per §3.1 responsive matrix but token name stays. |
| `--sidebar-collapsed-width` (64px) | **Keep** | Same as above. |
| `--topbar-height` (64px) | **Keep** | Geometry token. |
| `--sidebar-bg` | **Replace** | Map to `--surface-sidebar`. |
| `--sidebar-border-color` | **Replace** | Map to `--border-hairline`. |
| `--sidebar-section-color` | **Replace** | Map to `--text-muted`. |
| `--sidebar-divider-color` | **Replace** | Map to `--border-hairline`. |
| `--nav-item-color` | **Replace** | Map to `--text-muted`. |
| `--nav-item-hover-color` | **Replace** | Map to `--text-primary`. |
| `--nav-item-hover-bg` | **Replace** | Map to `--surface-hover`. |
| `--nav-item-active-color` | **Replace** | Map to `--text-primary`. |
| `--nav-item-active-bg` | **Replace** | Map to `--surface-panel` (white pill on gray bg per §2.7). |
| `--topbar-bg` | **Replace** | Map to `--surface-app`. |
| `--topbar-border-color` | **Replace** | Map to `--border-hairline`. |
| `--topbar-title-color` | **Replace** | Map to `--text-primary`. |
| `--tooltip-bg` | **Replace** | Map to `--surface-panel` or a dark variant if tooltip stays dark. |
| `--tooltip-color` | **Replace** | Map to `--text-primary`. |
| `--tooltip-border` | **Replace** | Map to `--border-subtle`. |
| `--user-email-color` | **Replace** | Map to `--text-secondary`. |
| `--user-avatar-bg` | **Replace** | Map to `--pastel-lilac` bg or `--surface-hover`. |
| `--user-avatar-color` | **Replace** | Map to `--pastel-lilac` text. |
| `--signout-hover-color` | **Replace** | Map to `--pastel-rose` text. |
| `--signout-hover-bg` | **Replace** | Map to `--pastel-rose` bg. |

---

## 5. Hit-List for Phase 1 (Token System Rewrite)

The following actions must be completed in **Phase 1** per `DESIGN_V2_PLAN.md` §6.

### 5.1 `app/globals.css` — token block rewrite

- [ ] Delete the entire `:root` dark-default token block (lines 3–28) and `[data-theme="light"]` override block (lines 30–52).
- [ ] Delete `[data-theme="dark"]` rules entirely (Phase 12 strips them, but they are already dead code once we go light-only).
- [ ] Rewrite a single `@theme inline` block containing **all** new semantic tokens from §2.1.
- [ ] Add `@utility` shortcuts for `pill`, `panel`, `chip-mint`, `chip-sky`, `chip-lilac`, `chip-peach`, `chip-butter`, `chip-rose`.
- [ ] Keep `--sidebar-width`, `--sidebar-collapsed-width`, `--topbar-height` as raw layout variables (value may be adjusted per §3.1).
- [ ] Map sidebar/topbar/nav tooltip tokens to new semantic values **inside** the component CSS classes (or migrate those classes to Tailwind utility classes in later phases).

### 5.2 `app/components/onboarding/onboarding.css` — onboarding token migration

- [ ] Replace all `--sh-text-*` references with `--text-primary`, `--text-secondary`, `--text-muted`.
- [ ] Replace all `--sh-primary*` references. The onboarding Next/Back buttons currently use a purple gradient; restyle to the new black primary pill (`--action-primary-bg`) or keep a single pastel accent if marketing requires it.
- [ ] Replace `--background` / `--foreground` with `--surface-page` / `--text-primary`.

### 5.3 Component primitives (`app/components/ui/`)

| File | Tokens to replace | New mapping |
|---|---|---|
| `Modal.tsx` | `--sh-card`, `--sh-border`, `--sh-shadow-lg`, `--sh-text-primary`, `--sh-text-muted` | `--surface-panel`, `--border-hairline`, `--shadow-app`, `--text-primary`, `--text-muted` |
| `Input.tsx` | `--sh-text-secondary`, `--sh-text-muted` | `--text-secondary`, `--text-muted` |
| `Dropdown.tsx` | `--sh-card`, `--sh-border`, `--sh-shadow` | `--surface-panel`, `--border-hairline`, `--shadow-pop` |
| `Checkbox.tsx` | `--sh-text-primary`, `--sh-text-muted` | `--text-primary`, `--text-muted` |
| `Progress.tsx` | `--sh-text-muted` | `--text-muted` |
| `Button.tsx` | *Check for hardcoded Tailwind classes* | Refactor to `--action-primary-bg`, `--action-secondary-bg`, etc. |
| `Badge.tsx` | *Check for hardcoded color classes* | Refactor to `--pastel-*` tokens. |
| `Tabs.tsx` | *Check for hardcoded color classes* | Refactor to pill segment style per §2.7. |

### 5.4 Layout chrome (`app/components/layout/`)

| File | Tokens to replace | New mapping |
|---|---|---|
| `AppShell.tsx` | `--sidebar-width`, `--sidebar-collapsed-width` | Keep geometry; update `background` to `--surface-page`. |
| `Sidebar.tsx` | `--sidebar-bg`, `--sidebar-border-color`, `--sidebar-section-color`, `--sidebar-divider-color`, `--nav-item-*`, `--user-*`, `--signout-*`, `--tooltip-*` | Map to new semantic tokens per §4.8. Active state becomes white pill (`--surface-panel`) with `--shadow-card` on `--surface-hover` background. |
| `Topbar.tsx` | `--topbar-bg`, `--topbar-border-color`, `--topbar-title-color`, `--nav-item-*` | Map to `--surface-app`, `--border-hairline`, `--text-primary`, `--text-muted`. |
| `PageHeader.tsx` | Check for `--sh-text-muted` usage | Map to `--text-muted`. |
| `SectionCard.tsx` | Check for `--sh-*` usage | Map to `--surface-panel`, `--border-hairline`. |

### 5.5 Route files — high-touch areas

| Route area | Files | Key replacements |
|---|---|---|
| **Dashboard** | `page.tsx`, `PlanHistory.tsx` | `--sh-card` → `--surface-panel`; `--sh-border` → `--border-hairline`; progress bars → `--pastel-lilac`; alert cards → `--pastel-rose` / `--pastel-peach` |
| **Calendar** | `MonthView.tsx` | `--sh-border` → `--border-hairline`; event blocks → `--pastel-*` palette |
| **Schedule** | `DayColumn.tsx`, `schedule-page.*.tsx`, `error.tsx`, `loading.tsx` | `--sh-card` → `--surface-panel`; `--sh-shadow*` → `--shadow-card` / `--shadow-none`; subject chips → `--pastel-*` |
| **Subjects** | `subjects-data-table.tsx`, `subjects-data-table.*.tsx`, `SubjectDrawer.tsx` | Massive refactor: `--sh-border`, `--sh-text-*`, `--sh-card`, `--sh-primary*` → new semantic system. Status checkboxes → `--pastel-mint` / `--pastel-rose`. |
| **Planner** | `subjects-data-table.tsx`, `subjects-data-table.*.tsx`, `SubjectDrawer.tsx`, `PlannerWizardClient.tsx` | Same pattern as Subjects. Step indicator restyled to pill segment control. |
| **Onboarding** | `onboarding.css`, `TutorialWizard.tsx`, `FlowTutorialButton.tsx` | Purple gradient buttons → black primary pill or white secondary pill. All `--sh-text-*` → `--text-*`. |

---

## 6. Tokens with ZERO call sites (safe to delete immediately)

The following tokens are defined in `globals.css` but are **never consumed** by any JSX or CSS class:

| Token | Location in globals.css |
|---|---|
| `--sh-primary-dark` | Line 334 (root) / Line 379 (light) |
| `--sh-warning` | Line 340 (root only) |
| `--sh-danger` | Line 341 (root only) |
| `--accent-glow` | Line 10 (root) / Line 37 (light) |
| `--emerald` | Line 26 (root) / Line 38 (light) |
| `--emerald-glow` | Line 27 (root) / Line 39 (light) |

> **Note:** `--emerald` is referenced by `.progress-emerald` and `.gradient-text-emerald` CSS classes inside `globals.css`, but those classes are themselves unused in the JSX scan. They can be removed as part of Phase 1.3 (strip `glass-card`, `gradient-card`, etc.).

---

## 7. Risk & Dependency Notes

1. **`color-mix(in srgb, var(--sh-card) ..., var(--foreground) ...)`**  
   Found in `AddTaskButton.tsx` and data-table navigation files. These inline mixes must be replaced with solid semantic tokens (`--surface-panel`, `--surface-hover`) because the new system does not use `color-mix()` for hover states.

2. **Hardcoded `rgba()` values in JSX**  
   Many files use inline `style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}`. The `rgba()` values are theme-dependent (light vs dark). Going light-only means these should become solid token references (`--surface-panel-muted`, `--surface-hover`) instead of magic `rgba()` strings.

3. **Dark-mode override classes in `globals.css`**  
   Lines 246–269 contain `[data-theme="light"] .bg-white\/5`, `.border-white\/10`, `.text-white\/90`, etc. These are CSS class overrides that map Tailwind dark-mode utility classes to light-mode equivalents. They are **all** candidates for deletion in Phase 12, but some may be referenced by JSX files. A quick grep shows they are **not** referenced by name in JSX (they override existing Tailwind classes), so they can be removed when dark mode is stripped.

4. **`onboarding.css` dark-mode sensitivity**  
   `onboarding.css` has explicit `[data-theme="light"]` overrides for `.onb-dot`, `.onb-chip`, `.onb-back-btn`, etc. These become unnecessary once the root tokens are light-only. They can be collapsed into a single rule set.

5. **`--color-background` / `--color-foreground` Tailwind aliases**  
   The `@theme inline` block currently exposes `bg-background` and `text-foreground` to Tailwind. When `--background` is replaced by `--surface-page`, we must decide whether to keep `--color-background` as an alias for backward compatibility or remove it. **Recommendation:** Remove the alias and migrate all `bg-background` / `text-foreground` usages to `bg-[--surface-page]` / `text-[--text-primary]` (or add a new alias `--color-surface-page`).

---

## 8. Summary Table: Every Old Token → Fate

| Old Token | Fate | Replacement(s) | Phase |
|---|---|---|---|
| `--background` | Replace | `--surface-page` | 1 |
| `--foreground` | Replace | `--text-primary` | 1 |
| `--card` | Replace | `--surface-panel` | 1 |
| `--card-border` | Replace | `--border-hairline` | 1 |
| `--card-hover` | Replace | `--surface-hover` | 1 |
| `--accent` | Delete | *None* (purple brand removed) | 1 |
| `--accent-glow` | Delete | *None* | 1 |
| `--emerald` | Delete | `--pastel-mint` | 1 |
| `--emerald-glow` | Delete | *None* | 1 |
| `--sh-card` | Replace | `--surface-panel` | 1 |
| `--sh-card-hover` | Replace | `--surface-hover` | 1 |
| `--sh-card-border` | Replace | `--border-hairline` | 1 |
| `--sh-border` | Replace | `--border-hairline` / `--border-subtle` | 1 |
| `--sh-radius` | Replace | `--r-card` (20px) | 1 |
| `--sh-radius-sm` | Replace | `--r-card-sm` (12px) | 1 |
| `--sh-radius-lg` | Replace | `--r-card` (20px) | 1 |
| `--sh-shadow` | Replace | `--shadow-card` | 1 |
| `--sh-shadow-sm` | Replace | `--shadow-none` or `--shadow-card` | 1 |
| `--sh-shadow-lg` | Replace | `--shadow-app` | 1 |
| `--sh-text-primary` | Replace | `--text-primary` | 1 |
| `--sh-text-secondary` | Replace | `--text-secondary` | 1 |
| `--sh-text-muted` | Replace | `--text-muted` | 1 |
| `--sh-primary` | Replace | `--action-primary-bg` (`#000000`) | 1 |
| `--sh-primary-light` | Replace | `--action-primary-fg` (`#FFFFFF`) | 1 |
| `--sh-primary-dark` | Delete | `--action-primary-bg-hover` (`#1F2937`) | 1 |
| `--sh-primary-muted` | Replace | `--surface-hover` or `--pastel-lilac` bg | 1 |
| `--sh-primary-glow` | Delete | *None* (no glows in v2) | 1 |
| `--sh-success` | Replace | `--pastel-mint` | 1 |
| `--sh-warning` | Replace | `--pastel-peach` | 1 |
| `--sh-danger` | Replace | `--pastel-rose` | 1 |
| `--sidebar-width` | **Keep** | Value may change; name stays | 2 |
| `--sidebar-collapsed-width` | **Keep** | Value may change; name stays | 2 |
| `--topbar-height` | **Keep** | Value may change; name stays | 2 |
| `--sidebar-bg` | Replace | `--surface-sidebar` | 1–2 |
| `--sidebar-border-color` | Replace | `--border-hairline` | 1–2 |
| `--sidebar-section-color` | Replace | `--text-muted` | 1–2 |
| `--sidebar-divider-color` | Replace | `--border-hairline` | 1–2 |
| `--nav-item-color` | Replace | `--text-muted` | 1–2 |
| `--nav-item-hover-color` | Replace | `--text-primary` | 1–2 |
| `--nav-item-hover-bg` | Replace | `--surface-hover` | 1–2 |
| `--nav-item-active-color` | Replace | `--text-primary` | 1–2 |
| `--nav-item-active-bg` | Replace | `--surface-panel` | 1–2 |
| `--user-email-color` | Replace | `--text-secondary` | 1–2 |
| `--user-avatar-bg` | Replace | `--pastel-lilac` bg | 1–2 |
| `--user-avatar-color` | Replace | `--pastel-lilac` text | 1–2 |
| `--signout-hover-color` | Replace | `--pastel-rose` text | 1–2 |
| `--signout-hover-bg` | Replace | `--pastel-rose` bg | 1–2 |
| `--topbar-bg` | Replace | `--surface-app` | 1–2 |
| `--topbar-border-color` | Replace | `--border-hairline` | 1–2 |
| `--topbar-title-color` | Replace | `--text-primary` | 1–2 |
| `--tooltip-bg` | Replace | `--surface-panel` (or dark fallback) | 1–2 |
| `--tooltip-color` | Replace | `--text-primary` | 1–2 |
| `--tooltip-border` | Replace | `--border-subtle` | 1–2 |
| `--color-background` | Re-alias | `--color-surface-page` (or delete) | 1 |
| `--color-foreground` | Re-alias | `--color-text-primary` (or delete) | 1 |

---

*End of report. This document should be committed to `docs/design-v2/token-audit.md` and referenced throughout Phase 1–3.*
