# Dark Mode Audit — Phase 0.1

**Date:** 2026-05-04
**Scope:** All `dark:` Tailwind classes and `[data-theme="dark"]` references across the codebase.

---

## Summary

| Category | Count |
|---|---|
| Tailwind `dark:` classes (e.g. `dark:bg-gray-900`) | **0** |
| `[data-theme="dark"]` CSS rules | **0** |
| `[data-theme="dark"]` attribute set in JS/TS | **0** |
| **Total dark-mode references** | **0** |

---

## Detailed Findings

### 1. Tailwind `dark:` prefixed classes

**Count: 0**

No Tailwind `dark:` utility classes were found anywhere in the codebase (components, pages, or CSS files). The project does not use Tailwind's `dark:` variant.

### 2. `[data-theme="dark"]` CSS selectors or attribute references

**Count: 0**

No CSS rule or JS/TS code sets or selects `[data-theme="dark"]`.

---

## How Dark Mode Is Currently Implemented

The project uses an **inverted approach** — the root/default CSS is the dark theme, and light mode is layered on via `[data-theme="light"]` overrides:

### Default (dark) theme — `app/globals.css` lines 3–28

The `:root` block defines dark-mode defaults:
- `--background: #050510`
- `--foreground: #e8e8f0`
- Dark `--sh-card`, `--sh-shadow`, etc.

### Light overrides — `[data-theme="light"]` blocks

These CSS blocks flip variables and component styles when the attribute is present:

| File | Occurrences |
|---|---|
| `app/globals.css` | **28** lines (30, 82, 164, 238, 241, 246, 250–269, 376, 1667, 1761, 1811–1812) |
| `app/components/onboarding/onboarding.css` | **11** lines (61, 170, 193, 238, 248, 392, 409, 507, 528, 569, 653) |

### Theme switcher — `app/components/ThemeProvider.tsx`

Manages a `"dark" | "light"` string state, persisted to `localStorage` as `"PrepVeda-theme"`, and sets `data-theme` on `<html>`. References to `"dark"`:

- **Line 5** — `type Theme = "dark" | "light"`
- **Line 12** — `createContext({ theme: "dark", ... })`
- **Line 20** — `return "dark"` (server-side default)
- **Line 22** — `return stored === "light" || stored === "dark" ? stored : "dark"`
- **Line 31** — `const next: Theme = theme === "dark" ? "light" : "dark"`

---

## Conclusion

This audit found **zero** `dark:` Tailwind classes and **zero** `[data-theme="dark"]` references. Because the dark mode is the root/default, dark-mode removal (Phase 12) will require:

1. Inverting the `:root` block in `app/globals.css` to become light defaults
2. Either deleting or inlining all `[data-theme="light"]` override blocks into the root
3. Simplifying or removing `ThemeProvider.tsx`
4. Updating `app/components/onboarding/onboarding.css` — merging its 11 `[data-theme="light"]` blocks
