# PRE_POST_COMPARISON — Fix_DESIGN_V2

**Baseline:** `app_screenshots/Pre_Fix_V2/` (30 PNGs: 6 routes × 5 widths)
**Post-fix:** `app_screenshots/Post_Fix_V2/` (30 PNGs: 6 routes × 5 widths)

---

## Per-Route, Per-Width Comparison

### 1. Overview (/dashboard)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Same (mobile already had bottom tab bar from F7) | — | None |
| 768px | Canvas now fills viewport edge-to-edge | Yes | None |
| 1024px | Sidebar locked-open, white cards on cream canvas | Yes | None |
| 1440px | Sidebar locked-open, stats row uses 3-col content-grid | Yes | None |
| 1600px | Extra whitespace managed by page-root max-width (1480px) | Yes | None |

### 2. Subjects (/dashboard/subjects)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Bottom tab bar present; single-column subject chips | Yes | None |
| 768px | 2-column card grid on cream canvas | Yes | None |
| 1024px | 3-column grid with locked sidebar | Yes | None |
| 1440px | 3-column grid, comfortable spacing | Yes | None |
| 1600px | Consistent with 1440px (max-width constrained) | Yes | None |

### 3. Calendar (/dashboard/calendar)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Agenda view (vertical list) — F7.4 | Yes | None |
| 768px | Agenda view continues; calendar grid hidden <lg | Yes | None |
| 1024px | Month grid with max 2 events/cell + "+N more" chip (R1) | Yes | Cell height may clip on very busy days |
| 1440px | Month grid with max 4 events/cell + "+N more" chip (R1) | Yes | Cell height may clip on very busy days |
| 1600px | Same as 1440px | — | Same |

### 4. Schedule (/schedule)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Single-column vertical day cards (F7.6) | Yes | None |
| 768px | Same single-column view | Yes | None |
| 1024px | 5-day column grid Mon–Fri (R2); Sat/Sun hidden | Yes | Weekend tasks hidden at this width |
| 1440px | Full 7-day column grid Mon–Sun (R2) | Yes | None |
| 1600px | Same as 1440px | — | None |

### 5. Planner (/planner)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Bottom tab bar; mobile planner phase nav (F7) | Yes | None |
| 768px | Planner task cards fill width | Yes | None |
| 1024px | Locked sidebar; drop zones visible | Yes | None |
| 1440px | Comfortable card width on cream canvas | Yes | None |
| 1600px | Same as 1440px | — | None |

### 6. Settings (/dashboard/settings)

| Width | What changed | Improved? | Remaining issues |
|-------|-------------|-----------|-----------------|
| 375px | Bottom tab bar in drawer; settings stacked | Yes | None |
| 768px | Single-column settings form | Yes | None |
| 1024px | Form centered with sidebar open | Yes | None |
| 1440px | Form centered, comfortable spacing | Yes | None |
| 1600px | Same as 1440px | — | None |

---

## Global Changes (All Routes, All Widths)

| Change | Task | Status |
|--------|------|--------|
| WCAG AA contrast: text-muted darkened from #8D95A5 to #5F6B7A | R3 | PASS |
| WCAG AA contrast: sidebar inactive nav text now uses text-secondary (#596577) | R3 | PASS |
| Focus ring color changed from #111827 to #3B5CFF (blue) | R4 | PASS |
| Calendar event caps: 2 events at lg, 4 events at xl+ | R1 | PASS |
| Schedule day columns: 5 cols at lg, 7 cols at xl+ | R2 | PASS |

---

**Generated:** 2026-05-06 · **Branch:** design-v2
**Pre-fix screenshots:** `app_screenshots/Pre_Fix_V2/`
**Post-fix screenshots:** `app_screenshots/Post_Fix_V2/`
