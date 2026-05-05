# Design v2 — Semantic Tokens Quick Reference

> All tokens are defined in `app/globals.css` within the `@theme inline` block.
> They are referenceable as Tailwind utilities (e.g., `bg-surface-app`, `shadow-app`, `rounded-app`)
> or via arbitrary values (e.g., `bg-[--surface-app]`, `text-[--text-primary]`).

---

## Surface Tokens

| Token | Tailwind Utility | Hex | Purpose |
|---|---|---|---|
| `--surface-page` | `bg-surface-page` | `#F3F4F6` | Outermost browser background (Layer A) |
| `--surface-app` | `bg-surface-app` | `#FFFFFF` | App shell main area (Layer B) |
| `--surface-sidebar` | `bg-surface-sidebar` | `#F9FAFB` | Sidebar tint inside Layer B |
| `--surface-panel` | `bg-surface-panel` | `#FFFFFF` | Inset content cards (Layer C) |
| `--surface-panel-muted` | `bg-surface-panel-muted` | `#FAFAFB` | Subtle alternative panel tint |
| `--surface-hover` | `bg-surface-hover` | `#F3F4F6` | Default hover wash |

---

## Text Tokens

| Token | Tailwind Utility | Hex | Purpose |
|---|---|---|---|
| `--text-primary` | `text-text-primary` | `#111827` | Headings, primary body |
| `--text-secondary` | `text-text-secondary` | `#6B7280` | Labels, supporting copy |
| `--text-muted` | `text-text-muted` | `#9CA3AF` | Placeholders, disabled, timestamps |
| `--text-on-dark` | `text-text-on-dark` | `#FFFFFF` | Text on black pill buttons |

---

## Border Tokens

| Token | Tailwind Utility | Hex | Purpose |
|---|---|---|---|
| `--border-hairline` | `border-border-hairline` | `#F3F4F6` | Default panel edge (almost invisible) |
| `--border-subtle` | `border-border-subtle` | `#E5E7EB` | Input borders, secondary buttons |
| `--border-strong` | `border-border-strong` | `#D1D5DB` | Focus rings, active separators |

---

## Pastel Accent Palette

Each pastel has a **bg** token and a **matching dark text** token.

| Token (bg) | Token (text) | Hex (bg) | Hex (text) | Use |
|---|---|---|---|---|
| `--pastel-mint` | `--pastel-mint-text` | `#E8F5E9` | `#1F6F3F` | Success, completed tasks |
| `--pastel-sky` | `--pastel-sky-text` | `#E3F2FD` | `#1565C0` | Information, neutral events |
| `--pastel-lilac` | `--pastel-lilac-text` | `#EDE7F6` | `#5E35B1` | Primary accent (replaces purple brand) |
| `--pastel-peach` | `--pastel-peach-text` | `#FFE8D6` | `#B25C1F` | Warning, pending |
| `--pastel-butter` | `--pastel-butter-text` | `#FFF4C2` | `#8A6D00` | Highlight, "today" |
| `--pastel-rose` | `--pastel-rose-text` | `#FCE4E4` | `#B22A2A` | Danger, missed, overdue |

Available as Tailwind utilities:
- `bg-pastel-mint`, `text-pastel-mint-text`, etc.
- Chip shortcut utilities: `chip-mint`, `chip-sky`, `chip-lilac`, `chip-peach`, `chip-butter`, `chip-rose`

---

## Action Tokens

| Token | Tailwind Utility | Hex | Purpose |
|---|---|---|---|
| `--action-primary-bg` | `bg-action-primary-bg` | `#000000` | Primary pill button bg |
| `--action-primary-fg` | `text-action-primary-fg` | `#FFFFFF` | Primary pill button text |
| `--action-primary-bg-hover` | `bg-action-primary-bg-hover` | `#1F2937` | Primary hover (Gray 800) |
| `--action-secondary-bg` | `bg-action-secondary-bg` | `#FFFFFF` | Secondary pill bg |
| `--action-secondary-fg` | `text-action-secondary-fg` | `#111827` | Secondary pill text |
| `--action-secondary-border` | `border-action-secondary-border` | `#E5E7EB` | Secondary pill border |
| `--focus-ring` | `ring-focus-ring` | `#111827` | Focus ring base |

---

## Radii

| Token | Tailwind Utility | Value | Use |
|---|---|---|---|
| `--radius-app` | `rounded-app` | `28px` | App shell outer container |
| `--radius-card` | `rounded-card` | `20px` | Major cards, calendar event blocks |
| `--radius-card-sm` | `rounded-card-sm` | `12px` | Small cards, list rows |
| `--radius-input` | `rounded-input` | `12px` | Text inputs, date pickers |
| `--radius-pill` | `rounded-pill` | `9999px` | Buttons, chips, tabs, segments, status badges |

---

## Shadows

All shadows are diffused and low-opacity.

| Token | Tailwind Utility | Value | Use |
|---|---|---|---|
| `--shadow-app` | `shadow-app` | `0 24px 60px -20px rgba(17,24,39,0.08), 0 8px 24px -8px rgba(17,24,39,0.04)` | App shell float |
| `--shadow-card` | `shadow-card` | `0 1px 2px rgba(17,24,39,0.04), 0 4px 12px -4px rgba(17,24,39,0.04)` | Inset panels |
| `--shadow-pop` | `shadow-pop` | `0 8px 24px -8px rgba(17,24,39,0.12)` | Hover lift, dropdowns |
| `--shadow-none` | `shadow-none` | `0 0 0 transparent` | Default (most things) |

---

## Layout Variables (Legacy `--sh-*` tokens)

Still active in CSS for legacy components. Will be replaced in later phases.

| Token | Value | Purpose |
|---|---|---|
| `--sidebar-width` | `240px` | Expanded sidebar width |
| `--sidebar-collapsed-width` | `64px` | Collapsed (icon-rail) width |
| `--topbar-height` | `64px` | Topbar height |
