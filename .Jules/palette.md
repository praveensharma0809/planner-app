## 2024-04-08 - Explicit Label Associations and ARIA Labels
**Learning:** Custom UI components (like modal/drawer forms and custom action buttons) often rely on visual context instead of semantic HTML (missing `htmlFor` on labels or `aria-label` on text-based icon buttons). This creates significant accessibility barriers.
**Action:** Always verify that every `<label>` explicitly targets its input with `htmlFor` and `id`, and that every icon-only or non-descriptive text button has an `aria-label` and, if applicable, an `aria-pressed` state.
